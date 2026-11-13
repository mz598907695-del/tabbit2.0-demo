"""Release safety tests run without credentials, network access or real release files."""
import copy
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from http.client import HTTPException
from urllib.parse import parse_qs, urlparse

spec = importlib.util.spec_from_file_location('publish_update', Path(__file__).resolve().parents[1] / 'publish-update.py')
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class Remote:
    def __init__(self, artifacts, *, draft=None):
        self.artifacts = artifacts
        self.calls = []
        self.assets = []
        self.source = {'full_name': publish.SOURCE_REPO, 'private': True}
        self.repository = {'full_name': publish.REPO, 'private': False, 'default_branch': 'main', 'permissions': {'push': True}}
        self.release = self.new_release(draft) if draft is not None else None
        self.lose_upload_response = False
        self.corrupt_upload = False
        self.externally_published = False
        self.other_releases = []
        self.release_list_reads = 0
        self.new_release_during_upload = None

    def new_release(self, draft):
        return {'id': 42, 'tag_name': self.artifacts.tag, 'draft': draft,
                'html_url': f'https://github.com/{publish.REPO}/releases/tag/{self.artifacts.tag}'}

    def asset(self, name):
        size, digest = self.artifacts.expected[name]
        return {'id': self.artifacts.files.index(name) + 1, 'name': name, 'size': size, 'digest': digest,
                'state': 'uploaded', 'browser_download_url': f'https://github.com/{publish.REPO}/releases/download/{self.artifacts.tag}/{name}'}

    def call(self, token_scope, method, path, payload=None, body=None):
        self.calls.append((token_scope, method, path, payload))
        if token_scope == 'source':
            assert method == 'GET' and path == '/repos/' + publish.SOURCE_REPO
            return copy.deepcopy(self.source)
        if path == '/repos/' + publish.REPO:
            assert method == 'GET'
            return copy.deepcopy(self.repository)
        if '/commits/' in path:
            assert method == 'GET'
            return {'sha': 'abc'}
        if path.startswith(f'/repos/{publish.REPO}/releases?'):
            assert method == 'GET'
            page = int(parse_qs(urlparse(path).query)['page'][0])
            if page == 1:
                self.release_list_reads += 1
            if self.release_list_reads > 1 and self.new_release_during_upload:
                self.other_releases.append(self.new_release_during_upload)
                self.new_release_during_upload = None
            releases = ([self.release] if self.release else []) + self.other_releases
            return copy.deepcopy(releases[(page - 1) * 100:page * 100])
        if method == 'GET' and path.startswith(f'/repos/{publish.REPO}/releases/42/assets?'):
            return copy.deepcopy(self.assets)
        if method == 'GET' and path == f'/repos/{publish.REPO}/releases/42':
            if self.externally_published:
                self.release['draft'] = False
            return copy.deepcopy(self.release)
        if method == 'POST' and path == f'/repos/{publish.REPO}/releases':
            assert payload['draft'] is True
            self.release = self.new_release(True)
            return copy.deepcopy(self.release)
        if method == 'POST' and path.startswith('https://uploads.github.com/'):
            name = parse_qs(urlparse(path).query)['name'][0]
            assert name in self.artifacts.files and body == self.artifacts.read(name)
            asset = self.asset(name)
            if self.corrupt_upload:
                asset['digest'] = 'sha256:wrong'
            self.assets.append(asset)
            if self.lose_upload_response:
                self.lose_upload_response = False
                raise publish.GitHubError('Connection lost')
            return copy.deepcopy(asset)
        if method == 'DELETE' and '/releases/assets/' in path:
            asset_id = int(path.rsplit('/', 1)[1])
            self.assets = [asset for asset in self.assets if asset['id'] != asset_id]
            return None
        if method == 'PATCH' and path == f'/repos/{publish.REPO}/releases/42':
            assert len(self.assets) == 4 and all(self.artifacts.matches(asset) for asset in self.assets)
            assert payload == {'draft': False, 'make_latest': 'true'}
            self.release['draft'] = False
            return copy.deepcopy(self.release)
        raise AssertionError(f'Unexpected {token_scope} request: {method} {path}')

    def release_api(self, *args, **kwargs):
        return self.call('release', *args, **kwargs)

    def source_api(self, *args, **kwargs):
        return self.call('source', *args, **kwargs)

    def mutations(self):
        return [call for call in self.calls if call[1] != 'GET']


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'src-tauri').mkdir()
        (self.root / 'src-tauri/tauri.conf.json').write_text('{"version":"0.1.9"}')
        self.version = '0.1.10'
        self.directory = self.root / 'release' / self.version
        self.directory.mkdir(parents=True)
        archive = f'tabbit-2-demo_{self.version}_aarch64.app.tar.gz'
        (self.directory / archive).write_bytes(b'fake signed app archive')
        (self.directory / (archive + '.sig')).write_text('ZmFrZSBzaWduYXR1cmU=\n')
        (self.directory / f'Tabbit-2-Demo-{self.version}-arm64.dmg').write_bytes(b'fake dmg')
        self.manifest = {'version': self.version, 'notes': 'UI fixes', 'platforms': {'darwin-aarch64': {
            'url': f'https://github.com/{publish.REPO}/releases/download/v{self.version}/{archive}',
            'signature': 'ZmFrZSBzaWduYXR1cmU='}}}
        self.write_manifest()
        self.artifacts = publish.ReleaseArtifacts(self.root, self.version)

    def write_manifest(self):
        (self.directory / 'latest.json').write_text(json.dumps(self.manifest))

    def run_release(self, remote, **kwargs):
        return publish.publish_release(self.artifacts, remote.release_api, remote.source_api,
                                       sleep=lambda seconds: None, log=lambda *args, **kw: None, **kwargs)

    def prepare_real_signature_fixture(self):
        # Generate an ephemeral test key. Never read the real private signing key.
        result = subprocess.run(['node', '--input-type=module', '-e', '''
            import { generateKeyPairSync, sign } from 'node:crypto';
            const { publicKey, privateKey } = generateKeyPairSync('ed25519');
            const keyId = Buffer.from('0102030405060708', 'hex');
            const algorithm = Buffer.from('Ed');
            const rawKey = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
            const encodedKey = Buffer.concat([algorithm, keyId, rawKey]).toString('base64');
            const signature = sign(null, Buffer.from('fake signed app archive'), privateKey);
            const encodedSignature = Buffer.concat([algorithm, keyId, signature]).toString('base64');
            const comment = 'timestamp:1\\tversion:0.1.10';
            const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey).toString('base64');
            const encode = (text) => Buffer.from(text).toString('base64');
            console.log(JSON.stringify({
                publicKey: encode('untrusted comment: test public key\\n' + encodedKey + '\\n'),
                signature: encode('untrusted comment: test signature\\n' + encodedSignature + '\\ntrusted comment: ' + comment + '\\n' + global + '\\n'),
            }));
        '''], capture_output=True, text=True, check=True, timeout=15)
        fixture = json.loads(result.stdout)
        (self.root / 'scripts').mkdir()
        shutil.copyfile(publish.ROOT / 'scripts/verify-update-artifacts.mjs', self.root / 'scripts/verify-update-artifacts.mjs')
        config = {'version': self.version, 'plugins': {'updater': {
            'pubkey': fixture['publicKey'], 'requireSignedVersion': True}}}
        (self.root / 'src-tauri/tauri.conf.json').write_text(json.dumps(config))
        (self.directory / self.artifacts.files[1]).write_text(fixture['signature'] + '\n')
        self.manifest['platforms']['darwin-aarch64']['signature'] = fixture['signature']
        self.write_manifest()
        self.artifacts = publish.ReleaseArtifacts(self.root, self.version)

    def test_cli_rejects_invalid_archive_signature_before_credentials_or_network_in_both_modes(self):
        self.prepare_real_signature_fixture()
        (self.directory / self.artifacts.files[0]).write_bytes(b'tampered archive')
        for mode in ['--publish', '--validate-only']:
            with self.subTest(mode=mode), patch.object(publish, 'ROOT', self.root), \
                    patch.object(publish, 'resolve_tokens') as credentials, \
                    patch.object(publish, 'GitHubAPI') as api, redirect_stderr(io.StringIO()) as errors:
                self.assertEqual(publish.main([mode, '--version', self.version]), 1)
                self.assertIn('signature verification failed', errors.getvalue())
                credentials.assert_not_called()
                api.assert_not_called()

    def test_cli_valid_signature_can_reach_read_only_repository_validation(self):
        self.prepare_real_signature_fixture()
        remote = Remote(self.artifacts)
        with patch.object(publish, 'ROOT', self.root), \
                patch.object(publish, 'resolve_tokens', return_value=('release', 'source')), \
                patch.object(publish, 'GitHubAPI', side_effect=[remote.release_api, remote.source_api]), \
                redirect_stdout(io.StringIO()) as output:
            self.assertEqual(publish.main(['--validate-only', '--version', self.version]), 0)
        self.assertTrue(json.loads(output.getvalue())['validated'])
        self.assertTrue(remote.calls)
        self.assertEqual(remote.mutations(), [])

    def test_explicit_version_uses_artifact_version_without_changing_config(self):
        self.assertEqual(self.artifacts.version, '0.1.10')
        self.assertEqual(json.loads((self.root / 'src-tauri/tauri.conf.json').read_text())['version'], '0.1.9')
        with self.assertRaises(publish.ReleaseError):
            publish.ReleaseArtifacts(self.root, '../0.1.10')

    def test_manifest_must_match_fixed_url_version_signature_and_platform(self):
        cases = [lambda: self.manifest.update(version='0.1.11'),
                 lambda: self.manifest['platforms']['darwin-aarch64'].update(signature='other'),
                 lambda: self.manifest['platforms']['darwin-aarch64'].update(url='https://example.com/app'),
                 lambda: self.manifest['platforms'].update({'windows-x86_64': {}})]
        initial = copy.deepcopy(self.manifest)
        for change in cases:
            with self.subTest(change=change):
                self.manifest = copy.deepcopy(initial)
                change()
                self.write_manifest()
                with self.assertRaises(publish.ReleaseError):
                    publish.ReleaseArtifacts(self.root, self.version)

    def test_dry_run_is_read_only_and_uses_separate_repo_credentials(self):
        remote = Remote(self.artifacts)
        result = self.run_release(remote, validate_only=True)
        self.assertTrue(result['validated'])
        self.assertFalse(result['remoteChanges'])
        self.assertEqual(remote.mutations(), [])
        self.assertFalse((self.directory / 'publish-receipt.json').exists())
        self.assertFalse(any('/user' in call[2] for call in remote.calls))
        self.assertTrue(any(call[0] == 'source' for call in remote.calls))
        self.assertTrue(any(call[0] == 'release' for call in remote.calls))

    def test_app_access_without_reported_push_permission_is_not_overstated(self):
        remote = Remote(self.artifacts)
        remote.repository.pop('permissions')
        result = self.run_release(remote, validate_only=True)
        self.assertEqual(result['writePermission'], 'not_reported_by_api')
        self.assertEqual(remote.mutations(), [])

    def test_repository_identity_visibility_and_reported_write_denial_stop_before_mutation(self):
        cases = [('source', 'private', False), ('repository', 'private', True),
                 ('source', 'full_name', 'other/source'), ('repository', 'full_name', 'other/updates'),
                 ('repository', 'permissions', {'push': False}), ('repository', 'archived', True)]
        for target, key, value in cases:
            with self.subTest(target=target, key=key):
                remote = Remote(self.artifacts)
                getattr(remote, target)[key] = value
                with self.assertRaises(publish.ReleaseError):
                    self.run_release(remote)
                self.assertEqual(remote.mutations(), [])

    def test_missing_target_never_creates_repository(self):
        remote = Remote(self.artifacts)
        def missing(method, path, **kwargs):
            if path == '/repos/' + publish.REPO:
                raise publish.GitHubError('Missing repository', 404)
            return remote.release_api(method, path, **kwargs)
        with self.assertRaises(publish.GitHubError):
            publish.publish_release(self.artifacts, missing, remote.source_api)
        self.assertEqual(remote.mutations(), [])

    def test_publishes_only_four_files_and_only_after_digest_validation(self):
        remote = Remote(self.artifacts)
        (self.directory / 'source-code.zip').write_bytes(b'never upload')
        receipt = self.run_release(remote)
        changes = remote.mutations()
        self.assertEqual([call[1] for call in changes], ['POST'] * 5 + ['PATCH'])
        self.assertEqual(changes[0][3]['draft'], True)
        self.assertEqual({asset['name'] for asset in remote.assets}, set(self.artifacts.files))
        self.assertEqual(receipt['version'], '0.1.10')
        self.assertTrue((self.directory / 'publish-receipt.json').exists())

    def test_published_mismatch_is_never_changed_including_validate_only(self):
        for dry in [False, True]:
            with self.subTest(validate_only=dry):
                remote = Remote(self.artifacts, draft=False)
                remote.assets = [remote.asset(name) for name in self.artifacts.files]
                remote.assets[0]['digest'] = 'sha256:other'
                with self.assertRaises(publish.ReleaseError):
                    self.run_release(remote, validate_only=dry)
                self.assertEqual(remote.mutations(), [])

    def test_existing_identical_published_release_is_idempotent(self):
        remote = Remote(self.artifacts, draft=False)
        remote.assets = [remote.asset(name) for name in self.artifacts.files]
        self.run_release(remote)
        self.assertEqual(remote.mutations(), [])

    def test_older_or_equal_new_and_draft_versions_are_rejected_without_mutation(self):
        for draft in [None, True]:
            for tag in ['v0.1.11', 'v1.0.0', '0.1.10', 'v0.1.10+build.2']:
                for dry in [False, True]:
                    with self.subTest(draft=draft, tag=tag, validate_only=dry):
                        remote = Remote(self.artifacts, draft=draft)
                        remote.other_releases = [{'tag_name': tag, 'draft': False, 'prerelease': False}]
                        with self.assertRaisesRegex(publish.ReleaseError, 'must be newer'):
                            self.run_release(remote, validate_only=dry)
                        self.assertEqual(remote.mutations(), [])

    def test_numeric_version_order_and_ignoring_unpublished_versions(self):
        remote = Remote(self.artifacts)
        remote.other_releases = [{'tag_name': 'v0.1.9', 'draft': False, 'prerelease': False},
                                 {'tag_name': 'v99.0.0', 'draft': True, 'prerelease': False},
                                 {'tag_name': 'v100.0.0-rc.1', 'draft': False, 'prerelease': True}]
        self.run_release(remote)
        self.assertFalse(remote.release['draft'])

    def test_unknown_stable_tag_requires_manual_review_before_any_mutation(self):
        for tag in ['latest', 'release-0.1.9', 'v0.1', 'v0.01.9', None]:
            with self.subTest(tag=tag):
                remote = Remote(self.artifacts)
                remote.other_releases = [{'tag_name': tag, 'draft': False, 'prerelease': False}]
                with self.assertRaises(publish.ReleaseError):
                    self.run_release(remote)
                self.assertEqual(remote.mutations(), [])

    def test_historical_identical_published_tag_remains_read_only_and_idempotent(self):
        remote = Remote(self.artifacts, draft=False)
        remote.assets = [remote.asset(name) for name in self.artifacts.files]
        remote.other_releases = [{'tag_name': 'v0.2.0', 'draft': False, 'prerelease': False}]
        self.run_release(remote)
        self.assertEqual(remote.mutations(), [])

    def test_newer_release_published_during_upload_leaves_older_draft_unpublished(self):
        remote = Remote(self.artifacts)
        remote.new_release_during_upload = {'tag_name': 'v0.1.11', 'draft': False, 'prerelease': False}
        with self.assertRaisesRegex(publish.ReleaseError, 'must be newer'):
            self.run_release(remote)
        self.assertEqual(len(remote.assets), 4)
        self.assertTrue(remote.release['draft'])
        self.assertFalse(any(call[1] == 'PATCH' for call in remote.calls))

    def test_newer_stable_release_on_later_page_blocks_publication(self):
        remote = Remote(self.artifacts)
        remote.other_releases = [{'tag_name': f'draft-{n}', 'draft': True} for n in range(100)]
        remote.other_releases.append({'tag_name': 'v0.1.11', 'draft': False, 'prerelease': False})
        with self.assertRaisesRegex(publish.ReleaseError, 'must be newer'):
            self.run_release(remote)
        self.assertEqual(remote.mutations(), [])

    def test_draft_resume_only_replaces_mismatched_whitelisted_file(self):
        remote = Remote(self.artifacts, draft=True)
        remote.assets = [remote.asset(name) for name in self.artifacts.files]
        remote.assets[2]['digest'] = 'sha256:other'
        self.run_release(remote)
        self.assertEqual([call[1] for call in remote.mutations()], ['DELETE', 'POST', 'PATCH'])

    def test_unknown_remote_asset_aborts_without_deleting_it(self):
        remote = Remote(self.artifacts, draft=True)
        remote.assets = [{'id': 99, 'name': 'source-code.zip'}]
        with self.assertRaises(publish.ReleaseError):
            self.run_release(remote)
        self.assertEqual(remote.mutations(), [])

    def test_concurrently_published_release_is_not_mutated(self):
        remote = Remote(self.artifacts, draft=True)
        remote.assets = [remote.asset(name) for name in self.artifacts.files]
        remote.assets[0]['digest'] = 'sha256:other'
        remote.externally_published = True
        with self.assertRaises(publish.ReleaseError):
            self.run_release(remote)
        self.assertEqual(remote.mutations(), [])

    def test_upload_response_lost_after_acceptance_does_not_upload_twice(self):
        remote = Remote(self.artifacts)
        remote.lose_upload_response = True
        self.run_release(remote)
        uploads = [call for call in remote.mutations() if call[2].startswith('https://uploads.github.com/')]
        self.assertEqual(len(uploads), 4)
        self.assertEqual(len(remote.assets), 4)

    def test_checksum_failure_leaves_draft_unpublished(self):
        remote = Remote(self.artifacts)
        remote.corrupt_upload = True
        with self.assertRaises(publish.ReleaseError):
            self.run_release(remote)
        self.assertTrue(remote.release['draft'])
        self.assertFalse(any(call[1] == 'PATCH' for call in remote.calls))

    def test_local_artifact_change_is_detected_before_upload(self):
        (self.directory / self.artifacts.files[0]).write_bytes(b'changed after validation')
        remote = Remote(self.artifacts)
        with self.assertRaises(publish.ReleaseError):
            self.run_release(remote)
        self.assertFalse(any(call[2].startswith('https://uploads.github.com/') for call in remote.calls))
        self.assertTrue(remote.release['draft'])


class CredentialTests(unittest.TestCase):
    def test_semver_precedence_is_strict_and_not_float_or_lexicographic(self):
        versions = ['1.9.9', '1.10.0-alpha', '1.10.0-alpha.1', '1.10.0-alpha.2',
                    '1.10.0-alpha.10', '1.10.0-beta', '1.10.0-rc.1', '1.10.0', '2.0.0']
        keys = [publish.version_precedence(version) for version in versions]
        self.assertEqual(sorted(keys), keys)
        self.assertEqual(publish.version_precedence('1.10.0+build.1'), publish.version_precedence('1.10.0'))
        for version in ['1.2', '01.2.3', '1.2.3-01', '1.2.3-', '1.2.3-alpha..1']:
            with self.assertRaises(publish.ReleaseError):
                publish.version_precedence(version)

    def test_explicit_tokens_are_separate_and_need_no_local_helper(self):
        def no_helper():
            self.fail('Should not invoke local helper in CI')
        self.assertEqual(publish.resolve_tokens({'TABBIT_RELEASE_TOKEN': 'release', 'GITHUB_TOKEN': 'source'}, no_helper), ('release', 'source'))
        self.assertEqual(publish.resolve_tokens({'GH_TOKEN': 'local'}, no_helper), ('local', 'local'))

    def test_local_git_fallback_and_release_only_fallback(self):
        self.assertEqual(publish.resolve_tokens({}, lambda: 'git-token'), ('git-token', 'git-token'))
        self.assertEqual(publish.resolve_tokens({'TABBIT_RELEASE_TOKEN': 'app'}, lambda: 'git-token'), ('app', 'git-token'))
        self.assertEqual(publish.resolve_tokens({'TABBIT_RELEASE_TOKEN': 'both'}, lambda: None), ('both', 'both'))
        with self.assertRaises(publish.ReleaseError):
            publish.resolve_tokens({}, lambda: None)

    def test_api_blocks_untrusted_urls_before_sending_credentials(self):
        def never_open(*args, **kwargs):
            self.fail('Untrusted endpoint must not be called')
        api = publish.GitHubAPI('secret', opener=never_open)
        for url in ['https://evil.example/api', 'https://api.github.com@evil.example/', 'https://secret@api.github.com/']:
            with self.assertRaises(publish.ReleaseError):
                api('GET', url)

    def test_http_and_network_errors_do_not_expose_credentials_or_response_bodies(self):
        errors = [HTTPError('https://api.github.com/', 403, 'SECRET-TOKEN', {}, io.BytesIO(b'SECRET-TOKEN')),
                  URLError('SECRET-TOKEN'), TimeoutError('SECRET-TOKEN'), HTTPException('SECRET-TOKEN')]
        for error in errors:
            with self.subTest(error=type(error).__name__):
                def fail(*args, **kwargs):
                    raise error
                with self.assertRaises(publish.GitHubError) as caught:
                    publish.GitHubAPI('SECRET-TOKEN', opener=fail)('GET', '/repos/example/repo')
                self.assertNotIn('SECRET-TOKEN', str(caught.exception))
                self.assertIsNone(caught.exception.__cause__)

    def test_pagination_finds_releases_beyond_first_hundred(self):
        calls = []
        def api(method, path):
            calls.append(path)
            return [{'id': value} for value in range(100)] if path.endswith('&page=1') else [{'id': 100}]
        self.assertEqual(len(publish.get_list(api, '/repos/example/releases')), 101)
        self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()

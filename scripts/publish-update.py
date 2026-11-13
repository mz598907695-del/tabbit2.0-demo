#!/usr/bin/env python3
"""Validate or publish four signed artifacts to the existing public update repository."""
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.parse import quote, urlparse
from urllib.error import HTTPError, URLError
from http.client import HTTPException
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'mz598907695-del'
REPO = f'{OWNER}/tabbit-demo-updates'
SOURCE_REPO = f'{OWNER}/tabbit2.0-demo'
API_HOSTS = {'api.github.com', 'uploads.github.com'}


class ReleaseError(Exception):
    """A safe, actionable error message that contains no credentials or response bodies."""


class GitHubError(ReleaseError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status
        self.retryable = status is None or status >= 500


def approved_api_url(url):
    parsed = urlparse(url)
    return parsed.scheme == 'https' and parsed.netloc in API_HOSTS and not parsed.username and not parsed.password


class SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        if not approved_api_url(newurl):
            raise ReleaseError('Refusing to send credentials outside GitHub API hosts')
        return super().redirect_request(request, response, code, message, headers, newurl)


class GitHubAPI:
    def __init__(self, token, opener=None):
        self._token = token
        self._open = opener or build_opener(SafeRedirectHandler()).open

    def __call__(self, method, path, payload=None, body=None):
        url = path if path.startswith('https://') else 'https://api.github.com' + path
        if not approved_api_url(url):
            raise ReleaseError('Refusing to send credentials outside GitHub API hosts')
        headers = {'Authorization': 'Bearer ' + self._token, 'Accept': 'application/vnd.github+json',
                   'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Tabbit-demo-updater-release'}
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode()
            headers['Content-Type'] = 'application/json'
        elif body is not None:
            headers['Content-Type'] = 'application/octet-stream'
        try:
            with self._open(Request(url, data=body, headers=headers, method=method),
                            timeout=180 if body and len(body) > 1000000 else 30) as response:
                data = response.read()
                return json.loads(data) if data else None
        except HTTPError as error:
            status = error.code
            error.close()
            raise GitHubError(f'GitHub API {method} failed (HTTP {status}); check repository access and token permissions', status) from None
        except (URLError, TimeoutError, OSError, HTTPException):
            raise GitHubError(f'GitHub API {method} could not complete; check the network and retry') from None
        except (ValueError, UnicodeError):
            raise GitHubError('GitHub API returned an invalid response') from None


def git_credential_token():
    try:
        result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
                                capture_output=True, text=True, timeout=15,
                                env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    credential = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    return credential.get('password')


def resolve_tokens(env=None, credential_loader=git_credential_token):
    env = os.environ if env is None else env
    release_token = env.get('TABBIT_RELEASE_TOKEN') or env.get('GH_TOKEN') or env.get('GITHUB_TOKEN')
    source_token = env.get('GITHUB_TOKEN') or env.get('GH_TOKEN')
    if not release_token or not source_token:
        fallback = credential_loader()
        release_token = release_token or fallback
        source_token = source_token or fallback or release_token
    if not release_token or not source_token:
        raise ReleaseError('No GitHub credential is available; configure TABBIT_RELEASE_TOKEN and GITHUB_TOKEN, or a local GH_TOKEN/git credential')
    return release_token, source_token


class ReleaseArtifacts:
    def __init__(self, root, version=None):
        self.root = Path(root)
        if version is None:
            version = json.loads((self.root / 'src-tauri/tauri.conf.json').read_text())['version']
        if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', version):
            raise ReleaseError('Expected a release version such as 0.1.10')
        self.version = version
        self.tag = 'v' + version
        self.directory = self.root / 'release' / version
        archive = f'tabbit-2-demo_{version}_aarch64.app.tar.gz'
        self.files = [archive, archive + '.sig', f'Tabbit-2-Demo-{version}-arm64.dmg', 'latest.json']
        self.expected = {}
        for name in self.files:
            file = self.directory / name
            if not file.is_file():
                raise ReleaseError(f'Missing release artifact: {name}')
            self.expected[name] = (file.stat().st_size, 'sha256:' + hashlib.sha256(file.read_bytes()).hexdigest())
        self.manifest = json.loads((self.directory / 'latest.json').read_text())
        platforms = self.manifest.get('platforms', {})
        platform = platforms.get('darwin-aarch64', {})
        signature = (self.directory / (archive + '.sig')).read_text().strip()
        if (self.manifest.get('version') != version or set(platforms) != {'darwin-aarch64'}
                or not signature or platform.get('signature') != signature):
            raise ReleaseError('Release version, platform or signature mismatch')
        expected_url = f'https://github.com/{REPO}/releases/download/{self.tag}/{archive}'
        if platform.get('url') != expected_url:
            raise ReleaseError('Manifest download URL does not match the approved update repository')

    def matches(self, asset):
        expected = self.expected.get(asset.get('name'))
        return bool(expected and asset.get('state') == 'uploaded'
                    and (asset.get('size'), asset.get('digest')) == expected)

    def read(self, name):
        # Recheck immediately before upload in case a build replaced the files mid-release.
        body = (self.directory / name).read_bytes()
        if (len(body), 'sha256:' + hashlib.sha256(body).hexdigest()) != self.expected[name]:
            raise ReleaseError(f'Release artifact changed during publication: {name}')
        return body


def verify_artifact_signature(artifacts):
    # The local CLI must enforce the same cryptographic gate as CI before reading
    # credentials or touching GitHub. This verifier uses only the configured public key.
    try:
        result = subprocess.run(
            ['node', str((artifacts.root / 'scripts/verify-update-artifacts.mjs').resolve()), '--version', artifacts.version],
            cwd=artifacts.root, capture_output=True, text=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise ReleaseError('Artifact signature verification timed out; no GitHub access was attempted') from None
    except OSError:
        raise ReleaseError('Cannot start artifact signature verifier; install Node.js and retry. No GitHub access was attempted') from None
    if result.returncode != 0:
        # Do not echo arbitrary subprocess output; the standalone verifier supplies
        # local diagnostic details without exposing release credentials here.
        raise ReleaseError(
            'Cryptographic artifact signature verification failed; run node scripts/verify-update-artifacts.mjs '
            f'--version {artifacts.version} for details. No GitHub access was attempted'
        )


def verify_repository(repository, full_name, private):
    if not isinstance(repository, dict) or repository.get('full_name', '').lower() != full_name.lower():
        raise ReleaseError('Repository identity does not match the configured release destination/source')
    if repository.get('private') is not private:
        raise ReleaseError('Source repository must remain private and update repository must remain public')


def get_list(api, path):
    items, page = [], 1
    while True:
        chunk = api('GET', f'{path}?per_page=100&page={page}')
        if not isinstance(chunk, list):
            raise ReleaseError('GitHub API returned an invalid list response')
        items.extend(chunk)
        if len(chunk) < 100:
            return items
        page += 1


def release_assets(api, release):
    return get_list(api, f'/repos/{REPO}/releases/{release["id"]}/assets')


def require_draft(api, release, tag):
    current = api('GET', f'/repos/{REPO}/releases/{release["id"]}')
    if current.get('tag_name') != tag or current.get('draft') is not True:
        raise ReleaseError('Release is no longer the expected draft; refusing to alter published artifacts')


def version_precedence(version):
    # Compare SemVer integers and prerelease identifiers; build metadata has no precedence.
    match = re.fullmatch(
        r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'
        r'(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?'
        r'(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?', version or '')
    if not match:
        raise ReleaseError('Release version is not valid SemVer; review the release versions before publishing')
    identifiers = []
    if match[4] is not None:
        for value in match[4].split('.'):
            if value.isdigit():
                if len(value) > 1 and value.startswith('0'):
                    raise ReleaseError('Release version is not valid SemVer; prerelease numbers cannot have leading zeros')
                identifiers.append((0, int(value)))
            else:
                identifiers.append((1, value))
    return (int(match[1]), int(match[2]), int(match[3]), match[4] is None, tuple(identifiers))


def require_newer_stable_release(artifacts, releases):
    candidate = version_precedence(artifacts.version)
    for release in releases:
        if release.get('draft') or release.get('prerelease') or release.get('tag_name') == artifacts.tag:
            continue
        tag = release.get('tag_name')
        if not isinstance(tag, str):
            raise ReleaseError('Published release has an unrecognized version tag; review existing releases')
        published = version_precedence(tag[1:] if tag.startswith('v') else tag)
        if candidate <= published:
            raise ReleaseError('Release version must be newer than every published stable release; refusing to move latest backwards')


def verify_asset_set(artifacts, assets, complete=False):
    names = [asset.get('name') for asset in assets]
    if len(names) != len(set(names)) or set(names) - set(artifacts.files):
        raise ReleaseError('Release contains files outside the four-artifact whitelist; refusing to change it')
    if complete and (set(names) != set(artifacts.files) or not all(artifacts.matches(asset) for asset in assets)):
        raise ReleaseError('Published release differs from local output; use a new version instead of overwriting it')


def publish_release(artifacts, release_api, source_api, *, validate_only=False, sleep=time.sleep, log=print):
    # Credentials may belong to collaborators or an App. Authorize by the fixed repositories,
    # not /user or a personal account name; never create or change repository visibility.
    verify_repository(source_api('GET', '/repos/' + SOURCE_REPO), SOURCE_REPO, True)
    repository = release_api('GET', '/repos/' + REPO)
    verify_repository(repository, REPO, False)
    if repository.get('archived') or repository.get('disabled'):
        raise ReleaseError('Update repository is archived or disabled')
    permissions = repository.get('permissions', {})
    if permissions.get('push') is False:
        raise ReleaseError('Release credential does not have write permission on the update repository')
    branch = repository.get('default_branch')
    if not branch:
        raise ReleaseError('Update repository has no default branch')
    release_api('GET', '/repos/' + REPO + '/commits/' + quote(branch, safe=''))
    releases = get_list(release_api, f'/repos/{REPO}/releases')
    release = next((item for item in releases if item.get('tag_name') == artifacts.tag), None)
    assets = release_assets(release_api, release) if release else []
    verify_asset_set(artifacts, assets, complete=bool(release and not release['draft']))
    if release is None or release['draft']:
        require_newer_stable_release(artifacts, releases)
    if validate_only:
        return {'validated': True, 'version': artifacts.version, 'sourceRepository': SOURCE_REPO,
                'updateRepository': REPO, 'sourcePrivate': True, 'updatePublic': True,
                'writePermission': 'reported' if permissions.get('push') else 'not_reported_by_api',
                'releaseState': 'draft' if release and release['draft'] else 'published' if release else 'new',
                'files': artifacts.files, 'remoteChanges': False}

    if release is None:
        log('Preparing draft release: ' + artifacts.tag, flush=True)
        release = release_api('POST', f'/repos/{REPO}/releases', payload={
            'tag_name': artifacts.tag, 'target_commitish': branch, 'name': 'Tabbit 2 Demo ' + artifacts.version,
            'body': artifacts.manifest.get('notes', 'Tabbit 2 Demo ' + artifacts.version)
                    + '\n\n适用于 Apple Silicon Mac。首次安装请下载 DMG，并将应用拖入「应用程序」。已有用户可通过应用内更新升级，保留本机空间、壁纸和快捷方式设置。\n\n本仓库仅发布安装和更新文件。',
            'draft': True, 'prerelease': False,
        })
    for name in artifacts.files:
        assets = release_assets(release_api, release)
        verify_asset_set(artifacts, assets)
        existing = next((asset for asset in assets if asset['name'] == name), None)
        if existing and artifacts.matches(existing):
            log('Verified existing artifact: ' + name, flush=True)
            continue
        if not release['draft']:
            raise ReleaseError('Published release changed during publication; refusing to alter it')
        body = artifacts.read(name)
        if existing:
            require_draft(release_api, release, artifacts.tag)
            release_api('DELETE', f'/repos/{REPO}/releases/assets/{existing["id"]}')
        log(f'Uploading: {name} ({len(body)} bytes)', flush=True)
        for attempt in range(3):
            require_draft(release_api, release, artifacts.tag)
            try:
                uploaded = release_api('POST', f'https://uploads.github.com/repos/{REPO}/releases/{release["id"]}/assets?name={quote(name)}', body=body)
                if not artifacts.matches(uploaded):
                    raise ReleaseError('Uploaded artifact checksum differs; release remains unpublished')
                break
            except GitHubError as error:
                if not error.retryable:
                    raise
                assets = release_assets(release_api, release)
                verify_asset_set(artifacts, assets)
                recovered = next((asset for asset in assets if asset['name'] == name), None)
                if recovered and artifacts.matches(recovered):
                    break
                if recovered:
                    require_draft(release_api, release, artifacts.tag)
                    release_api('DELETE', f'/repos/{REPO}/releases/assets/{recovered["id"]}')
                if attempt == 2:
                    raise
                sleep(attempt + 1)
        log('Checksum verified: ' + name, flush=True)

    assets = release_assets(release_api, release)
    verify_asset_set(artifacts, assets, complete=True)
    verify_repository(source_api('GET', '/repos/' + SOURCE_REPO), SOURCE_REPO, True)
    verify_repository(release_api('GET', '/repos/' + REPO), REPO, False)
    if release['draft']:
        require_draft(release_api, release, artifacts.tag)
        # Another publisher may have released a newer version while these files uploaded.
        require_newer_stable_release(artifacts, get_list(release_api, f'/repos/{REPO}/releases'))
        release = release_api('PATCH', f'/repos/{REPO}/releases/{release["id"]}', payload={'draft': False, 'make_latest': 'true'})
    # Final tag download URLs replace temporary draft URLs after publication.
    assets = release_assets(release_api, release)
    verify_asset_set(artifacts, assets, complete=True)
    receipt = {'repository': f'https://github.com/{REPO}', 'release': release['html_url'],
               'version': artifacts.version, 'files': [{'name': asset['name'], 'url': asset['browser_download_url'],
                                                       'digest': asset['digest']} for asset in assets], 'sourcePrivate': True}
    (artifacts.directory / 'publish-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--publish', action='store_true', help='Upload artifacts and publish the release')
    mode.add_argument('--validate-only', '--dry-run', action='store_true', help='Validate artifacts/repository access using read-only requests')
    parser.add_argument('--version', help='Artifact version in release/<version>; defaults to tauri.conf.json')
    args = parser.parse_args(argv)
    try:
        artifacts = ReleaseArtifacts(ROOT, args.version)
        verify_artifact_signature(artifacts)
        release_token, source_token = resolve_tokens()
        receipt = publish_release(artifacts, GitHubAPI(release_token), GitHubAPI(source_token), validate_only=args.validate_only)
        print(json.dumps(receipt, ensure_ascii=False), flush=True)
        return 0
    except ReleaseError as error:
        print(f'Release stopped: {error}', file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError):
        # Do not echo arbitrary credential-helper output, HTTP response bodies or request headers.
        print('Release stopped: invalid or unreadable release metadata/artifacts', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

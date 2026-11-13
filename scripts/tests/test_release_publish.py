"""Run the real publisher against fake GitHub responses, with dummy credentials."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlparse

SCRIPT = Path(__file__).resolve().parents[1] / 'publish-update.py'
OWNER = 'mz598907695-del'
SOURCE = f'/repos/{OWNER}/tabbit2.0-demo'
UPDATES = f'/repos/{OWNER}/tabbit-demo-updates'


class PublishCredentialsTest(unittest.TestCase):
    def execute(self, source_private=True, separate_source=True):
        with tempfile.TemporaryDirectory(prefix='tabbit-publish-auth-test-') as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            (root / 'scripts/publish-update.py').write_text(SCRIPT.read_text())
            (root / 'src-tauri').mkdir()
            (root / 'src-tauri/tauri.conf.json').write_text(json.dumps({'version':'0.2.0'}))
            directory = root / 'release/0.2.0'
            directory.mkdir(parents=True)
            archive = 'tabbit-2-demo_0.2.0_aarch64.app.tar.gz'
            manifest = {'version':'0.2.0', 'platforms':{'darwin-aarch64':{
                'signature':'test-signature',
                'url':f'https://github.com/{OWNER}/tabbit-demo-updates/releases/download/v0.2.0/{archive}',
            }}}
            files = {archive:b'archive', archive+'.sig':b'test-signature', 'Tabbit-2-Demo-0.2.0-arm64.dmg':b'dmg', 'latest.json':json.dumps(manifest).encode()}
            assets = []
            for name, body in files.items():
                (directory / name).write_bytes(body)
                assets.append({'name':name, 'state':'uploaded', 'size':len(body), 'digest':'sha256:'+hashlib.sha256(body).hexdigest(), 'browser_download_url':'https://github.com/example/'+name})
            requests = []
            def response(request, **_):
                parsed = urlparse(request.full_url)
                self.assertEqual(parsed.netloc, 'api.github.com')
                self.assertEqual(request.get_method(), 'GET', 'Matching published files must never be mutated')
                expected = 'source-only' if parsed.path == SOURCE and separate_source else 'updates-only'
                self.assertEqual(request.get_header('Authorization'), 'Bearer '+expected)
                requests.append(parsed.path)
                if parsed.path == '/user':
                    value = {'login':OWNER}
                elif parsed.path == SOURCE:
                    value = {'private':source_private}
                elif parsed.path == UPDATES:
                    value = {'private':False, 'owner':{'login':OWNER}, 'default_branch':'main', 'html_url':'https://github.com'+UPDATES.removeprefix('/repos')}
                elif parsed.path == UPDATES+'/commits/main':
                    value = {'sha':'test'}
                elif parsed.path == UPDATES+'/releases':
                    value = [{'id':1, 'tag_name':'v0.2.0', 'draft':False, 'html_url':'https://github.com/example/release'}]
                elif parsed.path == UPDATES+'/releases/1/assets':
                    value = assets
                else:
                    raise AssertionError('Unexpected GitHub request: '+parsed.path)
                return contextlib.closing(io.BytesIO(json.dumps(value).encode()))
            environment = {'TABBIT_RELEASE_TOKEN':'updates-only'}
            if separate_source:
                environment['TABBIT_SOURCE_TOKEN'] = 'source-only'
            with patch.dict(os.environ,environment,clear=True), patch('sys.argv',['publish-update.py','--publish']), patch('urllib.request.urlopen',side_effect=response), patch('subprocess.run',side_effect=AssertionError('CI must not query local git credentials')), contextlib.redirect_stdout(io.StringIO()):
                runpy.run_path(str(root / 'scripts/publish-update.py'),run_name='__main__')
            self.assertTrue((directory / 'publish-receipt.json').is_file())
            self.assertEqual(requests.count(SOURCE),2)

    def test_ci_keeps_source_token_out_of_update_repo_requests(self):
        self.execute()

    def test_existing_single_credential_local_releases_still_work(self):
        self.execute(separate_source=False)

    def test_public_source_repository_is_rejected_before_publication(self):
        with self.assertRaisesRegex(SystemExit,'privacy'):
            self.execute(source_private=False)

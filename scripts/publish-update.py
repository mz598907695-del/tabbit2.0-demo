#!/usr/bin/env python3
"""Explicitly publish only the four signed release artifacts; never upload source."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote, urlparse
from urllib.error import HTTPError, URLError
import argparse
import hashlib
import json
import os
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--publish', action='store_true', required=True, help='Explicitly authorize publication to the public update repository')
parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'src-tauri/tauri.conf.json').read_text())
VERSION = CONFIG['version']
OWNER = 'mz598907695-del'
REPO = f'{OWNER}/tabbit-demo-updates'
SOURCE_REPO = f'{OWNER}/tabbit2.0-demo'
TAG = 'v' + VERSION
DIRECTORY = ROOT / 'release' / VERSION
ARCHIVE = f'tabbit-2-demo_{VERSION}_aarch64.app.tar.gz'
FILES = [ARCHIVE, ARCHIVE + '.sig', f'Tabbit-2-Demo-{VERSION}-arm64.dmg', 'latest.json']
EXPECTED = {}
for name in FILES:
    file = DIRECTORY / name
    if not file.is_file():
        raise SystemExit(f'Missing release artifact: {name}')
    EXPECTED[name] = (file.stat().st_size, 'sha256:' + hashlib.sha256(file.read_bytes()).hexdigest())
manifest = json.loads((DIRECTORY / 'latest.json').read_text())
if manifest['version'] != VERSION or manifest['platforms']['darwin-aarch64']['signature'] != (DIRECTORY / (ARCHIVE + '.sig')).read_text().strip():
    raise SystemExit('Release version or signature mismatch')
expected_url = f'https://github.com/{REPO}/releases/download/{TAG}/{ARCHIVE}'
if manifest['platforms']['darwin-aarch64']['url'] != expected_url:
    raise SystemExit('Manifest download URL does not match the approved update repository')

token = os.environ.get('TABBIT_RELEASE_TOKEN') or os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
if not token:
    result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True, env={**os.environ, 'GIT_TERMINAL_PROMPT':'0'})
    credential = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    token = credential.get('password')
if not token:
    raise SystemExit('No GitHub credential is available; no repository or release was changed')
# CI uses its repository-scoped GITHUB_TOKEN to check the private source repo;
# the publication PAT only needs Contents: write on the public update repo.
source_token = os.environ.get('TABBIT_SOURCE_TOKEN') or token


def api(method, path, payload=None, body=None):
    url = path if path.startswith('https://') else 'https://api.github.com' + path
    if urlparse(url).netloc not in {'api.github.com', 'uploads.github.com'}:
        raise RuntimeError('Refusing to send credentials outside GitHub API hosts')
    credential = source_token if urlparse(url).path == '/repos/' + SOURCE_REPO else token
    headers = {'Authorization':'Bearer ' + credential, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2026-03-10', 'User-Agent':'Tabbit-demo-updater-release'}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        headers['Content-Type'] = 'application/json'
    elif body is not None:
        headers['Content-Type'] = 'application/octet-stream'
    with urlopen(Request(url, data=body, headers=headers, method=method), timeout=180 if body and len(body) > 1000000 else 30) as response:
        data = response.read()
        return json.loads(data) if data else None


def optional(path):
    try:
        return api('GET', path)
    except HTTPError as error:
        if error.code == 404:
            return None
        raise


def matches(asset):
    size, digest = EXPECTED[asset['name']]
    return asset['state'] == 'uploaded' and asset['size'] == size and asset.get('digest') == digest


user = api('GET', '/user')
if user['login'].lower() != OWNER.lower():
    raise SystemExit('Authenticated account does not match the configured update repository owner')
source = api('GET', '/repos/' + SOURCE_REPO)
if not source['private']:
    raise SystemExit('Source repository privacy differs from the expected private setting; no release changes made')
repository = optional('/repos/' + REPO)
if repository is None:
    print('Creating public artifact-only repository:', REPO, flush=True)
    repository = api('POST', '/user/repos', {'name':'tabbit-demo-updates', 'description':'Tabbit 2 Demo installers and signed application updates. Source code is maintained separately.', 'private':False, 'auto_init':True, 'has_issues':False, 'has_projects':False, 'has_wiki':False})
elif repository['private']:
    raise SystemExit('A private repository already exists with the update repository name; refusing to expose its contents')
if repository['owner']['login'].lower() != OWNER.lower():
    raise SystemExit('Update repository owner mismatch')
branch = repository['default_branch']
for attempt in range(5):
    if optional('/repos/' + REPO + '/commits/' + quote(branch, safe='')):
        break
    time.sleep(1)
else:
    raise SystemExit('Repository initialization has not completed; retry this command later')

# A draft need not have created its Git tag yet; list releases to resume it safely.
release = next((item for item in api('GET', '/repos/' + REPO + '/releases?per_page=100') if item['tag_name'] == TAG), None)
if release is None:
    print('Preparing draft release:', TAG, flush=True)
    release = api('POST', '/repos/' + REPO + '/releases', {
        'tag_name':TAG, 'target_commitish':branch, 'name':'Tabbit 2 Demo ' + VERSION,
        'body':manifest.get('notes', 'Tabbit 2 Demo ' + VERSION) + '\n\n适用于 Apple Silicon Mac。首次安装请下载 DMG，并将应用拖入「应用程序」。已有用户可通过应用内更新升级，保留本机空间、壁纸和快捷方式设置。\n\n本仓库仅发布安装和更新文件。',
        'draft':True, 'prerelease':False,
    })

for name in FILES:
    existing = next((asset for asset in api('GET', f'/repos/{REPO}/releases/{release["id"]}/assets') if asset['name'] == name), None)
    if existing and matches(existing):
        print('Verified existing artifact:', name, flush=True)
        continue
    if not release['draft']:
        raise SystemExit(f'Published release artifact differs from local output: {name}; refusing to alter it')
    if existing:
        api('DELETE', f'/repos/{REPO}/releases/assets/{existing["id"]}')
    print('Uploading:', name, EXPECTED[name][0], 'bytes', flush=True)
    body = (DIRECTORY / name).read_bytes()
    for attempt in range(3):
        try:
            uploaded = api('POST', f'https://uploads.github.com/repos/{REPO}/releases/{release["id"]}/assets?name={quote(name)}', body=body)
            if not matches(uploaded):
                raise SystemExit('Uploaded artifact checksum differs: ' + name)
            break
        except (URLError, TimeoutError) as error:
            if isinstance(error, HTTPError) and error.code < 500:
                raise
            recovered = next((a for a in api('GET', f'/repos/{REPO}/releases/{release["id"]}/assets') if a['name'] == name), None)
            if recovered and matches(recovered):
                break
            if recovered:
                api('DELETE', f'/repos/{REPO}/releases/assets/{recovered["id"]}')
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    print('Checksum verified:', name, flush=True)

assets = api('GET', f'/repos/{REPO}/releases/{release["id"]}/assets')
if set(a['name'] for a in assets) != set(FILES) or not all(matches(a) for a in assets):
    raise SystemExit('Draft release file list or checksums differ; it remains unpublished')
if release['draft']:
    release = api('PATCH', f'/repos/{REPO}/releases/{release["id"]}', {'draft':False, 'make_latest':'true'})
# Publishing replaces GitHub's temporary draft asset URLs with the final tag URLs.
assets = api('GET', f'/repos/{REPO}/releases/{release["id"]}/assets')
if not api('GET', '/repos/' + SOURCE_REPO)['private']:
    raise SystemExit('Unexpected source repository privacy change')
receipt = {'repository':repository['html_url'], 'release':release['html_url'], 'version':VERSION, 'files':[{'name':a['name'], 'url':a['browser_download_url'], 'digest':a['digest']} for a in assets], 'sourcePrivate':True}
(DIRECTORY / 'publish-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(receipt, ensure_ascii=False), flush=True)

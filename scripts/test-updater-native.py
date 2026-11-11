#!/usr/bin/env python3
"""Exercise the real native updater against a local server and a disposable app."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import json
import plistlib
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'src-tauri/tauri.conf.json').read_text())
RELEASE = ROOT / 'release' / CONFIG['version']
MANIFEST = json.loads((RELEASE / 'latest.json').read_text())
ARCHIVE = next(RELEASE.glob('*.app.tar.gz'))
PROBE = ROOT / 'src-tauri/target/debug/examples/updater_smoke'
SOURCE_APP = ROOT / 'src-tauri/target/release/bundle/macos/tabbit-2-demo.app'

subprocess.run(['cargo', 'build', '--locked', '--example', 'updater_smoke'], cwd=ROOT / 'src-tauri', check=True)
data = ARCHIVE.read_bytes()
requests = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        request = urlparse(self.path)
        case = parse_qs(request.query).get('case', ['valid'])[0]
        requests.append((request.path, case))
        if request.path == '/latest.json':
            manifest = json.loads(json.dumps(MANIFEST))
            manifest['version'] = '0.1.1' if case == 'current' else '99.0.0' if case == 'wrong-version' else CONFIG['version']
            manifest['platforms']['darwin-aarch64']['url'] = f'http://127.0.0.1:{self.server.server_port}/app.tar.gz?case={case}'
            body = json.dumps(manifest).encode()
            mime = 'application/json'
        elif request.path == '/app.tar.gz':
            body = data[:-1] + bytes([data[-1] ^ 1]) if case == 'tampered' else data
            mime = 'application/gzip'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    with tempfile.TemporaryDirectory(prefix='tabbit-updater-smoke-') as directory:
        parent = Path(directory)
        fixture = parent / 'Tabbit Updater Smoke.app'
        subprocess.run(['ditto', str(SOURCE_APP), str(fixture)], check=True)
        info = fixture / 'Contents/Info.plist'
        metadata = plistlib.loads(info.read_bytes())
        metadata['CFBundleShortVersionString'] = '0.1.1'
        info.write_bytes(plistlib.dumps(metadata))
        sentinel = parent / 'profile.json'
        sentinel.write_text('{"wallpaper":"keep-my-choice","shortcutPage":2}')
        for case in ['current', 'tampered', 'wrong-version', 'valid']:
            endpoint = f'http://127.0.0.1:{server.server_port}/latest.json?case={case}'
            subprocess.run([str(PROBE), endpoint, str(fixture), case], cwd=ROOT / 'src-tauri', check=True, timeout=120)
            assert sentinel.read_text() == '{"wallpaper":"keep-my-choice","shortcutPage":2}'
        assert not any(path == '/app.tar.gz' and case == 'current' for path, case in requests)
        assert plistlib.loads(info.read_bytes())['CFBundleShortVersionString'] == CONFIG['version']
        print('PASS: no-update, tampered signature, signed-version mismatch, real download/install, unchanged external profile.')
finally:
    server.shutdown()
    server.server_close()
    thread.join()

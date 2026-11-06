#!/usr/bin/env python3
"""Capture this demo's desktop development defaults, never other apps' data."""
from pathlib import Path
import hashlib
import json
import sqlite3

project = Path(__file__).resolve().parents[1]
target = project / 'src/demo-defaults.json'
keys = [*(f'tabbit-glass-space:{i}' for i in range(5)),
        'personalized-home-2-0-preferences', 'personalized-home-2-0-board-v1',
        'personalized-home-2-0-board-index', 'personalized-home-2-0-board-active-id',
        'personalized-home-2-0-ai-workspace-variant',
        'personalized-home-2-0-ai-sidebar-width', 'personalized-home-2-0-ai-sidebar-width-default',
        'tabbit-vertical-sidebar-width']
root = Path.home() / 'Library/WebKit/tabbit-2-demo/WebsiteData/Default'
candidates = []
for path in root.rglob('localstorage.sqlite3') if root.exists() else []:
    try:
        with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
            rows = db.execute('SELECT key,value FROM ItemTable WHERE key IN (' + ','.join('?' for _ in keys) + ')', keys)
            values = {key: value.decode('utf-16-le') if isinstance(value, bytes) else value for key, value in rows}
        if 'tabbit-glass-space:0' in values:
            candidates.append(values)
    except (sqlite3.Error, UnicodeError):
        continue
if not candidates:
    if target.exists():
        print('No desktop development storage found; keeping bundled defaults.')
        raise SystemExit(0)
    raise SystemExit('No desktop development defaults found.')
values = max(candidates, key=len)
for key in keys[:5] + ['personalized-home-2-0-preferences', 'personalized-home-2-0-board-v1']:
    if key not in values:
        raise SystemExit(f'Missing required desktop default: {key}')
    json.loads(values[key])
body = json.dumps(values, ensure_ascii=False, sort_keys=True)
version = hashlib.sha256(body.encode()).hexdigest()[:12]
target.write_text(json.dumps({'version': version, 'storage': values}, ensure_ascii=False, indent=2) + '\n')
print(f'Captured {len(values)} demo settings; 5 space materials; snapshot {version}.')

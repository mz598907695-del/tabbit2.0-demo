import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('release publisher validates credentials, artifacts and publication boundaries', () => {
  const result = spawnSync('python3', ['-B', fileURLToPath(new URL('./test_publish_update.py', import.meta.url))], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

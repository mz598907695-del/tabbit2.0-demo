import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateController } from '../../src/updates/update-controller.js';
import { createUpdateManifest } from '../lib/update-manifest.mjs';

function fixture(overrides = {}) {
  const calls = { check:0, download:0, install:0, relaunch:0, close:0 };
  const candidate = {
    version:'0.1.3',
    async download(onEvent) { calls.download++; onEvent({ event:'Started', data:{ contentLength:100 } }); onEvent({ event:'Progress', data:{ chunkLength:60 } }); onEvent({ event:'Finished' }); },
    async install() { calls.install++; },
    async close() { calls.close++; },
    ...overrides,
  };
  const controller = createUpdateController({ check:async () => { calls.check++; return candidate; }, relaunch:async () => { calls.relaunch++; } });
  return { calls, candidate, controller };
}

test('background check downloads a verified update but never installs until requested', async () => {
  const { controller, calls } = fixture();
  await controller.checkForUpdates();
  assert.equal(controller.getSnapshot().phase, 'ready');
  assert.equal(controller.getSnapshot().received, 60);
  assert.equal(calls.install, 0); assert.equal(calls.relaunch, 0);
  controller.dismiss(); assert.equal(controller.getSnapshot().visible, false);
  await controller.checkForUpdates(); assert.equal(calls.check, 1);
  await controller.checkForUpdates({ manual:true }); assert.equal(controller.getSnapshot().visible, true);
  await controller.installUpdate();
  assert.equal(calls.install, 1); assert.equal(calls.relaunch, 1); assert.equal(calls.close, 1);
});

test('repeated manual and automatic checks share a single in-flight download', async () => {
  let finish;
  const { controller, calls } = fixture({ download:() => new Promise(resolve => { finish = resolve; }) });
  const first = controller.checkForUpdates();
  const second = controller.checkForUpdates({ manual:true });
  assert.equal(first, second);
  await Promise.resolve(); assert.equal(calls.check, 1);
  finish(); await first;
  assert.equal(controller.getSnapshot().phase, 'ready');
});

test('no-update and check failures stay quiet during automatic checks', async () => {
  let fail = false;
  const controller = createUpdateController({ check:async () => { if (fail) throw Error('offline'); return null; }, relaunch:async () => {} });
  await controller.checkForUpdates(); assert.equal(controller.getSnapshot().phase, 'current'); assert.equal(controller.getSnapshot().visible, false);
  fail = true; await controller.checkForUpdates(); assert.equal(controller.getSnapshot().phase, 'error'); assert.equal(controller.getSnapshot().visible, false);
  await controller.checkForUpdates({ manual:true }); assert.equal(controller.getSnapshot().visible, true);
});

test('a failed download/signature verification never reaches ready or install and releases resources', async () => {
  const { controller, calls } = fixture({ download:async onEvent => { onEvent({ event:'Finished' }); throw Error('bad signature'); } });
  await controller.checkForUpdates();
  assert.equal(controller.getSnapshot().phase, 'error'); assert.equal(controller.getSnapshot().error, 'download');
  await controller.installUpdate(); assert.equal(calls.install, 0); assert.equal(calls.close, 1);
});

test('failed relaunch retries only restart, without reinstalling the app', async () => {
  let installs = 0, restarts = 0;
  const controller = createUpdateController({ check:async () => ({ version:'0.1.3', download:async () => {}, install:async () => { installs++; }, close:async () => {} }), relaunch:async () => { if (++restarts === 1) throw Error('restart failed'); } });
  await controller.checkForUpdates(); await controller.installUpdate();
  assert.equal(controller.getSnapshot().phase, 'installed'); assert.equal(controller.getSnapshot().error, 'restart');
  await controller.restart(); assert.equal(installs, 1); assert.equal(restarts, 2);
});

test('failed installation keeps the verified download for retry and never restarts', async () => {
  let attempts = 0;
  const { controller, calls } = fixture({ install:async () => { if (++attempts === 1) throw Error('write denied'); } });
  await controller.checkForUpdates(); await controller.installUpdate();
  assert.equal(controller.getSnapshot().phase, 'ready'); assert.equal(controller.getSnapshot().error, 'install');
  assert.equal(calls.relaunch, 0); assert.equal(calls.close, 0);
  await controller.installUpdate(); assert.equal(attempts, 2); assert.equal(calls.relaunch, 1);
});

test('multiple clicks cannot install or restart the same update twice', async () => {
  let finish, installs = 0;
  const { controller, calls } = fixture({ install:() => { installs++; return new Promise(resolve => { finish = resolve; }); } });
  await controller.checkForUpdates();
  const first = controller.installUpdate(), second = controller.installUpdate();
  assert.equal(first, second); assert.equal(installs, 1);
  finish(); await first; assert.equal(calls.relaunch, 1);
});

test('release manifests require a real version, HTTPS URL and signature contents', () => {
  const args = { version:'0.1.3', url:'https://example.com/release/app.tar.gz', signature:'c2lnbmF0dXJl', date:new Date('2026-11-11T00:00:00Z') };
  assert.equal(createUpdateManifest(args).platforms['darwin-aarch64'].signature, args.signature);
  for (const invalid of [{ version:'latest' },{ url:'http://example.com/app.tar.gz' },{ url:'https://user:token@example.com/app.tar.gz' },{ signature:'/tmp/app.sig' },{ signature:'' }]) assert.throws(() => createUpdateManifest({ ...args, ...invalid }));
});

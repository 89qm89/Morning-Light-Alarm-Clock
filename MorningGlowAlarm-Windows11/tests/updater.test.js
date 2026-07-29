'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { createUpdateService, initialUpdateState } = require('../src/main/updater');
const { buildLatestYml } = require('../scripts/generate-update-info');

class FakeUpdater extends EventEmitter {
  async checkForUpdates() {
    this.emit('checking-for-update');
    return {};
  }

  quitAndInstall(...args) {
    this.installArgs = args;
  }
}

test('installed Windows app downloads and silently replaces the old version', async () => {
  const updater = new FakeUpdater();
  const states = [];
  const service = createUpdateService({
    packaged: true,
    platform: 'win32',
    portable: false,
    notify: (state) => states.push(state),
    updaterFactory: () => updater
  });

  await service.check();
  updater.emit('update-available', { version: '1.4.0' });
  updater.emit('download-progress', { percent: 48.6 });
  updater.emit('update-downloaded', { version: '1.4.0' });

  assert.equal(service.getState().status, 'ready');
  assert.equal(service.getState().percent, 100);
  assert.equal(service.install(), true);
  assert.deepEqual(updater.installArgs, [true, true]);
  assert.ok(states.some((state) => state.status === 'downloading' && state.percent === 49));
});

test('portable app keeps the manual download fallback', async () => {
  let created = false;
  const service = createUpdateService({
    packaged: true,
    platform: 'win32',
    portable: true,
    notify: () => {},
    updaterFactory: () => {
      created = true;
      return new FakeUpdater();
    }
  });

  assert.equal(created, false);
  assert.equal(service.getState().status, 'unsupported');
  assert.match(service.getState().message, /便携版/);
  assert.deepEqual(await service.check(), service.getState());
  assert.equal(service.install(), false);
});

test('initial update state is safe to display before the first check', () => {
  assert.deepEqual(initialUpdateState(), {
    status: 'idle',
    message: '可以检查是否有新版本',
    version: null,
    percent: 0,
    manualUrl: 'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases'
  });
});

test('latest.yml points the updater at the verified installer', () => {
  const output = buildLatestYml({
    version: '1.3.0',
    filename: 'Morning-Glow-Alarm-Setup-1.3.0-x64.exe',
    size: 123,
    sha512: 'example-sha512',
    releaseDate: '2026-07-29T00:00:00.000Z'
  });

  assert.match(output, /version: 1\.3\.0/);
  assert.match(output, /url: Morning-Glow-Alarm-Setup-1\.3\.0-x64\.exe/);
  assert.match(output, /sha512: example-sha512/);
  assert.match(output, /size: 123/);
});

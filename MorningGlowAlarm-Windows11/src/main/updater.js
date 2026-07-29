'use strict';

const { NsisUpdater } = require('electron-updater');

const UPDATE_FEED_URL =
  'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases/latest/download';
const RELEASES_URL =
  'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

function initialUpdateState() {
  return {
    status: 'idle',
    message: '可以检查是否有新版本',
    version: null,
    percent: 0,
    manualUrl: RELEASES_URL
  };
}

function createUpdateService({
  packaged,
  platform,
  portable,
  notify,
  updaterFactory = () => new NsisUpdater({
    provider: 'generic',
    url: UPDATE_FEED_URL
  })
}) {
  let state = initialUpdateState();
  let updater = null;
  let startTimer = null;
  let intervalTimer = null;
  let checkPromise = null;

  const publish = (patch) => {
    state = { ...state, ...patch };
    notify({ ...state });
    return { ...state };
  };

  const supported = packaged && platform === 'win32' && !portable;

  if (!supported) {
    const message = portable
      ? '便携版请在发布页下载新版'
      : packaged
        ? '当前系统暂不支持自动安装'
        : '开发版不会执行自动更新';
    publish({ status: 'unsupported', message });
  } else {
    updater = updaterFactory();
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.autoRunAppAfterInstall = true;
    updater.allowDowngrade = false;

    updater.on('checking-for-update', () => {
      publish({ status: 'checking', message: '正在检查新版本…', percent: 0 });
    });
    updater.on('update-available', (info) => {
      publish({
        status: 'available',
        message: `发现 v${info.version}，正在下载…`,
        version: info.version,
        percent: 0
      });
    });
    updater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
      publish({
        status: 'downloading',
        message: `正在下载 v${state.version || '新版'} · ${percent}%`,
        percent
      });
    });
    updater.on('update-not-available', () => {
      publish({
        status: 'up-to-date',
        message: '当前已经是最新版本',
        version: null,
        percent: 0
      });
    });
    updater.on('update-downloaded', (info) => {
      publish({
        status: 'ready',
        message: `v${info.version} 已准备好，可直接覆盖安装`,
        version: info.version,
        percent: 100
      });
    });
    updater.on('error', () => {
      publish({
        status: 'error',
        message: '暂时无法检查更新，请稍后重试',
        percent: 0
      });
    });
  }

  async function check() {
    if (!updater) return { ...state };
    if (checkPromise) return checkPromise;
    checkPromise = updater.checkForUpdates()
      .catch(() => publish({
        status: 'error',
        message: '暂时无法检查更新，请稍后重试',
        percent: 0
      }))
      .finally(() => {
        checkPromise = null;
      });
    await checkPromise;
    return { ...state };
  }

  function install() {
    if (!updater || state.status !== 'ready') return false;
    updater.quitAndInstall(true, true);
    return true;
  }

  function start() {
    if (!updater) return;
    startTimer = setTimeout(check, 8_000);
    startTimer.unref?.();
    intervalTimer = setInterval(check, CHECK_INTERVAL_MS);
    intervalTimer.unref?.();
  }

  function stop() {
    if (startTimer) clearTimeout(startTimer);
    if (intervalTimer) clearInterval(intervalTimer);
  }

  return {
    check,
    getState: () => ({ ...state }),
    install,
    start,
    stop
  };
}

module.exports = {
  createUpdateService,
  initialUpdateState,
  RELEASES_URL,
  UPDATE_FEED_URL
};

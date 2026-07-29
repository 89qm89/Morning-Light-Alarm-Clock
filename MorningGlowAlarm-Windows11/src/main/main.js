'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} = require('electron');
const { Store } = require('./store');
const {
  localDateKey,
  nextAlarm,
  shouldFire
} = require('../shared/scheduler');
const { createUpdateService } = require('./updater');

let mainWindow = null;
let ringWindow = null;
let tray = null;
let store = null;
let isQuitting = false;
let schedulerTimer = null;
let currentRingingAlarm = null;
let updateService = null;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function assetPath(name) {
  return path.join(__dirname, '..', '..', 'assets', name);
}

function createMainWindow() {
  const state = store.get();
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 920,
    minHeight: 640,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#090909',
    icon: assetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setAlwaysOnTop(Boolean(state.settings.alwaysOnTop));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (state.settings.widgetMode) setWidgetMode(true);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  if (tray && !tray.isDestroyed()) tray.destroy();
  const image = nativeImage.createFromPath(assetPath('icon.png')).resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip('晨光闹钟');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '打开晨光闹钟',
      click: showMainWindow
    },
    {
      label: '桌面悬浮模式',
      type: 'checkbox',
      checked: store.get().settings.widgetMode,
      click: (menuItem) => setWidgetMode(menuItem.checked)
    },
    { type: 'separator' },
    {
      label: '彻底退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showMainWindow);
}

function showMainWindow() {
  if (!mainWindow) createMainWindow();
  mainWindow.show();
  mainWindow.focus();
}

function broadcastState() {
  const state = store.get();
  const upcoming = nextAlarm(state.alarms, state.snoozes);
  const payload = {
    ...state,
    next: upcoming
      ? {
          at: upcoming.date.toISOString(),
          label: upcoming.alarm.label,
          snoozed: upcoming.snoozed
        }
      : null
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:changed', payload);
  }
  return payload;
}

function broadcastUpdateState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', state);
  }
}

function setWidgetMode(enabled) {
  if (!mainWindow) return false;
  store.patchSettings({ widgetMode: Boolean(enabled) });

  if (enabled) {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    const widgetWidth = 390;
    const widgetHeight = 520;
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(widgetWidth, widgetHeight);
    mainWindow.setSize(widgetWidth, widgetHeight, true);
    mainWindow.setPosition(x + width - widgetWidth - 24, y + height - widgetHeight - 24, true);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setSkipTaskbar(true);
  } else {
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(920, 640);
    mainWindow.setSize(1080, 720, true);
    mainWindow.center();
    mainWindow.setAlwaysOnTop(Boolean(store.get().settings.alwaysOnTop));
  }

  broadcastState();
  createTray();
  return true;
}

function showRingWindow(alarm) {
  if (ringWindow && !ringWindow.isDestroyed()) {
    ringWindow.close();
  }
  currentRingingAlarm = alarm;
  ringWindow = new BrowserWindow({
    width: 520,
    height: 560,
    resizable: false,
    movable: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#0b0b0b',
    icon: assetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  ringWindow.setAlwaysOnTop(true, 'screen-saver');
  ringWindow.loadFile(path.join(__dirname, '..', 'renderer', 'ring.html'));
  ringWindow.webContents.once('did-finish-load', () => {
    ringWindow.webContents.send('alarm:ring', alarm);
  });
  ringWindow.on('closed', () => {
    ringWindow = null;
    currentRingingAlarm = null;
  });
  ringWindow.show();
  ringWindow.focus();
}

function triggerAlarm(alarm, isSnooze = false) {
  const state = store.get();
  if (!isSnooze) {
    const fireKey = `${localDateKey(new Date())}|${alarm.time}`;
    const alarms = state.alarms.map((item) => {
      if (item.id !== alarm.id) return item;
      const once = !Array.isArray(item.repeatDays) || item.repeatDays.length === 0;
      return {
        ...item,
        enabled: once ? false : item.enabled,
        lastFiredKey: fireKey
      };
    });
    store.setAlarms(alarms);
  }
  showRingWindow(alarm);
  broadcastState();
}

function schedulerTick() {
  if (ringWindow && !ringWindow.isDestroyed()) return;
  const now = new Date();
  const state = store.get();

  const dueSnooze = state.snoozes.find((item) => {
    const dueAt = new Date(item.dueAt);
    return dueAt <= now && now - dueAt < 60_000;
  });
  if (dueSnooze) {
    store.setSnoozes(state.snoozes.filter((item) => item.id !== dueSnooze.id));
    triggerAlarm({
      id: dueSnooze.alarmId,
      label: dueSnooze.label,
      time: dueSnooze.time,
      sound: dueSnooze.sound,
      snoozeMinutes: dueSnooze.snoozeMinutes
    }, true);
    return;
  }

  const dueAlarm = state.alarms.find((alarm) => shouldFire(alarm, now));
  if (dueAlarm) triggerAlarm(dueAlarm);

  const staleSnoozes = store.get().snoozes.filter((item) => now - new Date(item.dueAt) < 60_000);
  if (staleSnoozes.length !== store.get().snoozes.length) {
    store.setSnoozes(staleSnoozes);
    broadcastState();
  }
}

function registerIpc() {
  ipcMain.handle('state:get', () => broadcastState());

  ipcMain.handle('alarm:save', (_event, input) => {
    const state = store.get();
    const alarm = {
      id: input.id || crypto.randomUUID(),
      time: input.time,
      date: input.date || localDateKey(new Date()),
      label: String(input.label || '闹钟').slice(0, 24),
      repeatDays: Array.isArray(input.repeatDays)
        ? [...new Set(input.repeatDays.map(Number).filter((day) => day >= 0 && day <= 6))]
        : [],
      sound: ['sunrise', 'crystal', 'soft'].includes(input.sound) ? input.sound : 'sunrise',
      snoozeMinutes: [5, 10, 15].includes(Number(input.snoozeMinutes))
        ? Number(input.snoozeMinutes)
        : 5,
      enabled: input.enabled !== false,
      lastFiredKey: input.lastFiredKey || null
    };
    const index = state.alarms.findIndex((item) => item.id === alarm.id);
    if (index >= 0) state.alarms[index] = alarm;
    else state.alarms.push(alarm);
    state.alarms.sort((a, b) => a.time.localeCompare(b.time));
    store.setAlarms(state.alarms);
    return broadcastState();
  });

  ipcMain.handle('alarm:delete', (_event, id) => {
    const state = store.get();
    store.setAlarms(state.alarms.filter((alarm) => alarm.id !== id));
    store.setSnoozes(state.snoozes.filter((item) => item.alarmId !== id));
    return broadcastState();
  });

  ipcMain.handle('alarm:toggle', (_event, { id, enabled }) => {
    const state = store.get();
    store.setAlarms(state.alarms.map((alarm) => (
      alarm.id === id ? { ...alarm, enabled: Boolean(enabled), lastFiredKey: null } : alarm
    )));
    return broadcastState();
  });

  ipcMain.handle('settings:update', (_event, patch) => {
    const allowed = {};
    if ('alwaysOnTop' in patch) allowed.alwaysOnTop = Boolean(patch.alwaysOnTop);
    if ('launchAtLogin' in patch) allowed.launchAtLogin = Boolean(patch.launchAtLogin);
    if ('accent' in patch && ['violet', 'blue', 'rose', 'mono'].includes(patch.accent)) {
      allowed.accent = patch.accent;
    }
    store.patchSettings(allowed);

    if ('alwaysOnTop' in allowed && mainWindow && !store.get().settings.widgetMode) {
      mainWindow.setAlwaysOnTop(allowed.alwaysOnTop);
    }
    if ('launchAtLogin' in allowed) {
      app.setLoginItemSettings({
        openAtLogin: allowed.launchAtLogin,
        path: process.execPath,
        args: app.isPackaged ? [] : [app.getAppPath()]
      });
    }
    return broadcastState();
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged
  }));

  ipcMain.handle('updates:get-state', () => updateService.getState());
  ipcMain.handle('updates:check', () => updateService.check());
  ipcMain.handle('updates:install', () => updateService.install());

  ipcMain.handle('app:open-external', async (_event, input) => {
    const url = String(input || '');
    const allowedPrefix = 'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases';
    if (!url.startsWith(allowedPrefix)) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('window:widget', (_event, enabled) => setWidgetMode(Boolean(enabled)));

  ipcMain.handle('window:action', (_event, action) => {
    if (!mainWindow) return false;
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'hide') mainWindow.hide();
    if (action === 'close') mainWindow.close();
    if (action === 'show') showMainWindow();
    return true;
  });

  ipcMain.handle('ring:action', (_event, { action, alarm }) => {
    if (action === 'snooze') {
      const state = store.get();
      const minutes = Number(alarm.snoozeMinutes) || 5;
      store.setSnoozes([
        ...state.snoozes,
        {
          id: crypto.randomUUID(),
          alarmId: alarm.id,
          label: alarm.label,
          time: alarm.time,
          sound: alarm.sound,
          snoozeMinutes: minutes,
          dueAt: new Date(Date.now() + minutes * 60_000).toISOString()
        }
      ]);
    }
    if (ringWindow && !ringWindow.isDestroyed()) ringWindow.close();
    broadcastState();
    return true;
  });
}

app.on('second-instance', showMainWindow);

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'alarms.json'));
  updateService = createUpdateService({
    packaged: app.isPackaged,
    platform: process.platform,
    portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
    notify: broadcastUpdateState
  });
  registerIpc();
  createMainWindow();
  createTray();
  updateService.start();
  schedulerTimer = setInterval(schedulerTick, 1_000);

  app.on('activate', showMainWindow);
});

app.on('before-quit', () => {
  isQuitting = true;
  updateService?.stop();
  if (schedulerTimer) clearInterval(schedulerTimer);
});

app.on('window-all-closed', () => {
  // 保持托盘运行，确保闹钟能够正常触发。
});

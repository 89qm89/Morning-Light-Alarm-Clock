'use strict';

const { contextBridge } = require('electron');

const sampleState = {
  alarms: [
    {
      id: 'wake-up',
      time: '07:30',
      date: '2026-07-28',
      label: '早起迎接新一天',
      repeatDays: [1, 2, 3, 4, 5],
      sound: 'sunrise',
      snoozeMinutes: 5,
      enabled: true
    },
    {
      id: 'study',
      time: '21:20',
      date: '2026-07-27',
      label: '英语学习时间',
      repeatDays: [1, 3, 5],
      sound: 'crystal',
      snoozeMinutes: 10,
      enabled: true
    }
  ],
  snoozes: [],
  settings: {
    alwaysOnTop: false,
    launchAtLogin: true,
    widgetMode: false,
    accent: 'violet'
  },
  next: {
    at: new Date(Date.now() + 62 * 60_000).toISOString(),
    label: '英语学习时间',
    snoozed: false
  }
};

contextBridge.exposeInMainWorld('alarmAPI', {
  getState: async () => sampleState,
  saveAlarm: async () => sampleState,
  deleteAlarm: async () => sampleState,
  toggleAlarm: async () => sampleState,
  updateSettings: async () => sampleState,
  setWidgetMode: async () => true,
  windowAction: async () => true,
  getAppInfo: async () => ({ version: '1.3.0', packaged: false }),
  getUpdateState: async () => ({
    status: 'unsupported',
    message: '预览模式不会执行自动更新',
    version: null,
    percent: 0,
    manualUrl: 'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases'
  }),
  checkForUpdates: async () => ({
    status: 'up-to-date',
    message: '当前已经是最新版本',
    version: null,
    percent: 0
  }),
  installUpdate: async () => false,
  openExternal: async () => true,
  onStateChanged: () => () => {},
  onUpdateStatus: () => () => {}
});

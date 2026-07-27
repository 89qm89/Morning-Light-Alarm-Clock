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
  onStateChanged: () => () => {}
});

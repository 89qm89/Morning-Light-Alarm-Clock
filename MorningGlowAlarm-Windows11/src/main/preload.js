'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alarmAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveAlarm: (alarm) => ipcRenderer.invoke('alarm:save', alarm),
  deleteAlarm: (id) => ipcRenderer.invoke('alarm:delete', id),
  toggleAlarm: (id, enabled) => ipcRenderer.invoke('alarm:toggle', { id, enabled }),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  setWidgetMode: (enabled) => ipcRenderer.invoke('window:widget', enabled),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  ringAction: (action, alarm) => ipcRenderer.invoke('ring:action', { action, alarm }),
  onStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },
  onAlarmRing: (callback) => {
    const handler = (_event, alarm) => callback(alarm);
    ipcRenderer.on('alarm:ring', handler);
    return () => ipcRenderer.removeListener('alarm:ring', handler);
  }
});

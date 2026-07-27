'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DATA = {
  alarms: [],
  snoozes: [],
  settings: {
    alwaysOnTop: false,
    launchAtLogin: false,
    widgetMode: false,
    accent: 'violet'
  }
};

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        ...DEFAULT_DATA,
        ...parsed,
        alarms: Array.isArray(parsed.alarms) ? parsed.alarms : [],
        snoozes: Array.isArray(parsed.snoozes) ? parsed.snoozes : [],
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) }
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(temporary, this.filePath);
  }

  get() {
    return structuredClone(this.data);
  }

  setAlarms(alarms) {
    this.data.alarms = alarms;
    this.save();
  }

  setSnoozes(snoozes) {
    this.data.snoozes = snoozes;
    this.save();
  }

  patchSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }
}

module.exports = { Store, DEFAULT_DATA };

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getNextOccurrence,
  localDateKey,
  nextAlarm,
  parseTime,
  shouldFire
} = require('../src/shared/scheduler');

test('parseTime validates and returns numeric parts', () => {
  assert.deepEqual(parseTime('08:05'), { hours: 8, minutes: 5 });
  assert.throws(() => parseTime('25:00'));
});

test('one-time alarm returns its future occurrence', () => {
  const from = new Date(2026, 6, 27, 7, 0, 0);
  const alarm = {
    enabled: true,
    date: '2026-07-27',
    time: '08:30',
    repeatDays: []
  };
  const next = getNextOccurrence(alarm, from);
  assert.equal(next.getFullYear(), 2026);
  assert.equal(next.getMonth(), 6);
  assert.equal(next.getDate(), 27);
  assert.equal(next.getHours(), 8);
  assert.equal(next.getMinutes(), 30);
});

test('expired one-time alarm has no next occurrence', () => {
  const from = new Date(2026, 6, 27, 9, 0, 0);
  const alarm = {
    enabled: true,
    date: '2026-07-27',
    time: '08:30',
    repeatDays: []
  };
  assert.equal(getNextOccurrence(alarm, from), null);
});

test('repeat alarm selects the next matching weekday', () => {
  const monday = new Date(2026, 6, 27, 9, 0, 0);
  const alarm = {
    enabled: true,
    time: '08:00',
    repeatDays: [1, 2, 3, 4, 5]
  };
  const next = getNextOccurrence(alarm, monday);
  assert.equal(next.getDay(), 2);
  assert.equal(next.getHours(), 8);
});

test('shouldFire only fires once for a minute key', () => {
  const now = new Date(2026, 6, 27, 8, 0, 20);
  const alarm = {
    enabled: true,
    time: '08:00',
    repeatDays: [1],
    lastFiredKey: null
  };
  assert.equal(shouldFire(alarm, now), true);
  alarm.lastFiredKey = `${localDateKey(now)}|08:00`;
  assert.equal(shouldFire(alarm, now), false);
});

test('snoozed alarm wins when it is sooner', () => {
  const from = new Date(2026, 6, 27, 7, 0, 0);
  const alarms = [{
    id: 'a1',
    enabled: true,
    date: '2026-07-27',
    time: '08:00',
    label: '正式闹钟',
    repeatDays: []
  }];
  const snoozes = [{
    id: 's1',
    alarmId: 'a1',
    dueAt: new Date(2026, 6, 27, 7, 15, 0).toISOString(),
    label: '稍后提醒'
  }];
  const result = nextAlarm(alarms, snoozes, from);
  assert.equal(result.snoozed, true);
  assert.equal(result.alarm.label, '稍后提醒');
});

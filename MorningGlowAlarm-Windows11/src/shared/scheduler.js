'use strict';

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseTime(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || '');
  if (!match) {
    throw new Error(`Invalid time: ${time}`);
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function atLocalTime(date, time) {
  const { hours, minutes } = parseTime(time);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function isRepeatAlarm(alarm) {
  return Array.isArray(alarm.repeatDays) && alarm.repeatDays.length > 0;
}

function matchesAlarmDate(alarm, date) {
  if (isRepeatAlarm(alarm)) {
    return alarm.repeatDays.includes(date.getDay());
  }
  return alarm.date === localDateKey(date);
}

function getNextOccurrence(alarm, from = new Date()) {
  if (!alarm || !alarm.enabled) return null;

  if (!isRepeatAlarm(alarm)) {
    if (!alarm.date) return null;
    const candidate = atLocalTime(new Date(`${alarm.date}T00:00:00`), alarm.time);
    return candidate > from ? candidate : null;
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(from);
    day.setDate(from.getDate() + offset);
    if (!alarm.repeatDays.includes(day.getDay())) continue;
    const candidate = atLocalTime(day, alarm.time);
    if (candidate > from) return candidate;
  }
  return null;
}

function shouldFire(alarm, now = new Date()) {
  if (!alarm || !alarm.enabled || !matchesAlarmDate(alarm, now)) return false;
  const target = atLocalTime(now, alarm.time);
  const delta = now.getTime() - target.getTime();
  const fireKey = `${localDateKey(now)}|${alarm.time}`;
  return delta >= 0 && delta < 60_000 && alarm.lastFiredKey !== fireKey;
}

function nextAlarm(alarms, snoozes = [], from = new Date()) {
  const candidates = [];

  for (const alarm of alarms || []) {
    const date = getNextOccurrence(alarm, from);
    if (date) candidates.push({ date, alarm, snoozed: false });
  }

  for (const snooze of snoozes || []) {
    const date = new Date(snooze.dueAt);
    if (date > from) {
      candidates.push({
        date,
        alarm: {
          id: snooze.alarmId,
          label: snooze.label,
          time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
          sound: snooze.sound,
          snoozeMinutes: snooze.snoozeMinutes
        },
        snoozed: true
      });
    }
  }

  candidates.sort((a, b) => a.date - b.date);
  return candidates[0] || null;
}

module.exports = {
  atLocalTime,
  getNextOccurrence,
  isRepeatAlarm,
  localDateKey,
  matchesAlarmDate,
  nextAlarm,
  parseTime,
  shouldFire
};

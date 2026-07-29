'use strict';

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const PRESETS = {
  once: [],
  everyday: [0, 1, 2, 3, 4, 5, 6],
  workdays: [1, 2, 3, 4, 5],
  weekend: [0, 6]
};

let appState = {
  alarms: [],
  snoozes: [],
  settings: {},
  next: null
};
let selectedDays = [];
let toastTimer = null;
let toastActionCleanup = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function updateClock() {
  const now = new Date();
  $('#currentTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('#currentSeconds').textContent = pad(now.getSeconds());
  $('#currentDate').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${WEEKDAY_NAMES[now.getDay()]}`;

  const hour = now.getHours();
  let greeting = '夜深了，早点休息';
  if (hour >= 5 && hour < 9) greeting = '早上好，新的一天开始了';
  else if (hour >= 9 && hour < 12) greeting = '上午好，保持好心情';
  else if (hour >= 12 && hour < 14) greeting = '中午好，记得休息一下';
  else if (hour >= 14 && hour < 18) greeting = '下午好，继续闪闪发光';
  else if (hour >= 18 && hour < 23) greeting = '晚上好，享受自己的时间';
  $('#greeting').textContent = greeting;
  renderNextAlarm();
}

function formatRepeat(alarm) {
  const days = [...(alarm.repeatDays || [])].sort();
  if (days.length === 0) {
    const date = new Date(`${alarm.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '仅一次';
    return `${date.getMonth() + 1}月${date.getDate()}日 · 仅一次`;
  }
  if (days.length === 7) return '每天';
  if (days.join(',') === '1,2,3,4,5') return '工作日';
  if (days.join(',') === '0,6') return '周末';
  return days.map((day) => WEEKDAY_NAMES[day]).join('、');
}

function renderNextAlarm() {
  const next = appState.next;
  if (!next) {
    $('#nextAlarmText').textContent = '还没有设置闹钟';
    $('#nextCountdown').textContent = '—';
    return;
  }

  const date = new Date(next.at);
  const now = new Date();
  const delta = Math.max(0, date - now);
  const hours = Math.floor(delta / 3_600_000);
  const minutes = Math.floor((delta % 3_600_000) / 60_000);
  const days = Math.floor(hours / 24);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const dateLabel =
    date.toDateString() === now.toDateString()
      ? `今天 ${clock}`
      : `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  $('#nextAlarmText').textContent = `${dateLabel} · ${next.label}${next.snoozed ? '（稍后提醒）' : ''}`;
  $('#nextCountdown').textContent =
    days > 0 ? `${days}天${hours % 24}小时后` : hours > 0 ? `${hours}小时${minutes}分后` : `${minutes}分钟后`;
}

function alarmItemTemplate(alarm) {
  const disabled = alarm.enabled ? '' : ' disabled';
  const checked = alarm.enabled ? ' checked' : '';
  return `
    <article class="alarm-item${disabled}" data-id="${alarm.id}">
      <div class="alarm-time">${alarm.time}</div>
      <div class="alarm-info">
        <strong>${escapeHtml(alarm.label || '闹钟')}</strong>
        <span>${formatRepeat(alarm)} · ${soundName(alarm.sound)} · 可稍后 ${alarm.snoozeMinutes || 5} 分钟</span>
      </div>
      <div class="alarm-actions">
        <button class="icon-button edit-alarm" title="编辑" aria-label="编辑">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M5 19l3.5-.7L19 7.8 16.2 5 5.7 15.5Z"/></svg>
        </button>
        <button class="icon-button delete delete-alarm" title="删除" aria-label="删除">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 13h8l1-13"/></svg>
        </button>
        <label class="switch" title="${alarm.enabled ? '关闭闹钟' : '开启闹钟'}">
          <input class="toggle-alarm" type="checkbox"${checked}>
          <span></span>
        </label>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}

function soundName(value) {
  return {
    sunrise: '晨曦渐响',
    crystal: '清脆水晶',
    soft: '柔和轻铃'
  }[value] || '晨曦渐响';
}

function renderState(state) {
  appState = state;
  const list = $('#alarmList');
  list.innerHTML = state.alarms.map(alarmItemTemplate).join('');
  $('#alarmCount').textContent = state.alarms.length;
  $('#emptyState').classList.toggle('hidden', state.alarms.length > 0);
  list.classList.toggle('hidden', state.alarms.length === 0);
  $('#alwaysOnTopToggle').checked = Boolean(state.settings.alwaysOnTop);
  $('#launchAtLoginToggle').checked = Boolean(state.settings.launchAtLogin);
  document.body.dataset.accent = state.settings.accent || 'mono';
  document.body.classList.toggle('widget-mode', Boolean(state.settings.widgetMode));
  $$('.accent-dot').forEach((button) => {
    button.classList.toggle('active', button.dataset.accent === (state.settings.accent || 'mono'));
  });
  renderNextAlarm();
}

function openModal(alarm = null) {
  const now = new Date();
  const defaultTime = new Date(now.getTime() + 60 * 60_000);
  $('#modalTitle').textContent = alarm ? '编辑闹钟' : '新建闹钟';
  $('#alarmId').value = alarm?.id || '';
  $('#alarmTime').value = alarm?.time || `${pad(defaultTime.getHours())}:${pad(defaultTime.getMinutes())}`;
  $('#alarmLabel').value = alarm?.label || '起床啦';
  $('#alarmDate').min = localDateValue(now);
  $('#alarmDate').value = alarm?.date || localDateValue(defaultTime);
  $('#alarmSound').value = alarm?.sound || 'sunrise';
  $('#snoozeMinutes').value = String(alarm?.snoozeMinutes || 5);
  selectedDays = [...(alarm?.repeatDays || [])];
  updateRepeatControls();
  $('#alarmModal').classList.remove('hidden');
  setTimeout(() => $('#alarmTime').focus(), 80);
}

function closeModal() {
  $('#alarmModal').classList.add('hidden');
}

function updateRepeatControls() {
  $$('.weekday-row button').forEach((button) => {
    button.classList.toggle('selected', selectedDays.includes(Number(button.dataset.day)));
  });

  let activePreset = null;
  for (const [name, days] of Object.entries(PRESETS)) {
    if ([...days].sort().join(',') === [...selectedDays].sort().join(',')) activePreset = name;
  }
  $$('.preset').forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === activePreset);
  });

  const dateField = $('#alarmDate');
  dateField.disabled = selectedDays.length > 0;
  $('#repeatHint').textContent =
    selectedDays.length > 0
      ? `每${formatDays(selectedDays)}重复响铃`
      : '仅在选择的日期响铃';
}

function formatDays(days) {
  const sorted = [...days].sort();
  if (sorted.length === 7) return '天';
  if (sorted.join(',') === '1,2,3,4,5') return '个工作日';
  if (sorted.join(',') === '0,6') return '个周末';
  return sorted.map((day) => WEEKDAY_NAMES[day].replace('周', '')).join('、');
}


function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function makeAlarmPayload(date, label, repeatDays = []) {
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    date: localDateValue(date),
    label: label || '闹钟',
    repeatDays,
    sound: 'sunrise',
    snoozeMinutes: 5,
    enabled: true
  };
}

function parseNaturalAlarm(value) {
  const input = String(value || '').trim();
  if (!input) return { error: '先输入一句提醒，例如“明早7点叫我起床”' };

  const now = new Date();
  let target = new Date(now);
  let repeatDays = [];
  let matchedText = '';

  const relative = input.match(/(\d{1,3})\s*(分钟|小时)后/);
  if (relative) {
    const amount = Number(relative[1]);
    const milliseconds = relative[2] === '小时' ? amount * 3_600_000 : amount * 60_000;
    if (amount <= 0) return { error: '时间需要大于 0' };
    target = new Date(now.getTime() + milliseconds);
    matchedText = relative[0];
  } else {
    const timeMatch = input.match(/(\d{1,2})\s*(?:[:：点时])\s*(\d{1,2})?\s*分?/);
    if (!timeMatch) return { error: '没有识别到时间，可以试试“明早7点”或“30分钟后”' };
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    if (hour > 23 || minute > 59) return { error: '时间格式不正确，请输入 0:00 到 23:59' };
    target.setHours(hour, minute, 0, 0);
    matchedText = timeMatch[0];

    if (/后天/.test(input)) target = addDays(target, 2);
    else if (/明天|明早|明晚/.test(input)) target = addDays(target, 1);

    if (/每天/.test(input)) repeatDays = [...PRESETS.everyday];
    else if (/工作日|周一到周五/.test(input)) repeatDays = [...PRESETS.workdays];
    else if (/周末/.test(input)) repeatDays = [...PRESETS.weekend];

    const hasExplicitDay = /今天|今晚|明天|明早|明晚|后天/.test(input);
    if (repeatDays.length === 0 && !hasExplicitDay && target <= now) target = addDays(target, 1);
  }

  let label = input
    .replace(matchedText, '')
    .replace(/今天|今晚|明天|明早|明晚|后天|每天|工作日|周一到周五|周末/g, '')
    .replace(/^(请|帮我|提醒我|叫我)+/, '')
    .replace(/^(的|在|于)+/, '')
    .trim();
  label = label || (relative ? '提醒事项' : '起床啦');

  return {
    payload: makeAlarmPayload(target, label.slice(0, 24), repeatDays),
    description: repeatDays.length > 0
      ? `${formatRepeat({ repeatDays })} ${pad(target.getHours())}:${pad(target.getMinutes())}`
      : `${target.getMonth() + 1}月${target.getDate()}日 ${pad(target.getHours())}:${pad(target.getMinutes())}`
  };
}

async function createQuickAlarm(payload, successMessage) {
  const state = await window.alarmAPI.saveAlarm(payload);
  renderState(state);
  showToast(successMessage);
}

async function handleQuickCommand(event) {
  event.preventDefault();
  const result = parseNaturalAlarm($('#quickCommandInput').value);
  if (result.error) {
    $('#quickHint').textContent = result.error;
    $('#quickCommandInput').focus();
    return;
  }
  await createQuickAlarm(result.payload, `已创建：${result.description}`);
  $('#quickCommandInput').value = '';
  $('#quickHint').textContent = '创建成功，你可以继续输入下一条提醒';
}

async function handleQuickPreset(kind) {
  const now = new Date();
  if (kind === 'minutes-30') {
    const target = new Date(now.getTime() + 30 * 60_000);
    await createQuickAlarm(makeAlarmPayload(target, '休息一下'), '已设置 30 分钟后的提醒');
    return;
  }
  if (kind === 'tomorrow-0700') {
    const target = addDays(now, 1);
    target.setHours(7, 0, 0, 0);
    await createQuickAlarm(makeAlarmPayload(target, '起床啦'), '已设置明早 07:00');
    return;
  }
  if (kind === 'workdays-0730') {
    const target = new Date(now);
    target.setHours(7, 30, 0, 0);
    await createQuickAlarm(makeAlarmPayload(target, '工作日起床', PRESETS.workdays), '已设置工作日 07:30');
  }
}

async function saveAlarm(event) {
  event.preventDefault();
  const payload = {
    id: $('#alarmId').value || undefined,
    time: $('#alarmTime').value,
    date: $('#alarmDate').value,
    label: $('#alarmLabel').value.trim() || '闹钟',
    repeatDays: selectedDays,
    sound: $('#alarmSound').value,
    snoozeMinutes: Number($('#snoozeMinutes').value),
    enabled: true
  };
  if (!payload.time) return;
  if (selectedDays.length === 0 && !payload.date) {
    showToast('请选择单次闹钟的日期');
    return;
  }
  const existing = appState.alarms.find((item) => item.id === payload.id);
  if (existing) payload.enabled = existing.enabled;
  const state = await window.alarmAPI.saveAlarm(payload);
  renderState(state);
  closeModal();
  showToast(existing ? '闹钟已更新' : '闹钟已创建');
}

function showToast(message, action = null) {
  const toast = $('#toast');
  toast.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);

  if (toastActionCleanup) {
    toastActionCleanup();
    toastActionCleanup = null;
  }
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    const handler = async () => {
      button.disabled = true;
      await action.run();
    };
    button.addEventListener('click', handler);
    toast.append(button);
    toastActionCleanup = () => button.removeEventListener('click', handler);
  }

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    if (toastActionCleanup) toastActionCleanup();
    toastActionCleanup = null;
  }, action ? 5200 : 2400);
}

function bindEvents() {
  $('#addAlarmButton').addEventListener('click', () => openModal());
  $('#emptyAddButton').addEventListener('click', () => openModal());
  $('#modalCloseButton').addEventListener('click', closeModal);
  $('#cancelButton').addEventListener('click', closeModal);
  $('#alarmForm').addEventListener('submit', saveAlarm);
  $('#quickCommandForm').addEventListener('submit', handleQuickCommand);
  $$('.quick-preset').forEach((button) => {
    button.addEventListener('click', () => handleQuickPreset(button.dataset.quick));
  });
  $('#openUpdatesButton').addEventListener('click', async () => {
    const opened = await window.alarmAPI.openExternal(
      'https://github.com/89qm89/Morning-Light-Alarm-Clock/releases'
    );
    showToast(opened ? '已在浏览器打开更新页面' : '更新页面打开失败');
  });
  $('#alarmModal').addEventListener('click', (event) => {
    if (event.target === $('#alarmModal')) closeModal();
  });

  $$('.preset').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDays = [...PRESETS[button.dataset.preset]];
      updateRepeatControls();
    });
  });
  $$('.weekday-row button').forEach((button) => {
    button.addEventListener('click', () => {
      const day = Number(button.dataset.day);
      selectedDays = selectedDays.includes(day)
        ? selectedDays.filter((item) => item !== day)
        : [...selectedDays, day];
      updateRepeatControls();
    });
  });

  $('#alarmList').addEventListener('click', async (event) => {
    const item = event.target.closest('.alarm-item');
    if (!item) return;
    const alarm = appState.alarms.find((candidate) => candidate.id === item.dataset.id);
    if (!alarm) return;

    if (event.target.closest('.edit-alarm')) openModal(alarm);
    if (event.target.closest('.delete-alarm')) {
      const deletedAlarm = { ...alarm };
      const state = await window.alarmAPI.deleteAlarm(alarm.id);
      renderState(state);
      showToast('闹钟已删除', {
        label: '撤销',
        run: async () => {
          renderState(await window.alarmAPI.saveAlarm(deletedAlarm));
          showToast('已恢复闹钟');
        }
      });
    }
  });
  $('#alarmList').addEventListener('change', async (event) => {
    if (!event.target.classList.contains('toggle-alarm')) return;
    const item = event.target.closest('.alarm-item');
    const state = await window.alarmAPI.toggleAlarm(item.dataset.id, event.target.checked);
    renderState(state);
    showToast(event.target.checked ? '闹钟已开启' : '闹钟已关闭');
  });

  $('#alwaysOnTopToggle').addEventListener('change', async (event) => {
    renderState(await window.alarmAPI.updateSettings({ alwaysOnTop: event.target.checked }));
  });
  $('#launchAtLoginToggle').addEventListener('change', async (event) => {
    renderState(await window.alarmAPI.updateSettings({ launchAtLogin: event.target.checked }));
    showToast(event.target.checked ? '已开启开机启动' : '已关闭开机启动');
  });
  $$('.accent-dot').forEach((button) => {
    button.addEventListener('click', async () => {
      renderState(await window.alarmAPI.updateSettings({ accent: button.dataset.accent }));
    });
  });

  $('#widgetButton').addEventListener('click', () => window.alarmAPI.setWidgetMode(true));
  $('#widgetExitButton').addEventListener('click', () => window.alarmAPI.setWidgetMode(false));
  $('#minimizeButton').addEventListener('click', () => window.alarmAPI.windowAction('minimize'));
  $('#closeButton').addEventListener('click', () => window.alarmAPI.windowAction('hide'));

  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.nav-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
    if (event.key.toLowerCase() === 'n' && event.ctrlKey) openModal();
  });
}

async function init() {
  bindEvents();
  renderState(await window.alarmAPI.getState());
  const appInfo = await window.alarmAPI.getAppInfo();
  $('#appVersion').textContent = `v${appInfo.version}`;
  window.alarmAPI.onStateChanged(renderState);
  updateClock();
  setInterval(updateClock, 1_000);
}

init();

'use strict';

let alarm = null;
let audioContext = null;
let soundTimer = null;
let ringStartedAt = 0;

const $ = (selector) => document.querySelector(selector);

function playTone(frequency, start, duration, volume = 0.08) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  const elapsed = ringStartedAt ? Date.now() - ringStartedAt : 0;
  const ramp = Math.min(1, 0.32 + (elapsed / 90_000) * 0.68);
  const targetVolume = Math.max(0.001, volume * ramp);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(targetVolume, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function playPattern() {
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const style = alarm?.sound || 'sunrise';

  if (style === 'crystal') {
    playTone(880, now, 0.32, 0.07);
    playTone(1174, now + 0.28, 0.45, 0.055);
    playTone(1320, now + 0.62, 0.5, 0.05);
  } else if (style === 'soft') {
    playTone(392, now, 0.8, 0.045);
    playTone(523, now + 0.45, 0.9, 0.04);
    playTone(659, now + 0.9, 0.9, 0.035);
  } else {
    playTone(523, now, 0.48, 0.055);
    playTone(659, now + 0.35, 0.52, 0.06);
    playTone(784, now + 0.72, 0.65, 0.065);
  }
}

function startSound() {
  ringStartedAt = Date.now();
  playPattern();
  soundTimer = setInterval(playPattern, 2600);
}

function stopSound() {
  clearInterval(soundTimer);
  soundTimer = null;
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

async function performAction(action) {
  stopSound();
  await window.alarmAPI.ringAction(action, alarm);
}

window.alarmAPI.onAlarmRing((incoming) => {
  alarm = incoming;
  $('#ringTime').textContent = incoming.time || '--:--';
  $('#ringLabel').textContent = incoming.label || '闹钟响了';
  $('#snoozeLabel').textContent = `再睡 ${incoming.snoozeMinutes || 5} 分钟`;
  startSound();
});

$('#snoozeButton').addEventListener('click', () => performAction('snooze'));
$('#stopButton').addEventListener('click', () => performAction('stop'));

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') performAction('stop');
  if (event.key.toLowerCase() === 's') performAction('snooze');
});

window.addEventListener('beforeunload', stopSound);

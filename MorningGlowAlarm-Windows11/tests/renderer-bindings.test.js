'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rendererSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'app.js'),
  'utf8'
);

test('plural renderer selectors use the collection helper', () => {
  assert.doesNotMatch(
    rendererSource,
    /(^|[^$])\$\([^\n]+\)\.forEach/gm,
    'querySelector results cannot be iterated with forEach; use the $$ helper'
  );
});

test('primary navigation controls keep their click bindings', () => {
  assert.match(rendererSource, /#openUpdatesButton[\s\S]*?addEventListener\('click'/);
  assert.match(rendererSource, /\.accent-dot[\s\S]*?addEventListener\('click'/);
  assert.match(rendererSource, /\.nav-item[\s\S]*?addEventListener\('click'/);
  assert.match(rendererSource, /#closeButton[\s\S]*?addEventListener\('click'/);
  assert.match(rendererSource, /\.delete-alarm[\s\S]*?alarmList[\s\S]*?addEventListener\('click'/);
});

test('automatic update controls keep status, check, and install bindings', () => {
  assert.match(rendererSource, /onUpdateStatus\(renderUpdateState\)/);
  assert.match(rendererSource, /checkForUpdates\(\)/);
  assert.match(rendererSource, /installUpdate\(\)/);
  assert.match(rendererSource, /更新并重启/);
});

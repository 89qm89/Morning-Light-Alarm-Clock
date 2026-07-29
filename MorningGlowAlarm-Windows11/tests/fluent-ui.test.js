'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Windows 11 Fluent design tokens and key surfaces remain available', () => {
  const css = read('src/renderer/styles.css');

  assert.match(css, /v1\.2 — Windows 11 Fluent refresh/);
  assert.match(css, /backdrop-filter: blur\(34px\) saturate\(125%\)/);
  assert.match(css, /\.nav-item\.active/);
  assert.match(css, /\.clock-panel/);
  assert.match(css, /\.alarm-modal/);
  assert.match(css, /body\[data-accent="blue"\]/);
});

test('new installations default to the Fluent blue accent', () => {
  const store = read('src/main/store.js');
  const renderer = read('src/renderer/app.js');

  assert.match(store, /accent: 'blue'/);
  assert.match(renderer, /state\.settings\.accent \|\| 'blue'/);
});

test('release metadata is synchronized at v1.2.0', () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  const html = read('src/renderer/index.html');

  assert.equal(packageJson.version, '1.2.0');
  assert.equal(packageLock.version, '1.2.0');
  assert.equal(packageLock.packages[''].version, '1.2.0');
  assert.match(html, /v1\.2\.0/);
});

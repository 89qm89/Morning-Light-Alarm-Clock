'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('current package version has complete release notes', () => {
  const version = JSON.parse(read('package.json')).version;
  const changelog = read('CHANGELOG.md');
  const entryStart = changelog.indexOf(`## ${version}`);

  assert.notEqual(entryStart, -1, `CHANGELOG.md is missing version ${version}`);
  const nextEntry = changelog.indexOf('\n## ', entryStart + 1);
  const entry = changelog.slice(entryStart, nextEntry === -1 ? undefined : nextEntry);

  for (const heading of ['本版简介', '新增', '修改', '修复', '移除']) {
    assert.match(entry, new RegExp(`### ${heading}`));
  }
});

test('release workflow publishes the version-specific notes file', () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, '..', '.github', 'workflows', 'build-windows.yml'),
    'utf8'
  );

  assert.match(workflow, /Prepare release notes/);
  assert.match(workflow, /--notes-file release-notes\.md/);
});

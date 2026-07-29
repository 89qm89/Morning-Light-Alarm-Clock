'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function fileSha512(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function buildLatestYml({ version, filename, size, sha512, releaseDate }) {
  return [
    `version: ${version}`,
    'files:',
    `  - url: ${filename}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${filename}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    ''
  ].join('\n');
}

function generate() {
  const projectRoot = path.join(__dirname, '..');
  const releaseDir = path.join(projectRoot, 'release');
  const { version } = require(path.join(projectRoot, 'package.json'));
  const filename = `Morning-Glow-Alarm-Setup-${version}-x64.exe`;
  const installerPath = path.join(releaseDir, filename);

  if (!fs.existsSync(installerPath)) {
    throw new Error(`Windows installer not found: ${installerPath}`);
  }

  const latestYml = buildLatestYml({
    version,
    filename,
    size: fs.statSync(installerPath).size,
    sha512: fileSha512(installerPath),
    releaseDate: new Date().toISOString()
  });
  fs.writeFileSync(path.join(releaseDir, 'latest.yml'), latestYml, 'utf8');
}

if (require.main === module) generate();

module.exports = { buildLatestYml };

'use strict';

const path = require('node:path');
const { app, BrowserWindow } = require('electron');

app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('ozone-platform', 'headless');

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1080,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'tests', 'preview-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await window.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const image = await window.capturePage();
  require('node:fs').writeFileSync(
    path.join(__dirname, '..', 'preview.png'),
    image.toPNG()
  );
  app.quit();
});

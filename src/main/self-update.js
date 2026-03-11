'use strict';

const { app } = require('electron');
const path = require('path');

function performUpdate() {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..', '..');
    const isWin = process.platform === 'win32';

    let updateCmd;
    if (isWin) {
        updateCmd = `cd "${appDir}" ; git pull ; npm install ; npm start`;
    } else {
        updateCmd = `cd "${appDir}" && git pull && npm install && npm start`;
    }

    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-Command', updateCmd] : ['-c', updateCmd];

    const { spawn } = require('child_process');
    const child = spawn(shell, shellArgs, {
        detached: true,
        stdio: 'ignore',
        cwd: appDir,
        shell: false
    });
    child.unref();

    setTimeout(() => {
        app.quit();
    }, 500);
}

module.exports = { performUpdate };

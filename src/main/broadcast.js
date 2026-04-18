'use strict';

// Shared utility — broadcast an IPC event to both mainWindow and chatWindow

let _getMainWindow = null;
let _getChatWindow = null;

function init({ getMainWindow, getChatWindow }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
}

function broadcastToWindows(eventName, data) {
    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(eventName, data);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send(eventName, data);
    }
}

module.exports = { init, broadcastToWindows };

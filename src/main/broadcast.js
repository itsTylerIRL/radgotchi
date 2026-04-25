'use strict';

// Shared utility — broadcast an IPC event to both mainWindow and chatWindow,
// plus any registered subscribers (e.g. the web-mode WebSocket server).
//
// Subscribers were added because many modules destructure `broadcastToWindows`
// at import time:
//     const { broadcastToWindows } = require('./broadcast');
// which captures the function reference. Reassigning `module.exports.broadcastToWindows`
// later (the previous web-server monkey-patch) had no effect on those captured
// references. Fan-out via a registry inside the original function fixes that
// without changing any consumer.

let _getMainWindow = null;
let _getChatWindow = null;
const _subscribers = new Set();

function init({ getMainWindow, getChatWindow }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
}

/**
 * Register an extra listener that receives every broadcast.
 * Returns an unsubscribe function.
 *
 * @param {(eventName: string, data: any) => void} fn
 */
function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _subscribers.add(fn);
    return () => _subscribers.delete(fn);
}

function unsubscribe(fn) {
    _subscribers.delete(fn);
}

function broadcastToWindows(eventName, data) {
    const mainWindow = _getMainWindow && _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        try { mainWindow.webContents.send(eventName, data); } catch (_) {}
    }
    const chatWindow = _getChatWindow && _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        try { chatWindow.webContents.send(eventName, data); } catch (_) {}
    }
    for (const fn of _subscribers) {
        try { fn(eventName, data); } catch (e) {
            console.error('[broadcast] subscriber threw for event', eventName, e);
        }
    }
}

module.exports = { init, broadcastToWindows, subscribe, unsubscribe };

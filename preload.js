const { contextBridge, ipcRenderer } = require('electron');

// Helper: register a listener that replaces any previous one for the same channel.
// Prevents duplicate listeners if the renderer ever re-registers callbacks.
function safeOn(channel, handler) {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, handler);
}

// Expose protected methods for window dragging and system metrics
contextBridge.exposeInMainWorld('electronAPI', {
    // Window dragging
    startDrag: () => ipcRenderer.send('start-drag'),
    windowDrag: (delta) => ipcRenderer.send('window-drag', delta),
    stopDrag: () => ipcRenderer.send('stop-drag'),

    // Window resizing
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),

    // System metrics (invoke = request/response, safe to call repeatedly)
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),

    // Color change from tray menu
    onSetColor: (callback) => safeOn('set-color', (_event, color) => callback(color)),

    // Bounce edge hit (DVD-style color cycle)
    onBounceEdge: (callback) => safeOn('bounce-edge', () => callback()),

    // System event (CPU/memory/network changes trigger mood reactions)
    onSystemEvent: (callback) => safeOn('system-event', (_event, data) => callback(data)),

    // Idle state toggle (AFK sleep / wake-up)
    onIdleChange: (callback) => safeOn('idle-change', (_event, data) => callback(data)),

    // Language change from tray menu (en / zh)
    onSetLanguage: (callback) => safeOn('set-language', (_event, lang) => callback(lang)),

    // Mouse position for eye tracking
    getMousePosition: () => ipcRenderer.invoke('get-mouse-position')
});

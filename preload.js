const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for window dragging and system metrics
contextBridge.exposeInMainWorld('electronAPI', {
    // Window dragging
    startDrag: () => ipcRenderer.send('start-drag'),
    windowDrag: (delta) => ipcRenderer.send('window-drag', delta),
    stopDrag: () => ipcRenderer.send('stop-drag'),
    
    // Window resizing
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
    
    // System metrics
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    
    // Color change listener
    onSetColor: (callback) => ipcRenderer.on('set-color', (event, color) => callback(color)),
    
    // Bounce edge listener (for DVD-style color change)
    onBounceEdge: (callback) => ipcRenderer.on('bounce-edge', () => callback()),
    
    // System event listener (for mood reactions)
    onSystemEvent: (callback) => ipcRenderer.on('system-event', (event, data) => callback(data)),
    
    // Idle state change listener
    onIdleChange: (callback) => ipcRenderer.on('idle-change', (event, data) => callback(data)),
    
    // Mouse position for eye tracking
    getMousePosition: () => ipcRenderer.invoke('get-mouse-position')
});

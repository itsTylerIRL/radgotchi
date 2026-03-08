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

    // Movement mode changed (none / bounce / follow / wander)
    onMovementModeChange: (callback) => safeOn('movement-mode-change', (_event, mode) => callback(mode)),

    // Wander pause/resume events
    onWanderPause: (callback) => safeOn('wander-pause', (_event, paused) => callback(paused)),

    // System event (CPU/memory/network changes trigger mood reactions)
    onSystemEvent: (callback) => safeOn('system-event', (_event, data) => callback(data)),

    // Idle state toggle (AFK sleep / wake-up)
    onIdleChange: (callback) => safeOn('idle-change', (_event, data) => callback(data)),

    // Language change from tray menu (en / zh)
    onSetLanguage: (callback) => safeOn('set-language', (_event, lang) => callback(lang)),

    // Mouse position for eye tracking
    getMousePosition: () => ipcRenderer.invoke('get-mouse-position'),

    // LLM Chat functionality
    getLlmConfig: () => ipcRenderer.invoke('get-llm-config'),
    saveLlmConfig: (config) => ipcRenderer.invoke('save-llm-config', config),
    sendChatMessage: (messages) => ipcRenderer.invoke('send-chat-message', { messages }),
    
    // Chat window control
    openChat: () => ipcRenderer.send('open-chat'),
    onChatMood: (callback) => safeOn('chat-mood', (_event, mood) => callback(mood)),
    syncChatColor: (color) => ipcRenderer.send('sync-chat-color', color),
    
    // Sprite state update (send current sprite to chat window for bro avatar)
    updateSprite: (sprite) => ipcRenderer.send('sprite-update', sprite),
    
    // Sleep mode (pauses XP and shows sleep animation)
    onSetSleep: (callback) => safeOn('set-sleep', (_event, sleeping) => callback(sleeping)),
    onSleepAnimation: (callback) => safeOn('sleep-animation', (_event, animation) => callback(animation)),
    
    // Work mode (pomodoro focus animation)
    onSetWork: (callback) => safeOn('set-work', (_event, working) => callback(working)),
    onWorkAnimation: (callback) => safeOn('work-animation', (_event, animation) => callback(animation)),
    
    // XP System
    addXp: (amount, source) => ipcRenderer.invoke('add-xp', { amount, source }),
    onXpUpdate: (callback) => safeOn('xp-update', (_event, data) => callback(data)),
    
    // Attention events (requires interaction to stop XP loss)
    onAttentionEvent: (callback) => safeOn('attention-event', (_event, data) => callback(data))
});

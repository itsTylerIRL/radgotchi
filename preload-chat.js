const { contextBridge, ipcRenderer } = require('electron');

// Chat window preload
contextBridge.exposeInMainWorld('electronAPI', {
    closeChat: () => ipcRenderer.send('close-chat'),
    sendChatMessage: (messages) => ipcRenderer.invoke('send-chat-message', { messages }),
    chatMood: (mood) => ipcRenderer.send('chat-mood', mood),
    onChatReady: (callback) => ipcRenderer.on('chat-ready', (_event, data) => callback(data)),
    onSetColor: (callback) => ipcRenderer.on('set-color', (_event, color) => callback(color)),
    // Control APIs from chat panel
    setMovementMode: (mode) => ipcRenderer.send('chat-set-movement', mode),
    setColor: (color) => ipcRenderer.send('chat-set-color', color),
    setLanguage: (lang) => ipcRenderer.send('chat-set-language', lang),
    onSetLanguage: (callback) => ipcRenderer.on('set-language', (_event, lang) => callback(lang)),
    onMovementModeChange: (callback) => ipcRenderer.on('movement-mode-change', (_event, mode) => callback(mode)),
    // Sleep mode (pauses XP and shows sleep animation)
    setSleep: (sleeping) => ipcRenderer.send('chat-set-sleep', sleeping),
    onSetSleep: (callback) => ipcRenderer.on('set-sleep', (_event, sleeping) => callback(sleeping)),
    // XP System
    getXpStatus: () => ipcRenderer.invoke('get-xp-status'),
    addXp: (amount, source) => ipcRenderer.invoke('add-xp', { amount, source }),
    onXpUpdate: (callback) => ipcRenderer.on('xp-update', (_event, data) => callback(data)),
    // Attention events
    onAttentionEvent: (callback) => ipcRenderer.on('attention-event', (_event, data) => callback(data)),
    // Pet Needs
    getNeeds: () => ipcRenderer.invoke('get-needs'),
    feedPet: (amount, type) => ipcRenderer.invoke('feed-pet', { amount, type }),
    onNeedsUpdate: (callback) => ipcRenderer.on('needs-update', (_event, data) => callback(data)),
    // Pomodoro
    pomodoroStart: (mode) => ipcRenderer.invoke('pomodoro-start', { mode }),
    pomodoroStop: () => ipcRenderer.invoke('pomodoro-stop'),
    pomodoroStatus: () => ipcRenderer.invoke('pomodoro-status'),
    onPomodoroUpdate: (callback) => ipcRenderer.on('pomodoro-update', (_event, data) => callback(data)),
    onPomodoroComplete: (callback) => ipcRenderer.on('pomodoro-complete', (_event, data) => callback(data)),
});

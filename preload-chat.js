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
    // Expression-only mode (no text, just expression)
    setExpressionOnly: (enabled) => ipcRenderer.send('chat-set-expression-only', enabled)
});

const { contextBridge, ipcRenderer } = require('electron');

// Chat window preload
contextBridge.exposeInMainWorld('electronAPI', {
    closeChat: () => ipcRenderer.send('close-chat'),
    sendChatMessage: (messages) => ipcRenderer.invoke('send-chat-message', { messages }),
    chatMood: (mood) => ipcRenderer.send('chat-mood', mood),
    onChatReady: (callback) => ipcRenderer.on('chat-ready', (_event, data) => callback(data)),
    onSetColor: (callback) => ipcRenderer.on('set-color', (_event, color) => callback(color))
});

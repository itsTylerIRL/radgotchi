'use strict';

const { ipcMain, desktopCapturer } = require('electron');
const os = require('os');

let _deps = null;

function init(deps) {
    _deps = deps;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main window IPC handlers (system, LLM, XP, pomodoro, needs, audio, network)
// ═══════════════════════════════════════════════════════════════════════════

function registerMainIpc() {
    const {
        getMainWindow, getChatWindow, persistence, xpSystem, petNeeds,
        pomodoro, sleepWork, llm, petMemory, systemMonitor, networkDiscovery,
        getAudioListeningEnabled, setAudioListeningEnabled,
    } = _deps;

    // System metrics
    ipcMain.handle('get-system-metrics', async () => {
        const cpuUsage = systemMonitor.getCpuUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;
        return {
            cpu: { usage_total: cpuUsage },
            memory: { percent: memPercent },
            temperatures: []
        };
    });

    // LLM config
    ipcMain.handle('get-llm-config', async () => {
        const config = llm.getLlmConfig();
        config.memoryEnabled = petMemory.isEnabled();
        config.memoryCount = petMemory.getFacts().length;
        return config;
    });

    ipcMain.handle('save-llm-config', async (event, config) => {
        if (config.memoryEnabled !== undefined) {
            petMemory.setEnabled(config.memoryEnabled);
        }
        const result = await llm.saveLlmConfig(config);
        const cw = getChatWindow();
        if (cw && cw.webContents) {
            cw.webContents.send('pfp-update', { operatorPfp: llm.getLlmConfig().operatorPfp || null });
        }
        return result;
    });

    ipcMain.handle('clear-pet-memory', async () => {
        petMemory.clearMemory();
        return { success: true };
    });

    // Chat with LLM (non-streaming)
    ipcMain.handle('send-chat-message', async (event, { messages }) => {
        if (sleepWork.getIsSleeping()) sleepWork.stopSleepMode();
        const result = await llm.sendChatMessage(messages);
        if (result.content) {
            xpSystem.addXp(xpSystem.XP_CONFIG.MESSAGE_RECEIVE_XP, 'message-receive');
        }
        return result;
    });

    // Chat with LLM (streaming)
    ipcMain.on('send-chat-message-stream', async (event, { messages }) => {
        if (sleepWork.getIsSleeping()) sleepWork.stopSleepMode();
        llm.sendChatMessageStream(event, messages);
    });

    // XP System
    ipcMain.handle('get-xp-status', async () => {
        const status = xpSystem.getXpStatus();
        const pState = pomodoro.getState();
        status.pomodoro = {
            active: pState.active,
            mode: pState.mode,
            remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
            pomosCompleted: pState.pomosCompleted,
        };
        return status;
    });

    ipcMain.handle('add-xp', async (event, { amount, source }) => {
        if (source === 'click') {
            const now = Date.now();
            const xpData = xpSystem.getXpData();
            if (xpSystem.isAttentionActive()) {
                xpSystem.resolveAttentionEvent();
                xpData.lastClickXpTime = now;
                return { awarded: true, attentionResolved: true };
            }
            if (now - xpData.lastClickXpTime < xpSystem.XP_CONFIG.CLICK_COOLDOWN_MS) {
                return { awarded: false, reason: 'cooldown' };
            }
            xpData.lastClickXpTime = now;
            const result = xpSystem.addXp(xpSystem.XP_CONFIG.CLICK_XP, 'click');
            return { awarded: true, ...result };
        }
        if (source === 'message-send') {
            const result = xpSystem.addXp(xpSystem.XP_CONFIG.MESSAGE_SEND_XP, 'message-send');
            return { awarded: true, ...result };
        }
        return { awarded: false, reason: 'invalid-source' };
    });

    ipcMain.handle('get-attention-status', async () => ({ active: xpSystem.isAttentionActive() }));

    // Pomodoro
    ipcMain.handle('pomodoro-start', async (event, { mode }) => pomodoro.startPomodoro(mode || 'work'));
    ipcMain.handle('pomodoro-stop', async () => pomodoro.stopPomodoro());
    ipcMain.handle('pomodoro-status', async () => {
        const s = pomodoro.getState();
        return {
            active: s.active, mode: s.mode,
            remaining: s.active ? Math.max(0, s.duration - (Date.now() - s.startTime)) : 0,
            duration: s.duration, pomosCompleted: s.pomosCompleted,
        };
    });

    // Pet needs
    ipcMain.handle('get-needs', async () => {
        const n = petNeeds.getNeeds();
        return { hunger: n.hunger, energy: n.energy };
    });
    ipcMain.handle('feed-pet', async (event, { amount, type }) => {
        petNeeds.feedPet(amount || 10, type || 'hunger');
        const n = petNeeds.getNeeds();
        return { hunger: n.hunger, energy: n.energy };
    });

    // Audio reactive
    ipcMain.on('set-audio-listening', (event, enabled) => {
        setAudioListeningEnabled(enabled);
        const mw = getMainWindow();
        if (mw && mw.webContents) {
            mw.webContents.send('set-audio-listening', enabled);
        }
    });
    ipcMain.handle('get-audio-listening', async () => getAudioListeningEnabled());
    ipcMain.handle('get-desktop-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: false });
            return sources.map(s => ({ id: s.id, name: s.name }));
        } catch (err) {
            console.error('Failed to get desktop sources:', err);
            return [];
        }
    });

    // Network Discovery
    ipcMain.handle('network-discovery-toggle', async (event, enabled) => {
        if (enabled) networkDiscovery.startNetworkDiscovery();
        else networkDiscovery.stopNetworkDiscovery();
        return networkDiscovery.getNetworkStatus();
    });
    ipcMain.handle('get-network-status', async () => networkDiscovery.getNetworkStatus());
    ipcMain.handle('get-discovered-nodes', async () => networkDiscovery.getDiscoveredNodes());
    ipcMain.handle('send-mesh-message', async (event, text) => networkDiscovery.sendMeshMessage(text));
    ipcMain.handle('get-mesh-messages', async () => await persistence.loadMeshMessagesFromDisk());
    ipcMain.handle('save-mesh-messages', async (event, messages) => { await persistence.saveMeshMessagesToDisk(messages); return true; });
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat window IPC handlers
// ═══════════════════════════════════════════════════════════════════════════

function registerChatIpc() {
    const {
        getMainWindow, getChatWindow, createChatWindow, persistence,
        xpSystem, movement, sleepWork, llm,
        chatHistory, activityLog, saveChatData,
    } = _deps;

    ipcMain.on('open-chat', () => createChatWindow());
    ipcMain.on('close-chat', () => {
        const cw = getChatWindow();
        if (cw) { cw.close(); }
    });
    ipcMain.on('open-settings', () => llm.showChatSettingsDialog());

    ipcMain.on('chat-mood', (event, mood) => {
        const mw = getMainWindow();
        if (mw && mw.webContents) mw.webContents.send('chat-mood', mood);
    });

    ipcMain.on('sync-chat-color', (event, color) => {
        const spriteState = llm.getSpriteState();
        spriteState.color = color;
        const cw = getChatWindow();
        if (cw && cw.webContents) cw.webContents.send('set-color', color);
        llm.syncColorToSettingsWindow(color);
    });

    ipcMain.on('sound-played', (event, soundName) => {
        const mw = getMainWindow();
        if (mw && mw.webContents) mw.webContents.send('sound-played', soundName);
    });

    ipcMain.on('sprite-update', (event, sprite) => {
        const spriteState = llm.getSpriteState();
        spriteState.sprite = sprite;
        const cw = getChatWindow();
        if (cw && cw.webContents) cw.webContents.send('sprite-update', spriteState);
    });

    ipcMain.on('audio-levels', (event, levels) => {
        const cw = getChatWindow();
        if (cw && cw.webContents) cw.webContents.send('audio-levels', levels);
    });

    ipcMain.on('chat-set-movement', (event, mode) => {
        if (['none', 'bounce', 'follow', 'wander'].includes(mode)) movement.setMovementMode(mode);
    });

    ipcMain.on('chat-set-color', (event, color) => {
        llm.broadcastColor(color);
    });

    ipcMain.on('chat-set-language', (event, lang) => {
        xpSystem.getXpData().savedLang = lang;
        xpSystem.saveXpData();
        const mw = getMainWindow();
        if (mw && mw.webContents) mw.webContents.send('set-language', lang);
        const cw = getChatWindow();
        if (cw && cw.webContents) cw.webContents.send('set-language', lang);
    });

    ipcMain.on('chat-set-mute', (event, muted) => {
        const mw = getMainWindow();
        if (mw && mw.webContents) mw.webContents.send('set-mute', muted);
    });

    ipcMain.handle('get-chat-history', async () => ({
        chatHistory: chatHistory(),
        activityLog: activityLog()
    }));

    ipcMain.on('save-chat-message', (event, { role, content }) => {
        chatHistory().push({ role, content, timestamp: Date.now() });
        saveChatData();
    });

    ipcMain.handle('clear-chat-history', async () => {
        chatHistory().length = 0;
        saveChatData();
        return { success: true };
    });

    // Sleep/vibe from chat
    ipcMain.on('chat-set-sleep', (event, sleeping) => {
        if (sleeping) sleepWork.startSleepMode();
        else sleepWork.stopSleepMode();
    });

    ipcMain.on('chat-set-vibe', (event, enabled) => {
        sleepWork.setIsVibing(enabled);
        const mw = getMainWindow();
        if (mw && mw.webContents) mw.webContents.send('set-audio-listening', enabled);
    });

    ipcMain.on('chat-set-zoom', (event, zoom) => {
        persistence.updateWindowStateProperty('chatWindow', 'zoom', zoom);
    });
}

module.exports = {
    init,
    registerMainIpc,
    registerChatIpc,
};

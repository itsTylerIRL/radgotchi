'use strict';

const { BrowserWindow, Tray, Menu, ipcMain, nativeImage, desktopCapturer, screen, shell } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow = null;
let chatWindow = null;
let tray = null;
let isAlwaysOnTop = true;
let isDragging = false;
let audioListeningEnabled = true;
let trayMenuOpen = false;

// Dependencies set during init
let _persistence = null;
let _xpSystem = null;
let _petNeeds = null;
let _pomodoro = null;
let _movement = null;
let _sleepWork = null;
let _llm = null;
let _petMemory = null;
let _systemMonitor = null;
let _networkDiscovery = null;
let _chatHistory = null;
let _activityLog = null;
let _saveChatData = null;
let _addActivityLogEntry = null;

function init(deps) {
    _persistence = deps.persistence;
    _xpSystem = deps.xpSystem;
    _petNeeds = deps.petNeeds;
    _pomodoro = deps.pomodoro;
    _movement = deps.movement;
    _sleepWork = deps.sleepWork;
    _llm = deps.llm;
    _petMemory = deps.petMemory;
    _systemMonitor = deps.systemMonitor;
    _networkDiscovery = deps.networkDiscovery;
    _chatHistory = deps.chatHistory;
    _activityLog = deps.activityLog;
    _saveChatData = deps.saveChatData;
    _addActivityLogEntry = deps.addActivityLogEntry;
}

function getMainWindow() { return mainWindow; }
function getChatWindow() { return chatWindow; }

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const bounds = primaryDisplay.bounds;
    const workArea = primaryDisplay.workAreaSize;

    const winWidth = 240;
    const winHeight = 292;
    const x = Math.max(bounds.x, bounds.x + workArea.width - winWidth - 180);
    const y = Math.max(bounds.y, bounds.y + workArea.height - winHeight - 200);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x, y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: isAlwaysOnTop,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (isAlwaysOnTop) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && isAlwaysOnTop && !trayMenuOpen) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    }, 5000);

    mainWindow.on('blur', () => {
        if (mainWindow && !mainWindow.isDestroyed() && isAlwaysOnTop && !trayMenuOpen) {
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed() && isAlwaysOnTop && !trayMenuOpen) {
                    mainWindow.setAlwaysOnTop(true, 'screen-saver');
                }
            }, 100);
        }
    });

    // Drag IPC
    ipcMain.on('start-drag', () => { isDragging = true; });
    ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
        if (isDragging && mainWindow) {
            const [x, y] = mainWindow.getPosition();
            _movement.safeSetPosition(x + deltaX, y + deltaY);
        }
    });
    ipcMain.on('stop-drag', () => { isDragging = false; });

    ipcMain.on('resize-window', (event, { width, height }) => {
        if (mainWindow) mainWindow.setSize(width, height);
    });

    ipcMain.handle('get-mouse-position', async () => {
        const mousePos = screen.getCursorScreenPoint();
        const windowBounds = mainWindow.getBounds();
        return {
            mouseX: mousePos.x, mouseY: mousePos.y,
            windowX: windowBounds.x, windowY: windowBounds.y,
            windowWidth: windowBounds.width, windowHeight: windowBounds.height
        };
    });

    ipcMain.handle('get-system-metrics', async () => {
        const cpuUsage = _systemMonitor.getCpuUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;
        return {
            cpu: { usage_total: cpuUsage },
            memory: { percent: memPercent },
            temperatures: []
        };
    });

    ipcMain.handle('get-llm-config', async () => {
        const config = _llm.getLlmConfig();
        config.memoryEnabled = _petMemory.isEnabled();
        config.memoryCount = _petMemory.getFacts().length;
        return config;
    });

    ipcMain.handle('save-llm-config', async (event, config) => {
        if (config.memoryEnabled !== undefined) {
            _petMemory.setEnabled(config.memoryEnabled);
        }
        const result = _llm.saveLlmConfig(config);
        if (chatWindow && chatWindow.webContents) {
            chatWindow.webContents.send('pfp-update', { operatorPfp: _llm.getLlmConfig().operatorPfp || null });
        }
        return result;
    });

    ipcMain.handle('clear-pet-memory', async () => {
        _petMemory.clearMemory();
        return { success: true };
    });

    // Chat with LLM (non-streaming)
    ipcMain.handle('send-chat-message', async (event, { messages }) => {
        if (_sleepWork.getIsSleeping()) _sleepWork.stopSleepMode();
        const result = await _llm.sendChatMessage(messages);
        if (result.content) {
            _xpSystem.addXp(_xpSystem.XP_CONFIG.MESSAGE_RECEIVE_XP, 'message-receive');
        }
        return result;
    });

    // Chat with LLM (streaming)
    ipcMain.on('send-chat-message-stream', async (event, { messages }) => {
        if (_sleepWork.getIsSleeping()) _sleepWork.stopSleepMode();
        _llm.sendChatMessageStream(event, messages);
    });

    // XP System IPC
    ipcMain.handle('get-xp-status', async () => {
        const status = _xpSystem.getXpStatus();
        const pState = _pomodoro.getState();
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
            const xpData = _xpSystem.getXpData();
            if (_xpSystem.isAttentionActive()) {
                _xpSystem.resolveAttentionEvent();
                xpData.lastClickXpTime = now;
                return { awarded: true, attentionResolved: true };
            }
            if (now - xpData.lastClickXpTime < _xpSystem.XP_CONFIG.CLICK_COOLDOWN_MS) {
                return { awarded: false, reason: 'cooldown' };
            }
            xpData.lastClickXpTime = now;
            const result = _xpSystem.addXp(_xpSystem.XP_CONFIG.CLICK_XP, 'click');
            return { awarded: true, ...result };
        }
        if (source === 'message-send') {
            const result = _xpSystem.addXp(_xpSystem.XP_CONFIG.MESSAGE_SEND_XP, 'message-send');
            return { awarded: true, ...result };
        }
        return { awarded: false, reason: 'invalid-source' };
    });

    ipcMain.handle('get-attention-status', async () => ({ active: _xpSystem.isAttentionActive() }));

    // Pomodoro IPC
    ipcMain.handle('pomodoro-start', async (event, { mode }) => _pomodoro.startPomodoro(mode || 'work'));
    ipcMain.handle('pomodoro-stop', async () => _pomodoro.stopPomodoro());
    ipcMain.handle('pomodoro-status', async () => {
        const s = _pomodoro.getState();
        return {
            active: s.active, mode: s.mode,
            remaining: s.active ? Math.max(0, s.duration - (Date.now() - s.startTime)) : 0,
            duration: s.duration, pomosCompleted: s.pomosCompleted,
        };
    });

    // Pet needs IPC
    ipcMain.handle('get-needs', async () => {
        const n = _petNeeds.getNeeds();
        return { hunger: n.hunger, energy: n.energy };
    });
    ipcMain.handle('feed-pet', async (event, { amount, type }) => {
        _petNeeds.feedPet(amount || 10, type || 'hunger');
        const n = _petNeeds.getNeeds();
        return { hunger: n.hunger, energy: n.energy };
    });

    // Audio reactive IPC
    ipcMain.on('set-audio-listening', (event, enabled) => {
        audioListeningEnabled = enabled;
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('set-audio-listening', enabled);
        }
    });
    ipcMain.handle('get-audio-listening', async () => audioListeningEnabled);
    ipcMain.handle('get-desktop-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: false });
            return sources.map(s => ({ id: s.id, name: s.name }));
        } catch (err) {
            console.error('Failed to get desktop sources:', err);
            return [];
        }
    });

    // Network Discovery IPC
    ipcMain.handle('network-discovery-toggle', async (event, enabled) => {
        if (enabled) _networkDiscovery.startNetworkDiscovery();
        else _networkDiscovery.stopNetworkDiscovery();
        return _networkDiscovery.getNetworkStatus();
    });
    ipcMain.handle('get-network-status', async () => _networkDiscovery.getNetworkStatus());
    ipcMain.handle('get-discovered-nodes', async () => _networkDiscovery.getDiscoveredNodes());
    ipcMain.handle('send-mesh-message', async (event, text) => _networkDiscovery.sendMeshMessage(text));

    mainWindow.on('closed', () => { mainWindow = null; });

    // Start monitoring
    _systemMonitor.startSystemEventMonitoring();
    _movement.startIdleDetection();
    _xpSystem.startAttentionEventChecks();
}

function createChatWindow() {
    if (chatWindow) {
        chatWindow.focus();
        return;
    }

    const defaultChatBounds = { width: 480, height: 420, x: 0, y: 0 };
    if (mainWindow) {
        const [mainX, mainY] = mainWindow.getPosition();
        defaultChatBounds.x = mainX + 50;
        defaultChatBounds.y = mainY + 150;
    } else {
        const primaryDisplay = screen.getPrimaryDisplay();
        defaultChatBounds.x = primaryDisplay.bounds.width - 400;
        defaultChatBounds.y = primaryDisplay.bounds.height - 450;
    }

    let chatBounds = _persistence.getWindowState('chatWindow', defaultChatBounds);
    chatBounds = _persistence.ensureBoundsOnDisplay(chatBounds);

    chatWindow = new BrowserWindow({
        width: chatBounds.width,
        height: chatBounds.height,
        x: chatBounds.x,
        y: chatBounds.y,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        minWidth: 360,
        minHeight: 300,
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload-chat.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    chatWindow.loadFile('chat.html');
    chatWindow.setVisibleOnAllWorkspaces(true);

    chatWindow.on('moved', () => _persistence.saveWindowState('chatWindow', chatWindow));
    chatWindow.on('resized', () => _persistence.saveWindowState('chatWindow', chatWindow));

    chatWindow.webContents.on('did-finish-load', () => {
        chatWindow.webContents.setZoomFactor(1);

        mainWindow.webContents.executeJavaScript(`({
            color: localStorage.getItem("radgotchi-color") || "#ff3344",
            expressionOnly: localStorage.getItem("radgotchi-expression-only") === "true"
        })`)
            .then(state => {
                const spriteState = _llm.getSpriteState();
                spriteState.color = state.color;
                if (chatWindow) {
                    const xpStatus = _xpSystem.getXpStatus();
                    const pState = _pomodoro.getState();
                    xpStatus.pomodoro = {
                        active: pState.active,
                        mode: pState.mode,
                        remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
                        pomosCompleted: pState.pomosCompleted,
                    };
                    chatWindow.webContents.send('chat-ready', {
                        configured: _llm.getLlmConfig().enabled,
                        movementMode: _movement.getMovementMode(),
                        color: state.color,
                        expressionOnly: state.expressionOnly,
                        xp: xpStatus,
                        needs: _petNeeds.getNeeds(),
                        spriteState: spriteState,
                        operatorPfp: _llm.getLlmConfig().operatorPfp || null,
                        zoom: _persistence.getWindowState('chatWindow', {}).zoom || 100,
                        isSleeping: _sleepWork.getIsSleeping(),
                        language: _xpSystem.getXpData().savedLang || 'en',
                        pomodoroActive: pState.active,
                    });
                }
            })
            .catch(() => {
                if (chatWindow) {
                    chatWindow.webContents.send('chat-ready', {
                        configured: _llm.getLlmConfig().enabled,
                        movementMode: _movement.getMovementMode(),
                        color: '#ff3344',
                        expressionOnly: false,
                        xp: _xpSystem.getXpStatus(),
                        needs: _petNeeds.getNeeds(),
                        spriteState: _llm.getSpriteState(),
                        operatorPfp: _llm.getLlmConfig().operatorPfp || null,
                        zoom: 100,
                        isSleeping: _sleepWork.getIsSleeping(),
                        language: _xpSystem.getXpData().savedLang || 'en',
                        pomodoroActive: _pomodoro.getState().active,
                    });
                }
            });
    });

    chatWindow.on('closed', () => { chatWindow = null; });
}

function registerChatIpc() {
    ipcMain.on('open-chat', () => createChatWindow());
    ipcMain.on('close-chat', () => {
        if (chatWindow) { chatWindow.close(); chatWindow = null; }
    });
    ipcMain.on('open-settings', () => _llm.showChatSettingsDialog());

    ipcMain.on('chat-mood', (event, mood) => {
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('chat-mood', mood);
    });

    ipcMain.on('sync-chat-color', (event, color) => {
        const spriteState = _llm.getSpriteState();
        spriteState.color = color;
        if (chatWindow && chatWindow.webContents) chatWindow.webContents.send('set-color', color);
        _llm.syncColorToSettingsWindow(color);
    });

    ipcMain.on('sound-played', (event, soundName) => {
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('sound-played', soundName);
    });

    ipcMain.on('sprite-update', (event, sprite) => {
        const spriteState = _llm.getSpriteState();
        spriteState.sprite = sprite;
        if (chatWindow && chatWindow.webContents) chatWindow.webContents.send('sprite-update', spriteState);
    });

    ipcMain.on('audio-levels', (event, levels) => {
        if (chatWindow && chatWindow.webContents) chatWindow.webContents.send('audio-levels', levels);
    });

    ipcMain.on('chat-set-movement', (event, mode) => {
        if (['none', 'bounce', 'follow', 'wander'].includes(mode)) _movement.setMovementMode(mode);
    });

    ipcMain.on('chat-set-color', (event, color) => {
        _llm.broadcastColor(color);
    });

    ipcMain.on('chat-set-language', (event, lang) => {
        _xpSystem.getXpData().savedLang = lang;
        _xpSystem.saveXpData();
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('set-language', lang);
        if (chatWindow && chatWindow.webContents) chatWindow.webContents.send('set-language', lang);
    });

    ipcMain.on('chat-set-mute', (event, muted) => {
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('set-mute', muted);
    });

    ipcMain.handle('get-chat-history', async () => ({
        chatHistory: _chatHistory(),
        activityLog: _activityLog()
    }));

    ipcMain.on('save-chat-message', (event, { role, content }) => {
        _chatHistory().push({ role, content, timestamp: Date.now() });
        _saveChatData();
    });

    ipcMain.handle('clear-chat-history', async () => {
        _chatHistory().length = 0;
        _saveChatData();
        return { success: true };
    });

    // Sleep/vibe from chat
    ipcMain.on('chat-set-sleep', (event, sleeping) => {
        if (sleeping) _sleepWork.startSleepMode();
        else _sleepWork.stopSleepMode();
    });

    ipcMain.on('chat-set-vibe', (event, enabled) => {
        _sleepWork.setIsVibing(enabled);
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('set-audio-listening', enabled);
    });

    ipcMain.on('chat-set-zoom', (event, zoom) => {
        _persistence.updateWindowStateProperty('chatWindow', 'zoom', zoom);
    });
}

function createTray() {
    const iconPath = _persistence.getAssetPath('radbro.png');
    let trayIcon;
    const iconSize = process.platform === 'darwin' ? 22 : 16;

    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon.isEmpty()) {
            trayIcon = trayIcon.resize({ width: iconSize, height: iconSize });
            if (process.platform === 'darwin') trayIcon.setTemplateImage(true);
        } else {
            trayIcon = nativeImage.createEmpty();
        }
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);

    const colorSubmenu = _llm.colorPresets.map(preset => ({
        label: preset.label,
        click: () => _llm.broadcastColor(preset.color)
    }));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Radgotchi', enabled: false },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: isAlwaysOnTop,
            click: (menuItem) => {
                isAlwaysOnTop = menuItem.checked;
                if (isAlwaysOnTop) mainWindow.setAlwaysOnTop(true, 'screen-saver');
                else mainWindow.setAlwaysOnTop(false);
            }
        },
        {
            label: 'Reset Position',
            click: () => {
                if (!mainWindow) return;
                const primaryDisplay = screen.getPrimaryDisplay();
                const bounds = primaryDisplay.bounds;
                const workArea = primaryDisplay.workAreaSize;
                const [winWidth, winHeight] = mainWindow.getSize();
                const x = Math.max(bounds.x, bounds.x + workArea.width - winWidth - 180);
                const y = Math.max(bounds.y, bounds.y + workArea.height - winHeight - 200);
                _movement.safeSetPosition(x, y);
            }
        },
        { label: 'RAD Terminal', click: () => createChatWindow() },
        { label: 'Chat Settings', click: () => _llm.showChatSettingsDialog() },
        { type: 'separator' },
        {
            label: 'Show/Hide',
            click: () => { if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show(); }
        },
        { label: 'Dev Tools', click: () => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.openDevTools({ mode: 'detach' }); } },
        { type: 'separator' },
        { label: 'Quit', click: () => require('electron').app.quit() },
        { type: 'separator' },
        { label: 'Say Thanks', click: () => shell.openExternal('https://tylerirl.com/guest-book') }
    ]);

    tray.setToolTip('Radgotchi');
    tray.setContextMenu(contextMenu);
    tray.on('right-click', () => {
        trayMenuOpen = true;
        tray.popUpContextMenu(contextMenu);
        trayMenuOpen = false;
    });
    tray.on('click', () => { if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show(); });
}

module.exports = {
    init,
    getMainWindow,
    getChatWindow,
    createWindow,
    createChatWindow,
    registerChatIpc,
    createTray,
};

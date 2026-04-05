'use strict';

const { BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, shell } = require('electron');
const path = require('path');
const ipcHandlers = require('./ipc-handlers');

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

    // Initialize IPC handlers with shared dependencies
    ipcHandlers.init({
        getMainWindow,
        getChatWindow,
        createChatWindow,
        persistence: _persistence,
        xpSystem: _xpSystem,
        petNeeds: _petNeeds,
        pomodoro: _pomodoro,
        movement: _movement,
        sleepWork: _sleepWork,
        llm: _llm,
        petMemory: _petMemory,
        systemMonitor: _systemMonitor,
        networkDiscovery: _networkDiscovery,
        chatHistory: _chatHistory,
        activityLog: _activityLog,
        saveChatData: _saveChatData,
        getAudioListeningEnabled: () => audioListeningEnabled,
        setAudioListeningEnabled: (v) => { audioListeningEnabled = v; },
    });
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

    // Click-through: allow clicks to pass through transparent areas
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setIgnoreMouseEvents(ignore, options || {});
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

    // Platform info for renderer (used to detect Wayland and disable click-through)
    ipcMain.handle('get-platform-info', async () => {
        const isWayland = process.platform === 'linux' && (
            process.env.XDG_SESSION_TYPE === 'wayland' ||
            process.env.WAYLAND_DISPLAY !== undefined ||
            process.argv.some(arg => arg.includes('ozone-platform=wayland'))
        );
        return {
            platform: process.platform,
            isWayland
        };
    });

    // Register extracted IPC handlers
    ipcHandlers.registerMainIpc();

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
    ipcHandlers.registerChatIpc();
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

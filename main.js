'use strict';

const { app, BrowserWindow, screen, session, desktopCapturer } = require('electron');
const dns = require('dns');
const path = require('path');

// Force IPv4 DNS resolution — prevents IPv6 lookup failures on dual-stack networks
dns.setDefaultResultOrder('ipv4first');

// ═══════════════════════════════════════════════════════════════════════════
// Modules
// ═══════════════════════════════════════════════════════════════════════════
const persistence   = require('./src/main/persistence');
const networkDiscovery = require('./src/main/network-discovery');
const xpSystem      = require('./src/main/xp-system');
const petNeeds      = require('./src/main/pet-needs');
const pomodoro      = require('./src/main/pomodoro');
const systemMonitor = require('./src/main/system-monitor');
const movement      = require('./src/main/movement');
const sleepWork     = require('./src/main/sleep-work');
const selfUpdate    = require('./src/main/self-update');
const petMemory     = require('./src/main/pet-memory');
const llm           = require('./src/main/llm');
const windows       = require('./src/main/windows');
const broadcast     = require('./src/main/broadcast');
const skillLoader   = require('./src/main/skill-loader');
const webServer     = require('./src/main/web-server');
const arcade        = require('./src/main/arcade');

// ═══════════════════════════════════════════════════════════════════════════
// Web mode flag (--web serves chat as HTTP server, no desktop UI)
// ═══════════════════════════════════════════════════════════════════════════
const isWebMode = process.argv.includes('--web');
const webPort = (() => {
    const portArg = process.argv.find(a => a.startsWith('--port='));
    return portArg ? parseInt(portArg.split('=')[1], 10) || 7777 : 7777;
})();

// ═══════════════════════════════════════════════════════════════════════════
// Platform GPU configuration (must happen before app ready)
// ═══════════════════════════════════════════════════════════════════════════
const isLinux = process.platform === 'linux';
if (isLinux) {
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('disable-gpu');
    app.disableHardwareAcceleration();
}

// Gracefully handle GPU process failure instead of crashing
// no-sandbox disables Chromium sandbox for all child processes, needed for
// WASAPI audio loopback and GPU process on network drives / HDR displays.
// Security is maintained via contextIsolation + nodeIntegration:false.
app.commandLine.appendSwitch('no-sandbox');
app.on('gpu-info-update', () => {}); // prevent unhandled event
app.on('child-process-gone', (event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
        console.warn('GPU process gone, falling back to software rendering');
        app.disableHardwareAcceleration();
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// Single instance lock
// ═══════════════════════════════════════════════════════════════════════════
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock && !isWebMode) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const mw = windows.getMainWindow();
        if (mw) {
            if (mw.isMinimized()) mw.restore();
            mw.focus();
            mw.show();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat history & activity log (shared state managed here)
// ═══════════════════════════════════════════════════════════════════════════
const CHAT_HISTORY_CONFIG = { MAX_MESSAGES: 100, MAX_ACTIVITY_LOG: 50 };
let chatHistory = [];
let activityLog = [];
let responseTimes = [];

function loadChatData() {
    try {
        const saved = persistence.loadChatDataFromDisk();
        if (saved) {
            chatHistory = (saved.chatHistory || []).slice(-CHAT_HISTORY_CONFIG.MAX_MESSAGES);
            activityLog = (saved.activityLog || []).slice(-CHAT_HISTORY_CONFIG.MAX_ACTIVITY_LOG);
            responseTimes = (saved.responseTimes || []).slice(-40);
        }
    } catch (e) {
        console.error('Failed to load chat data:', e);
        chatHistory = [];
        activityLog = [];
        responseTimes = [];
    }
}

function saveChatData() {
    try {
        persistence.saveChatDataToDisk({
            chatHistory: chatHistory.slice(-CHAT_HISTORY_CONFIG.MAX_MESSAGES),
            activityLog: activityLog.slice(-CHAT_HISTORY_CONFIG.MAX_ACTIVITY_LOG),
            responseTimes: responseTimes.slice(-40),
            lastSaved: Date.now()
        });
    } catch (e) {
        console.error('Failed to save chat data:', e);
    }
}

function addActivityLogEntry(type, message, messageZh) {
    const entry = { type, message, messageZh: messageZh || message, timestamp: Date.now() };
    activityLog.push(entry);
    if (activityLog.length % 5 === 0) saveChatData();
    if (!isWebMode) {
        const cw = windows.getChatWindow();
        if (cw && cw.webContents) cw.webContents.send('activity-log-update', entry);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Module initialization
// ═══════════════════════════════════════════════════════════════════════════
function initModules() {
    persistence.init(app, screen);
    skillLoader.init(app);
    skillLoader.loadSkills();

    broadcast.init({
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
    });

    petNeeds.init({
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        getIsSleeping: sleepWork.getIsSleeping,
    });

    xpSystem.init({
        persistence,
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        isSleeping: sleepWork.getIsSleeping,
        isUserIdle: movement.getIsUserIdle,
        feedPet: petNeeds.feedPet,
        getPomosCompleted: pomodoro.getPomosCompleted,
        addActivityLogEntry,
    });

    pomodoro.init({
        addXp: xpSystem.addXp,
        feedPet: petNeeds.feedPet,
        addActivityLogEntry,
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        isSleeping: sleepWork.getIsSleeping,
        stopSleepMode: sleepWork.stopSleepMode,
        startWorkAnimation: sleepWork.startWorkAnimation,
        stopWorkAnimation: sleepWork.stopWorkAnimation,
        saveXpData: xpSystem.saveXpData,
        xpData: xpSystem.getXpData,
    });

    movement.init({
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        screen,
        isLinux,
        startIdleDecay: xpSystem.startIdleDecay,
        stopIdleDecay: xpSystem.stopIdleDecay,
        cancelAttentionEvent: xpSystem.cancelAttentionEvent,
    });

    sleepWork.init({
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        xpSystem,
        movement,
        cancelAttentionEvent: xpSystem.cancelAttentionEvent,
    });

    systemMonitor.init({ getMainWindow: windows.getMainWindow });

    llm.init({
        persistence,
        getMainWindow: windows.getMainWindow,
        getChatWindow: windows.getChatWindow,
        screen,
        xpSystem,
        getSleepWork: () => sleepWork,
        getMovement: () => movement,
        petMemory,
        petNeeds,
    });

    networkDiscovery.init({
        getXpData: xpSystem.getXpData,
        getLlmConfig: llm.getLlmConfig,
        getRank: xpSystem.getRank,
        getIsSleeping: sleepWork.getIsSleeping,
        getIsVibing: sleepWork.getIsVibing,
        getPomodoroState: pomodoro.getState,
        getNeeds: petNeeds.getNeeds,
        getColor: () => llm.getSpriteState().color || '#ff3344',
    });

    petMemory.init({ persistence, llm });

    arcade.init({
        xpSystem,
        petNeeds,
        persistence,
        addActivityLogEntry,
    });

    windows.init({
        persistence,
        xpSystem,
        petNeeds,
        pomodoro,
        movement,
        sleepWork,
        llm,
        petMemory,
        systemMonitor,
        networkDiscovery,
        arcade,
        chatHistory: () => chatHistory,
        activityLog: () => activityLog,
        responseTimes: () => responseTimes,
        saveChatData,
        addActivityLogEntry,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Web mode lifecycle (--web flag)
// ═══════════════════════════════════════════════════════════════════════════
function initializeWebMode() {
    initModules();

    // Load persisted data
    llm.loadLlmConfig();
    const loadResult = xpSystem.loadXpData(petNeeds.getNeeds());
    if (loadResult && loadResult.pomosCompleted) {
        pomodoro.setPomosCompleted(loadResult.pomosCompleted);
    }
    petMemory.loadMemory();
    loadChatData();
    persistence.loadWindowStates();

    // Start background systems (no UI needed)
    xpSystem.startPassiveXpGain();
    petNeeds.broadcastNeeds();
    petNeeds.startNeedsDecay();

    // Restore sleep mode if it was active last session
    if (xpSystem.getXpData().savedSleeping) {
        sleepWork.startSleepMode();
    }

    // Restore network discovery if it was active last session
    const ndState = persistence.getWindowState('networkDiscovery', {});
    if (ndState.enabled) {
        networkDiscovery.startNetworkDiscovery();
    }

    // Log session start
    const xpData = xpSystem.getXpData();
    addActivityLogEntry('session-start',
        'Session started (web mode). Session #' + xpData.totalSessions,
        '会话开始 (网页模式)。第 ' + xpData.totalSessions + ' 次会话');

    // Start HTTP + WebSocket server
    webServer.init({
        persistence,
        xpSystem,
        petNeeds,
        pomodoro,
        movement,
        sleepWork,
        llm,
        petMemory,
        systemMonitor,
        networkDiscovery,
        arcade,
        chatHistory: () => chatHistory,
        activityLog: () => activityLog,
        responseTimes: () => responseTimes,
        saveChatData,
        addActivityLogEntry,
    });
    webServer.start(webPort);

    // Keep Electron alive — Electron may exit when no windows are open
    // even though the HTTP server is active on the Node event loop
    const { powerSaveBlocker } = require('electron');
    powerSaveBlocker.start('prevent-app-suspension');
}

// ═══════════════════════════════════════════════════════════════════════════
// App lifecycle
// ═══════════════════════════════════════════════════════════════════════════
function initializeApp() {
    initModules();

    // Load persisted data
    llm.loadLlmConfig();
    const loadResult = xpSystem.loadXpData(petNeeds.getNeeds());
    if (loadResult && loadResult.pomosCompleted) {
        pomodoro.setPomosCompleted(loadResult.pomosCompleted);
    }
    petMemory.loadMemory();
    loadChatData();
    persistence.loadWindowStates();

    // Create UI
    windows.createWindow();
    windows.registerChatIpc();
    windows.createTray();

    // Start background systems
    xpSystem.startPassiveXpGain();
    petNeeds.broadcastNeeds();
    petNeeds.startNeedsDecay();

    // Restore sleep mode if it was active last session
    if (xpSystem.getXpData().savedSleeping) {
        sleepWork.startSleepMode();
    }

    // Restore network discovery if it was active last session
    const ndState = persistence.getWindowState('networkDiscovery', {});
    if (ndState.enabled) {
        networkDiscovery.startNetworkDiscovery();
    }

    // Log session start
    const xpData = xpSystem.getXpData();
    addActivityLogEntry('session-start',
        'Session started. Session #' + xpData.totalSessions,
        '会话开始。第 ' + xpData.totalSessions + ' 次会话');

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) windows.createWindow();
    });
}

app.whenReady().then(() => {
    // Web mode: skip all Electron UI, just serve HTTP
    if (isWebMode) {
        initializeWebMode();
        return;
    }

    // Display media request handler — platform-specific system audio capture
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        if (process.platform === 'win32') {
            // Windows: WASAPI loopback via request.frame (avoids DXGI 10-bit HDR issue)
            callback({ video: request.frame, audio: 'loopback' });
        } else if (process.platform === 'darwin') {
            // macOS: ScreenCaptureKit captures system audio via loopback (macOS 13+)
            desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                callback(sources.length > 0 ? { video: sources[0], audio: 'loopback' } : { video: request.frame, audio: 'loopback' });
            }).catch(() => callback({ video: request.frame, audio: 'loopback' }));
        } else {
            // Linux: provide screen source; renderer will fall back to monitor device if no audio tracks
            desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                callback(sources.length > 0 ? { video: sources[0] } : { video: request.frame });
            }).catch(() => callback({ video: request.frame }));
        }
    });

    // Grant audio/display-capture permissions
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(permission === 'media' || permission === 'display-capture');
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return permission === 'media' || permission === 'display-capture';
    });

    // Handle display removal - reposition to primary display
    screen.on('display-removed', () => {
        const mw = windows.getMainWindow();
        if (mw && !mw.isDestroyed()) {
            movement.stopMovement();
            const primary = screen.getPrimaryDisplay();
            const wb = primary.bounds;
            const wa = primary.workAreaSize;
            const [ww, wh] = mw.getSize();
            const nx = Math.max(wb.x, wb.x + wa.width - ww - 180);
            const ny = Math.max(wb.y, wb.y + wa.height - wh - 200);
            try { mw.setPosition(nx, ny); } catch (_) {}
        }
    });

    if (isLinux) setTimeout(initializeApp, 100);
    else initializeApp();
});

app.on('window-all-closed', () => {});

app.on('will-quit', () => {
    if (isWebMode) {
        webServer.stop();
    } else {
        windows.cleanup();
    }
    systemMonitor.stopSystemEventMonitoring();
    movement.stopMovement();
    movement.stopIdleDetection();
    xpSystem.stopPassiveXpGain();
    xpSystem.stopIdleDecay();
    xpSystem.stopAttentionEventChecks();
    petNeeds.stopNeedsDecay();
    pomodoro.stopPomodoro();
    networkDiscovery.stopNetworkDiscovery();
    xpSystem.saveXpData(petNeeds.getNeeds());
    petMemory.saveMemory();
    saveChatData();
});

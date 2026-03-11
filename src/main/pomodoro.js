'use strict';

const POMODORO_CONFIG = {
    WORK_DURATION_MS: 25 * 60 * 1000,
    BREAK_DURATION_MS: 5 * 60 * 1000,
    LONG_BREAK_MS: 15 * 60 * 1000,
    WORK_XP: 25,
    BREAK_XP: 5,
    FOCUS_BONUS_XP: 10,
};

let pomodoroState = {
    active: false,
    mode: 'work',
    startTime: 0,
    duration: 0,
    pomosCompleted: 0,
    interrupted: false,
};

let pomodoroInterval = null;

let _addXp = null;
let _feedPet = null;
let _addActivityLogEntry = null;
let _getMainWindow = null;
let _getChatWindow = null;
let _isSleeping = null;
let _stopSleepMode = null;
let _startWorkAnimation = null;
let _stopWorkAnimation = null;
let _saveXpData = null;
let _xpData = null;

function init({ addXp, feedPet, addActivityLogEntry, getMainWindow, getChatWindow, isSleeping, stopSleepMode, startWorkAnimation, stopWorkAnimation, saveXpData, xpData }) {
    _addXp = addXp;
    _feedPet = feedPet;
    _addActivityLogEntry = addActivityLogEntry;
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _isSleeping = isSleeping;
    _stopSleepMode = stopSleepMode;
    _startWorkAnimation = startWorkAnimation;
    _stopWorkAnimation = stopWorkAnimation;
    _saveXpData = saveXpData;
    _xpData = xpData;
}

function getPomosCompleted() {
    return pomodoroState.pomosCompleted;
}

function setPomosCompleted(value) {
    pomodoroState.pomosCompleted = value;
}

function getState() {
    return pomodoroState;
}

function startPomodoro(mode = 'work') {
    if (pomodoroState.active) return false;

    if (_isSleeping()) {
        _stopSleepMode();
    }

    const isLongBreak = mode === 'break' && pomodoroState.pomosCompleted > 0 &&
                        pomodoroState.pomosCompleted % 4 === 0;

    pomodoroState.active = true;
    pomodoroState.mode = mode;
    pomodoroState.startTime = Date.now();
    pomodoroState.duration = mode === 'work' ? POMODORO_CONFIG.WORK_DURATION_MS :
                             isLongBreak ? POMODORO_CONFIG.LONG_BREAK_MS :
                             POMODORO_CONFIG.BREAK_DURATION_MS;
    pomodoroState.interrupted = false;

    if (mode === 'work') {
        const xpData = _xpData();
        xpData.workStarted = (xpData.workStarted || 0) + 1;
        _saveXpData();
        _startWorkAnimation();
    }

    pomodoroInterval = setInterval(() => {
        const elapsed = Date.now() - pomodoroState.startTime;
        const remaining = Math.max(0, pomodoroState.duration - elapsed);
        broadcastPomodoro();
        if (remaining <= 0) {
            completePomodoro();
        }
    }, 1000);

    broadcastPomodoro();
    return true;
}

function stopPomodoro() {
    if (!pomodoroState.active) return false;

    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }

    _stopWorkAnimation();
    pomodoroState.active = false;
    pomodoroState.interrupted = true;
    broadcastPomodoro();
    return true;
}

function completePomodoro() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }

    _stopWorkAnimation();
    const completedMode = pomodoroState.mode;

    if (completedMode === 'work') {
        pomodoroState.pomosCompleted++;
        _addXp(POMODORO_CONFIG.WORK_XP, 'pomodoro-work');
        if (!pomodoroState.interrupted) {
            _addXp(POMODORO_CONFIG.FOCUS_BONUS_XP, 'pomodoro-focus-bonus');
        }
        _feedPet(15, 'energy');
    } else {
        _addXp(POMODORO_CONFIG.BREAK_XP, 'pomodoro-break');
        _feedPet(10, 'both');
    }

    pomodoroState.active = false;

    if (completedMode === 'work') {
        _addActivityLogEntry('pomodoro',
            `Pomodoro completed! Total: ${pomodoroState.pomosCompleted}`,
            `番茄钟完成！总计：${pomodoroState.pomosCompleted}`);
    }

    const notification = {
        completed: true,
        mode: completedMode,
        pomosCompleted: pomodoroState.pomosCompleted,
        nextMode: completedMode === 'work' ? 'break' : 'work',
    };

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('pomodoro-complete', notification);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('pomodoro-complete', notification);
    }

    broadcastPomodoro();
}

function broadcastPomodoro() {
    const remaining = pomodoroState.active ?
        Math.max(0, pomodoroState.duration - (Date.now() - pomodoroState.startTime)) : 0;

    const data = {
        active: pomodoroState.active,
        mode: pomodoroState.mode,
        remaining,
        duration: pomodoroState.duration,
        pomosCompleted: pomodoroState.pomosCompleted,
        progress: pomodoroState.active ?
            (Date.now() - pomodoroState.startTime) / pomodoroState.duration : 0,
    };

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('pomodoro-update', data);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('pomodoro-update', data);
    }
}

module.exports = {
    POMODORO_CONFIG,
    init,
    getPomosCompleted,
    setPomosCompleted,
    getState,
    startPomodoro,
    stopPomodoro,
    broadcastPomodoro,
};

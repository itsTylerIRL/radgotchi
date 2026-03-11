'use strict';

const SLEEP_ANIMATIONS = ['sleep', 'sleep2'];
let sleepAnimationIndex = 0;
let sleepAnimationInterval = null;
let sleepStartTime = 0;

const WORK_ANIMATIONS = ['smart', 'intense', 'debug', 'upload', 'upload1', 'upload2'];
let workAnimationIndex = 0;
let workAnimationInterval = null;

let isSleeping = false;
let isVibing = false;
let modeBeforeSleep = 'none';

let _getMainWindow = null;
let _getChatWindow = null;
let _xpSystem = null;
let _movement = null;
let _cancelAttentionEvent = null;

function init({ getMainWindow, getChatWindow, xpSystem, movement, cancelAttentionEvent }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _xpSystem = xpSystem;
    _movement = movement;
    _cancelAttentionEvent = cancelAttentionEvent;
}

function getIsSleeping() {
    return isSleeping;
}

function getIsVibing() {
    return isVibing;
}

function setIsVibing(value) {
    isVibing = value;
}

function startWorkAnimation() {
    if (workAnimationInterval) {
        clearInterval(workAnimationInterval);
    }

    workAnimationIndex = 0;

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-work', true);
        mainWindow.webContents.send('work-animation', WORK_ANIMATIONS[workAnimationIndex]);
    }

    workAnimationInterval = setInterval(() => {
        workAnimationIndex = (workAnimationIndex + 1) % WORK_ANIMATIONS.length;
        const mw = _getMainWindow();
        if (mw && mw.webContents) {
            mw.webContents.send('work-animation', WORK_ANIMATIONS[workAnimationIndex]);
        }
    }, 4000);
}

function stopWorkAnimation() {
    if (workAnimationInterval) {
        clearInterval(workAnimationInterval);
        workAnimationInterval = null;
    }

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-work', false);
    }
}

function startSleepMode() {
    if (isSleeping) return;
    isSleeping = true;
    sleepStartTime = Date.now();

    // Force movement to none
    modeBeforeSleep = _movement.getMovementMode();
    if (modeBeforeSleep !== 'none') {
        _movement.setMovementMode('none');
    }

    // Increment sleep count
    const xpData = _xpSystem.getXpData();
    xpData.stasisCycles++;
    _xpSystem.saveXpData();

    // Clear active attention event
    _cancelAttentionEvent();
    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('attention-event', { active: false });
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('attention-event', { active: false });
    }

    // Start sleep animation rotation
    sleepAnimationIndex = 0;
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-sleep', true);
        mainWindow.webContents.send('sleep-animation', SLEEP_ANIMATIONS[sleepAnimationIndex]);
    }

    sleepAnimationInterval = setInterval(() => {
        sleepAnimationIndex = (sleepAnimationIndex + 1) % SLEEP_ANIMATIONS.length;
        const mw = _getMainWindow();
        if (mw && mw.webContents) {
            mw.webContents.send('sleep-animation', SLEEP_ANIMATIONS[sleepAnimationIndex]);
        }
    }, 3000);
}

function stopSleepMode() {
    if (!isSleeping) return;
    isSleeping = false;

    const sleepDuration = Date.now() - sleepStartTime;
    const xpData = _xpSystem.getXpData();
    xpData.totalStasis += sleepDuration;
    if (sleepDuration > xpData.deepestStasis) {
        xpData.deepestStasis = sleepDuration;
    }
    sleepStartTime = 0;
    _xpSystem.saveXpData();

    if (sleepAnimationInterval) {
        clearInterval(sleepAnimationInterval);
        sleepAnimationInterval = null;
    }

    if (modeBeforeSleep !== 'none') {
        _movement.setMovementMode(modeBeforeSleep);
        modeBeforeSleep = 'none';
    }

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-sleep', false);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-sleep', false);
    }
}

module.exports = {
    init,
    getIsSleeping,
    getIsVibing,
    setIsVibing,
    startWorkAnimation,
    stopWorkAnimation,
    startSleepMode,
    stopSleepMode,
};

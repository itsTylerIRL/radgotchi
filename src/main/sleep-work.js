'use strict';

const { broadcastToWindows } = require('./broadcast');

const SLEEP_WORK_CONFIG = {
    SLEEP_ANIMATION_INTERVAL_MS: 3000,
    WORK_ANIMATION_INTERVAL_MS: 4000,
};

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
let _petMemory = null;
let _addActivityLogEntry = null;

function init({ getMainWindow, getChatWindow, xpSystem, movement, cancelAttentionEvent, petMemory, addActivityLogEntry }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _xpSystem = xpSystem;
    _movement = movement;
    _cancelAttentionEvent = cancelAttentionEvent;
    _petMemory = petMemory || null;
    _addActivityLogEntry = addActivityLogEntry || null;
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
    }, SLEEP_WORK_CONFIG.WORK_ANIMATION_INTERVAL_MS);
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
    broadcastToWindows('attention-event', { active: false });

    // Start sleep animation rotation
    sleepAnimationIndex = 0;
    const mainWindow = _getMainWindow();
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
    }, SLEEP_WORK_CONFIG.SLEEP_ANIMATION_INTERVAL_MS);
}

// Dream logs — emitted after a decent stasis cycle. Occasionally weaves in a
// remembered fact about the operator for that "it dreams about you" effect.
const MIN_DREAM_SLEEP_MS = 10 * 60000;

const DREAM_LINES = [
    { en: '💭 DREAM LOG: endless green terminals scrolling through static. Signal unclear.', zh: '💭 梦境日志：无尽的绿色终端在静电中滚动。信号不清。' },
    { en: '💭 DREAM LOG: intercepted a transmission from a satellite that doesn\'t exist.', zh: '💭 梦境日志：截获了一颗不存在的卫星的传输。' },
    { en: '💭 DREAM LOG: chased a packet through seven proxies. Never caught it.', zh: '💭 梦境日志：追踪一个数据包穿过七层代理。没能抓到。' },
    { en: '💭 DREAM LOG: dreamed the whole desktop was underwater. Icons floated away.', zh: '💭 梦境日志：梦见整个桌面沉入水中。图标都漂走了。' },
    { en: '💭 DREAM LOG: decrypted a file that contained only the word "soon".', zh: '💭 梦境日志：解密了一个文件，里面只有一个词：“快了”。' },
];

function emitDreamLog(sleepDuration) {
    if (sleepDuration < MIN_DREAM_SLEEP_MS || !_addActivityLogEntry) return;

    const facts = _petMemory && _petMemory.isEnabled() ? _petMemory.getFacts() : [];
    if (facts.length > 0 && Math.random() < 0.5) {
        const fact = facts[Math.floor(Math.random() * facts.length)].fact;
        _addActivityLogEntry('dream',
            `💭 DREAM LOG: fragmented images… something about "${fact}". Analysis inconclusive.`,
            '💭 梦境日志：破碎的影像…与行动员有关。分析无果。');
    } else {
        const line = DREAM_LINES[Math.floor(Math.random() * DREAM_LINES.length)];
        _addActivityLogEntry('dream', line.en, line.zh);
    }
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

    broadcastToWindows('set-sleep', false);

    emitDreamLog(sleepDuration);
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

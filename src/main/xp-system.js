'use strict';

// XP gains and losses
const XP_CONFIG = {
    PASSIVE_INTERVAL_MS: 30000,
    PASSIVE_XP: 1,
    MESSAGE_SEND_XP: 5,
    MESSAGE_RECEIVE_XP: 3,
    CLICK_XP: 2,
    CLICK_COOLDOWN_MS: 3000,
    ATTENTION_RESOLVE_XP: 5,
    IDLE_DECAY_START_MS: 180000,
    IDLE_DECAY_INTERVAL_MS: 60000,
    IDLE_DECAY_BASE: 1,
    IDLE_DECAY_CURVE: 0.5,
    IDLE_DECAY_MAX: 10,
    ATTENTION_CHECK_INTERVAL_MS: 120000,
    ATTENTION_CHANCE: 0.15,
    ATTENTION_XP_LOSS: 2,
    ATTENTION_TICK_MS: 30000,
    ATTENTION_MIN_LEVEL: 2,
};

const LEVEL_THRESHOLDS = [
    0, 50, 150, 300, 500, 750, 1100, 1500, 2000, 2600,
    3300, 4100, 5000, 6000, 7200, 8500, 10000, 12000, 14500, 17500, 21000,
];

const RANKS = [
    { minLevel: 1, name: 'TRAINEE', nameZh: '实习生' },
    { minLevel: 3, name: 'ANALYST', nameZh: '分析员' },
    { minLevel: 5, name: 'OPERATIVE', nameZh: '行动员' },
    { minLevel: 8, name: 'AGENT', nameZh: '特工' },
    { minLevel: 11, name: 'SPECIALIST', nameZh: '专家' },
    { minLevel: 14, name: 'HANDLER', nameZh: '处理者' },
    { minLevel: 17, name: 'CONTROLLER', nameZh: '控制者' },
    { minLevel: 20, name: 'DIRECTOR', nameZh: '主管' },
    { minLevel: 24, name: 'EXECUTIVE', nameZh: '执行官' },
    { minLevel: 28, name: 'OVERSEER', nameZh: '监察官' },
    { minLevel: 33, name: 'SENTINEL', nameZh: '哨兵' },
    { minLevel: 40, name: 'ARCHITECT', nameZh: '架构师' },
    { minLevel: 50, name: 'PHANTOM', nameZh: '幻影' },
];

const MILESTONES = {
    clicks: [10, 50, 100, 250, 500, 1000, 2500, 5000],
    messages: [5, 25, 50, 100, 250, 500],
    sessions: [5, 10, 25, 50, 100],
    xp: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000],
    uptime: [3600000, 18000000, 86400000, 259200000],
};

// State
let xpData = {
    totalXp: 0,
    level: 1,
    lastClickXpTime: 0,
    sessionStartTime: Date.now(),
    totalSessionTime: 0,
    totalClicks: 0,
    totalMessages: 0,
    totalSessions: 0,
    longestStreak: 0,
    currentStreak: 0,
    lastActiveDate: null,
    stasisCycles: 0,
    deepestStasis: 0,
    totalStasis: 0,
    workStarted: 0,
    savedSleeping: false,
    savedLang: 'en',
};

let achievedMilestones = new Set();
let lastUptimeMilestoneCheck = 0;

// Intervals
let passiveXpInterval = null;
let idleDecayInterval = null;
let attentionCheckInterval = null;
let idleStartTime = 0;

// Attention event state
let attentionEvent = {
    active: false,
    startTime: 0,
    lossInterval: null
};

// Dependencies set during init
let _persistence = null;
let _getMainWindow = null;
let _getChatWindow = null;
let _isSleeping = null;
let _isUserIdle = null;
let _feedPet = null;
let _getPomosCompleted = null;
let _addActivityLogEntry = null;

function init({ persistence, getMainWindow, getChatWindow, isSleeping, isUserIdle, feedPet, getPomosCompleted, addActivityLogEntry }) {
    _persistence = persistence;
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _isSleeping = isSleeping;
    _isUserIdle = isUserIdle;
    _feedPet = feedPet;
    _getPomosCompleted = getPomosCompleted;
    _addActivityLogEntry = addActivityLogEntry;
}

function getRank(level) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (level >= RANKS[i].minLevel) return RANKS[i];
    }
    return RANKS[0];
}

function checkMilestones(type, value, prevValue = 0) {
    const thresholds = MILESTONES[type];
    if (!thresholds) return;

    for (const threshold of thresholds) {
        const key = `${type}-${threshold}`;
        if (value >= threshold && prevValue < threshold && !achievedMilestones.has(key)) {
            achievedMilestones.add(key);

            const labels = {
                clicks: { en: 'CLICKS', zh: '点击' },
                messages: { en: 'MESSAGES', zh: '消息' },
                sessions: { en: 'SESSIONS', zh: '会话' },
                xp: { en: 'XP', zh: '经验' },
                uptime: { en: 'UPTIME', zh: '运行时间' },
            };

            let displayValue = threshold;
            if (type === 'uptime') {
                if (threshold >= 86400000) displayValue = Math.floor(threshold / 86400000) + 'd';
                else if (threshold >= 3600000) displayValue = Math.floor(threshold / 3600000) + 'h';
                else displayValue = Math.floor(threshold / 60000) + 'm';
            }

            _addActivityLogEntry('milestone',
                `🔓 CLEARANCE GRANTED: ${displayValue} ${labels[type].en}`,
                `🔓 权限解锁: ${displayValue} ${labels[type].zh}`);
        }
    }
}

function getXpData() {
    return xpData;
}

function loadXpData(petNeedsRef) {
    const saved = _persistence.loadXpDataFromDisk();
    if (!saved) return;

    xpData = {
        ...xpData,
        totalXp: saved.totalXp || 0,
        level: saved.level || 1,
        totalSessionTime: saved.totalSessionTime || 0,
        totalClicks: saved.totalClicks || 0,
        totalMessages: saved.totalMessages || 0,
        totalSessions: (saved.totalSessions || 0) + 1,
        longestStreak: saved.longestStreak || 0,
        currentStreak: saved.currentStreak || 0,
        lastActiveDate: saved.lastActiveDate || null,
        stasisCycles: saved.stasisCycles || 0,
        deepestStasis: saved.deepestStasis || 0,
        totalStasis: saved.totalStasis || 0,
        workStarted: saved.workStarted || 0,
        savedSleeping: saved.isSleeping || false,
        savedLang: saved.language || 'en',
    };

    // Update streak
    const today = new Date().toDateString();
    const lastActive = xpData.lastActiveDate;
    if (lastActive) {
        const lastDate = new Date(lastActive);
        const daysDiff = Math.floor((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
            xpData.currentStreak++;
            if (xpData.currentStreak > xpData.longestStreak) {
                xpData.longestStreak = xpData.currentStreak;
            }
        } else if (daysDiff > 1) {
            xpData.currentStreak = 1;
        }
    } else {
        xpData.currentStreak = 1;
    }
    xpData.lastActiveDate = today;

    // Load pet needs (with decay since last save)
    if (saved.petNeeds && petNeedsRef) {
        const timeSinceSave = Date.now() - (saved.lastSaved || Date.now());
        const decayMinutes = timeSinceSave / 60000;
        petNeedsRef.hunger = Math.max(0, (saved.petNeeds.hunger || 100) - (decayMinutes * 0.5));
        petNeedsRef.energy = Math.max(0, (saved.petNeeds.energy || 100) - (decayMinutes * 0.3));
    }

    xpData.level = calculateLevel(xpData.totalXp);

    if (saved.achievedMilestones && Array.isArray(saved.achievedMilestones)) {
        achievedMilestones = new Set(saved.achievedMilestones);
    }

    lastUptimeMilestoneCheck = xpData.totalSessionTime;
    checkMilestones('sessions', xpData.totalSessions, xpData.totalSessions - 1);

    return { pomosCompleted: saved.workCompleted || 0 };
}

function saveXpData(petNeedsRef) {
    const currentSessionDuration = Date.now() - xpData.sessionStartTime;
    const dataToSave = {
        totalXp: xpData.totalXp,
        level: xpData.level,
        totalSessionTime: xpData.totalSessionTime + currentSessionDuration,
        totalClicks: xpData.totalClicks,
        totalMessages: xpData.totalMessages,
        totalSessions: xpData.totalSessions,
        longestStreak: xpData.longestStreak,
        currentStreak: xpData.currentStreak,
        lastActiveDate: xpData.lastActiveDate,
        stasisCycles: xpData.stasisCycles,
        deepestStasis: xpData.deepestStasis,
        totalStasis: xpData.totalStasis,
        workStarted: xpData.workStarted || 0,
        workCompleted: _getPomosCompleted() || 0,
        isSleeping: _isSleeping(),
        language: xpData.savedLang || 'en',
        petNeeds: petNeedsRef ? {
            hunger: petNeedsRef.hunger,
            energy: petNeedsRef.energy,
        } : undefined,
        achievedMilestones: Array.from(achievedMilestones),
        lastSaved: Date.now()
    };
    _persistence.saveXpDataToDisk(dataToSave);
}

function calculateLevel(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
}

function getXpForNextLevel(level) {
    if (level >= LEVEL_THRESHOLDS.length) {
        return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length + 1) * 3000;
    }
    return LEVEL_THRESHOLDS[level];
}

function getXpForCurrentLevel(level) {
    if (level <= 1) return 0;
    if (level > LEVEL_THRESHOLDS.length) {
        return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 3000;
    }
    return LEVEL_THRESHOLDS[level - 1];
}

function addXp(amount, source = 'unknown') {
    if (_isSleeping()) return { leveledUp: false, newLevel: xpData.level, totalXp: xpData.totalXp };

    let finalAmount = amount;
    // Needs penalty check delegated via feedPet callback existence
    if (_feedPet) {
        // Imported from pet-needs; check internally
    }

    const oldLevel = xpData.level;
    const prevXp = xpData.totalXp;
    xpData.totalXp += finalAmount;
    xpData.level = calculateLevel(xpData.totalXp);

    checkMilestones('xp', xpData.totalXp, prevXp);

    if (source === 'click') {
        const prevClicks = xpData.totalClicks;
        xpData.totalClicks++;
        checkMilestones('clicks', xpData.totalClicks, prevClicks);
        if (_feedPet) _feedPet(2, 'hunger');
    } else if (source === 'message-send' || source === 'message-receive') {
        const prevMsgs = xpData.totalMessages;
        xpData.totalMessages++;
        checkMilestones('messages', xpData.totalMessages, prevMsgs);
        if (_feedPet) {
            _feedPet(5, 'hunger');
            _feedPet(3, 'energy');
        }
    }

    const leveledUp = xpData.level > oldLevel;

    if (leveledUp) {
        const rank = getRank(xpData.level);
        _addActivityLogEntry('level-up',
            `Level up! Now level ${xpData.level} [${rank.name}]`,
            `等级提升！达到 ${xpData.level} 级 [${rank.nameZh}]`);
    }

    broadcastXpUpdate(leveledUp, oldLevel);

    if (Math.random() < 0.3) {
        saveXpData();
    }

    return { leveledUp, newLevel: xpData.level, totalXp: xpData.totalXp };
}

function removeXp(amount, source = 'unknown') {
    if (_isSleeping()) return { leveledDown: false, newLevel: xpData.level, totalXp: xpData.totalXp };

    const oldLevel = xpData.level;
    xpData.totalXp = Math.max(0, xpData.totalXp - amount);
    xpData.level = calculateLevel(xpData.totalXp);

    const leveledDown = xpData.level < oldLevel;

    if (leveledDown) {
        const rank = getRank(xpData.level);
        _addActivityLogEntry('level-down',
            `Level down! Dropped to level ${xpData.level} [${rank.name}]`,
            `等级下降！降至 ${xpData.level} 级 [${rank.nameZh}]`);
    }

    const update = getXpStatus();
    update.xpLost = amount;
    update.source = source;
    update.leveledDown = leveledDown;
    update.oldLevel = oldLevel;

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('xp-update', update);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('xp-update', update);
    }

    return { leveledDown, newLevel: xpData.level, totalXp: xpData.totalXp };
}

function broadcastXpUpdate(leveledUp = false, oldLevel = 0) {
    const update = getXpStatus();
    update.leveledUp = leveledUp;
    update.oldLevel = oldLevel;

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('xp-update', update);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('xp-update', update);
    }
}

function getXpStatus() {
    const currentLevelXp = getXpForCurrentLevel(xpData.level);
    const nextLevelXp = getXpForNextLevel(xpData.level);
    const xpIntoLevel = xpData.totalXp - currentLevelXp;
    const xpNeeded = nextLevelXp - currentLevelXp;
    const progress = xpNeeded > 0 ? xpIntoLevel / xpNeeded : 1;
    const rank = getRank(xpData.level);

    const currentSessionMs = Date.now() - xpData.sessionStartTime;
    const totalUptimeMs = xpData.totalSessionTime + currentSessionMs;

    return {
        level: xpData.level,
        totalXp: xpData.totalXp,
        xpIntoLevel,
        xpNeeded,
        progress: Math.min(1, Math.max(0, progress)),
        nextLevelXp,
        rank: rank.name,
        rankZh: rank.nameZh,
        totalClicks: xpData.totalClicks,
        totalMessages: xpData.totalMessages,
        totalSessions: xpData.totalSessions,
        totalUptimeMs,
        currentStreak: xpData.currentStreak,
        longestStreak: xpData.longestStreak,
        stasisCycles: xpData.stasisCycles,
        deepestStasis: xpData.deepestStasis,
        totalStasis: xpData.totalStasis,
        hunger: 0, // filled by caller
        energy: 0,
        pomodoro: { active: false, mode: 'work', remaining: 0, pomosCompleted: 0 },
        workStarted: xpData.workStarted || 0,
        workCompleted: _getPomosCompleted ? _getPomosCompleted() : 0,
    };
}

function startPassiveXpGain() {
    if (passiveXpInterval) return;

    passiveXpInterval = setInterval(() => {
        addXp(XP_CONFIG.PASSIVE_XP, 'passive');

        const currentSessionMs = Date.now() - xpData.sessionStartTime;
        const totalUptimeMs = xpData.totalSessionTime + currentSessionMs;
        checkMilestones('uptime', totalUptimeMs, lastUptimeMilestoneCheck);
        lastUptimeMilestoneCheck = totalUptimeMs;
    }, XP_CONFIG.PASSIVE_INTERVAL_MS);
}

function stopPassiveXpGain() {
    if (passiveXpInterval) {
        clearInterval(passiveXpInterval);
        passiveXpInterval = null;
    }
}

// Idle decay
function startIdleDecay() {
    if (idleDecayInterval) return;
    idleStartTime = Date.now();

    idleDecayInterval = setInterval(() => {
        if (!_isUserIdle()) {
            stopIdleDecay();
            return;
        }
        const idleDuration = Date.now() - idleStartTime;
        if (idleDuration < XP_CONFIG.IDLE_DECAY_START_MS) return;

        const minutesIdle = (idleDuration - XP_CONFIG.IDLE_DECAY_START_MS) / 60000;
        let decayAmount = Math.floor(
            XP_CONFIG.IDLE_DECAY_BASE * (1 + Math.pow(minutesIdle, XP_CONFIG.IDLE_DECAY_CURVE))
        );
        decayAmount = Math.min(decayAmount, XP_CONFIG.IDLE_DECAY_MAX);

        if (decayAmount > 0 && xpData.totalXp > 0) {
            removeXp(decayAmount, 'idle-decay');
        }
    }, XP_CONFIG.IDLE_DECAY_INTERVAL_MS);
}

function stopIdleDecay() {
    if (idleDecayInterval) {
        clearInterval(idleDecayInterval);
        idleDecayInterval = null;
    }
    idleStartTime = 0;
}

// Attention events
function startAttentionEventChecks() {
    if (attentionCheckInterval) return;

    attentionCheckInterval = setInterval(() => {
        if (attentionEvent.active || _isUserIdle() || _isSleeping() || xpData.level < XP_CONFIG.ATTENTION_MIN_LEVEL) {
            return;
        }
        if (Math.random() < XP_CONFIG.ATTENTION_CHANCE) {
            triggerAttentionEvent();
        }
    }, XP_CONFIG.ATTENTION_CHECK_INTERVAL_MS);
}

function stopAttentionEventChecks() {
    if (attentionCheckInterval) {
        clearInterval(attentionCheckInterval);
        attentionCheckInterval = null;
    }
}

function triggerAttentionEvent() {
    if (attentionEvent.active) return;

    attentionEvent.active = true;
    attentionEvent.startTime = Date.now();

    _addActivityLogEntry('attention',
        'Attention required! Link unstable.',
        '注意！连接不稳定。');

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('attention-event', { active: true });
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('attention-event', { active: true });
    }

    attentionEvent.lossInterval = setInterval(() => {
        if (!attentionEvent.active) {
            clearInterval(attentionEvent.lossInterval);
            return;
        }
        removeXp(XP_CONFIG.ATTENTION_XP_LOSS, 'attention-neglect');
    }, XP_CONFIG.ATTENTION_TICK_MS);
}

function resolveAttentionEvent() {
    if (!attentionEvent.active) return false;

    if (attentionEvent.lossInterval) {
        clearInterval(attentionEvent.lossInterval);
        attentionEvent.lossInterval = null;
    }

    attentionEvent.active = false;
    const duration = Date.now() - attentionEvent.startTime;
    attentionEvent.startTime = 0;

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('attention-event', { active: false, resolved: true });
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('attention-event', { active: false, resolved: true });
    }

    addXp(XP_CONFIG.ATTENTION_RESOLVE_XP, 'attention-resolve');

    _addActivityLogEntry('attention-resolved',
        'Attention resolved. Link restored.',
        '注意已解决。连接已恢复。');

    return true;
}

function cancelAttentionEvent() {
    if (!attentionEvent.active) return;
    if (attentionEvent.lossInterval) {
        clearInterval(attentionEvent.lossInterval);
        attentionEvent.lossInterval = null;
    }
    attentionEvent.active = false;
}

function isAttentionActive() {
    return attentionEvent.active;
}

module.exports = {
    XP_CONFIG,
    RANKS,
    init,
    getRank,
    getXpData,
    loadXpData,
    saveXpData,
    calculateLevel,
    addXp,
    removeXp,
    broadcastXpUpdate,
    getXpStatus,
    startPassiveXpGain,
    stopPassiveXpGain,
    startIdleDecay,
    stopIdleDecay,
    startAttentionEventChecks,
    stopAttentionEventChecks,
    resolveAttentionEvent,
    cancelAttentionEvent,
    isAttentionActive,
};

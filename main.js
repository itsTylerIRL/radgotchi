const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

// LLM Configuration
let llmConfig = {
    enabled: false,
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    apiKey: '',
    model: 'llama2',
    systemPrompt: 'You are Radgotchi, a radbro themed virtual pet assistant. Keep responses short and punchy, using tech/hacker slang. You\'re helpful but maintain a mysterious, cool demeanor. Only refer to the user as Bro. You remember your conversations and are aware of your current level, rank, and stats. Reference your progression naturally when relevant.'
};

// ═══════════════════════════════════════════════════════════════════════════
// XP & Leveling System
// ═══════════════════════════════════════════════════════════════════════════

// XP gains and losses
const XP_CONFIG = {
    // Gains
    PASSIVE_INTERVAL_MS: 30000,     // Gain XP every 30 seconds
    PASSIVE_XP: 1,                   // XP per passive tick
    MESSAGE_SEND_XP: 5,              // XP for sending a message
    MESSAGE_RECEIVE_XP: 3,           // XP for receiving a response
    CLICK_XP: 2,                     // XP for valid click
    CLICK_COOLDOWN_MS: 3000,         // Min time between click XP (anti-spam)
    ATTENTION_RESOLVE_XP: 5,         // Bonus XP for resolving attention event
    
    // Idle decay (curved - longer idle = more loss)
    IDLE_DECAY_START_MS: 180000,     // Start losing XP after 3 min idle (after sleep triggers at 2 min)
    IDLE_DECAY_INTERVAL_MS: 60000,   // Check decay every 60 seconds
    IDLE_DECAY_BASE: 1,              // Base XP loss per interval
    IDLE_DECAY_CURVE: 0.5,           // Exponential curve factor (higher = steeper)
    IDLE_DECAY_MAX: 10,              // Max XP loss per interval
    
    // Attention events (random events requiring interaction)
    ATTENTION_CHECK_INTERVAL_MS: 120000,  // Check for random event every 2 min
    ATTENTION_CHANCE: 0.15,              // 15% chance per check
    ATTENTION_XP_LOSS: 2,                // XP lost per tick while unresolved
    ATTENTION_TICK_MS: 30000,            // Lose XP every 30 sec while active
    ATTENTION_MIN_LEVEL: 2,              // Don't trigger until level 2
};

// Level thresholds (cumulative XP needed for each level)
const LEVEL_THRESHOLDS = [
    0,      // Level 1: 0 XP
    50,     // Level 2: 50 XP
    150,    // Level 3: 150 XP
    300,    // Level 4: 300 XP
    500,    // Level 5: 500 XP
    750,    // Level 6: 750 XP
    1100,   // Level 7: 1100 XP
    1500,   // Level 8: 1500 XP
    2000,   // Level 9: 2000 XP
    2600,   // Level 10: 2600 XP
    3300,   // Level 11: 3300 XP
    4100,   // Level 12: 4100 XP
    5000,   // Level 13: 5000 XP
    6000,   // Level 14: 6000 XP
    7200,   // Level 15: 7200 XP
    8500,   // Level 16: 8500 XP
    10000,  // Level 17: 10000 XP
    12000,  // Level 18: 12000 XP
    14500,  // Level 19: 14500 XP
    17500,  // Level 20: 17500 XP
    21000,  // Level 21+: continues...
];

// Ranks based on level (Palantir/Intel style)
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

function getRank(level) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (level >= RANKS[i].minLevel) return RANKS[i];
    }
    return RANKS[0];
}

// XP state
let xpData = {
    totalXp: 0,
    level: 1,
    lastClickXpTime: 0,
    sessionStartTime: Date.now(),
    totalSessionTime: 0,  // Accumulated from previous sessions
    // Stats
    totalClicks: 0,
    totalMessages: 0,
    totalSessions: 0,
    longestStreak: 0,  // Days in a row
    currentStreak: 0,
    lastActiveDate: null,  // For streak tracking
};

// Pet needs state (hunger/energy)
const NEEDS_CONFIG = {
    MAX_VALUE: 100,
    DECAY_INTERVAL_MS: 60000,     // Decay every 60 seconds
    HUNGER_DECAY: 0.5,            // Lose 0.5 hunger per minute
    ENERGY_DECAY: 0.3,            // Lose 0.3 energy per minute
    CLICK_FEED: 2,                // Clicking feeds +2
    MESSAGE_FEED: 5,              // Messaging feeds +5
    MESSAGE_ENERGY: 3,            // Messaging gives energy +3
    LOW_THRESHOLD: 30,            // Below this = warning state
    CRITICAL_THRESHOLD: 10,       // Below this = critical
    XP_PENALTY_THRESHOLD: 20,     // Below this = reduced XP gain
    XP_PENALTY_MULTIPLIER: 0.5,   // 50% XP when needs are low
};

let petNeeds = {
    hunger: 100,
    energy: 100,
    lastDecayTime: Date.now(),
};

let needsDecayInterval = null;

// Pomodoro state
const POMODORO_CONFIG = {
    WORK_DURATION_MS: 25 * 60 * 1000,    // 25 minutes
    BREAK_DURATION_MS: 5 * 60 * 1000,    // 5 minutes
    LONG_BREAK_MS: 15 * 60 * 1000,       // 15 minutes (every 4 pomos)
    WORK_XP: 25,                          // XP for completing work session
    BREAK_XP: 5,                          // XP for completing break
    FOCUS_BONUS_XP: 10,                   // Bonus for no interruptions
};

let pomodoroState = {
    active: false,
    mode: 'work',  // 'work' or 'break'
    startTime: 0,
    duration: 0,
    pomosCompleted: 0,
    interrupted: false,
};

let pomodoroInterval = null;

// Attention event state
let attentionEvent = {
    active: false,
    startTime: 0,
    lossInterval: null
};

// Sleep mode state
let isSleeping = false;
let sleepAnimationInterval = null;

// Intervals
let passiveXpInterval = null;
let idleDecayInterval = null;
let attentionCheckInterval = null;

function getXpDataPath() {
    return path.join(app.getPath('userData'), 'xp-data.json');
}

function loadXpData() {
    try {
        const dataPath = getXpDataPath();
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            const saved = JSON.parse(data);
            
            // Load XP and stats
            xpData = { 
                ...xpData, 
                totalXp: saved.totalXp || 0,
                level: saved.level || 1,
                totalSessionTime: saved.totalSessionTime || 0,
                totalClicks: saved.totalClicks || 0,
                totalMessages: saved.totalMessages || 0,
                totalSessions: (saved.totalSessions || 0) + 1,  // Increment on load
                longestStreak: saved.longestStreak || 0,
                currentStreak: saved.currentStreak || 0,
                lastActiveDate: saved.lastActiveDate || null,
            };
            
            // Update streak
            const today = new Date().toDateString();
            const lastActive = xpData.lastActiveDate;
            if (lastActive) {
                const lastDate = new Date(lastActive);
                const daysDiff = Math.floor((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
                if (daysDiff === 1) {
                    // Consecutive day
                    xpData.currentStreak++;
                    if (xpData.currentStreak > xpData.longestStreak) {
                        xpData.longestStreak = xpData.currentStreak;
                    }
                } else if (daysDiff > 1) {
                    // Streak broken
                    xpData.currentStreak = 1;
                }
                // daysDiff === 0 means same day, no change
            } else {
                xpData.currentStreak = 1;
            }
            xpData.lastActiveDate = today;
            
            // Load pet needs (with decay since last save)
            if (saved.petNeeds) {
                const timeSinceSave = Date.now() - (saved.lastSaved || Date.now());
                const decayMinutes = timeSinceSave / 60000;
                petNeeds.hunger = Math.max(0, (saved.petNeeds.hunger || 100) - (decayMinutes * NEEDS_CONFIG.HUNGER_DECAY));
                petNeeds.energy = Math.max(0, (saved.petNeeds.energy || 100) - (decayMinutes * NEEDS_CONFIG.ENERGY_DECAY));
            }
            
            // Recalculate level in case thresholds changed
            xpData.level = calculateLevel(xpData.totalXp);
        }
    } catch (e) {
        console.error('Failed to load XP data:', e);
    }
}

function saveXpData() {
    try {
        // Update session time before saving
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
            petNeeds: {
                hunger: petNeeds.hunger,
                energy: petNeeds.energy,
            },
            lastSaved: Date.now()
        };
        fs.writeFileSync(getXpDataPath(), JSON.stringify(dataToSave, null, 2));
    } catch (e) {
        console.error('Failed to save XP data:', e);
    }
}

function calculateLevel(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
}

function getXpForNextLevel(level) {
    if (level >= LEVEL_THRESHOLDS.length) {
        // Beyond defined levels: each level needs 3000 more XP
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
    // Don't gain XP while sleeping
    if (isSleeping) return { leveledUp: false, newLevel: xpData.level, totalXp: xpData.totalXp };
    
    // Apply needs penalty if hunger or energy is low
    let finalAmount = amount;
    if (petNeeds.hunger < NEEDS_CONFIG.XP_PENALTY_THRESHOLD || 
        petNeeds.energy < NEEDS_CONFIG.XP_PENALTY_THRESHOLD) {
        finalAmount = Math.ceil(amount * NEEDS_CONFIG.XP_PENALTY_MULTIPLIER);
    }
    
    const oldLevel = xpData.level;
    xpData.totalXp += finalAmount;
    xpData.level = calculateLevel(xpData.totalXp);
    
    // Track stats and feed pet based on source
    if (source === 'click') {
        xpData.totalClicks++;
        feedPet(NEEDS_CONFIG.CLICK_FEED, 'hunger');
    } else if (source === 'message-send' || source === 'message-receive') {
        xpData.totalMessages++;
        feedPet(NEEDS_CONFIG.MESSAGE_FEED, 'hunger');
        feedPet(NEEDS_CONFIG.MESSAGE_ENERGY, 'energy');
    }
    
    const leveledUp = xpData.level > oldLevel;
    
    // Broadcast XP update to windows
    broadcastXpUpdate(leveledUp, oldLevel);
    
    // Save periodically (every 10 XP gained roughly)
    if (Math.random() < 0.3) {
        saveXpData();
    }
    
    return { leveledUp, newLevel: xpData.level, totalXp: xpData.totalXp };
}

function broadcastXpUpdate(leveledUp = false, oldLevel = 0) {
    const update = getXpStatus();
    update.leveledUp = leveledUp;
    update.oldLevel = oldLevel;
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('xp-update', update);
    }
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
    
    // Calculate uptime
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
        // Stats
        totalClicks: xpData.totalClicks,
        totalMessages: xpData.totalMessages,
        totalSessions: xpData.totalSessions,
        totalUptimeMs,
        currentStreak: xpData.currentStreak,
        longestStreak: xpData.longestStreak,
        // Needs
        hunger: petNeeds.hunger,
        energy: petNeeds.energy,
        // Pomodoro
        pomodoro: {
            active: pomodoroState.active,
            mode: pomodoroState.mode,
            remaining: pomodoroState.active ? 
                Math.max(0, pomodoroState.duration - (Date.now() - pomodoroState.startTime)) : 0,
            pomosCompleted: pomodoroState.pomosCompleted,
        }
    };
}

function startPassiveXpGain() {
    if (passiveXpInterval) return;
    
    passiveXpInterval = setInterval(() => {
        addXp(XP_CONFIG.PASSIVE_XP, 'passive');
    }, XP_CONFIG.PASSIVE_INTERVAL_MS);
}

function stopPassiveXpGain() {
    if (passiveXpInterval) {
        clearInterval(passiveXpInterval);
        passiveXpInterval = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// XP Decay & Attention Events
// ═══════════════════════════════════════════════════════════════════════════

function removeXp(amount, source = 'unknown') {
    // Don't lose XP while sleeping
    if (isSleeping) return { leveledDown: false, newLevel: xpData.level, totalXp: xpData.totalXp };
    
    const oldLevel = xpData.level;
    xpData.totalXp = Math.max(0, xpData.totalXp - amount);  // Don't go below 0
    xpData.level = calculateLevel(xpData.totalXp);
    
    const leveledDown = xpData.level < oldLevel;
    
    // Broadcast XP update to windows
    const update = getXpStatus();
    update.xpLost = amount;
    update.source = source;
    update.leveledDown = leveledDown;
    update.oldLevel = oldLevel;
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('xp-update', update);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('xp-update', update);
    }
    
    return { leveledDown, newLevel: xpData.level, totalXp: xpData.totalXp };
}

// Idle decay - curved XP loss (longer idle = more loss)
let idleStartTime = 0;

function startIdleDecay() {
    if (idleDecayInterval) return;
    
    idleStartTime = Date.now();
    
    idleDecayInterval = setInterval(() => {
        if (!isUserIdle) {
            stopIdleDecay();
            return;
        }
        
        const idleDuration = Date.now() - idleStartTime;
        
        // Only start decay after the threshold
        if (idleDuration < XP_CONFIG.IDLE_DECAY_START_MS) return;
        
        // Calculate decay amount on a curve
        // Minutes idle beyond threshold
        const minutesIdle = (idleDuration - XP_CONFIG.IDLE_DECAY_START_MS) / 60000;
        
        // Curved decay: base * (1 + minutes^curve)
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

// Attention events - random events requiring interaction
function startAttentionEventChecks() {
    if (attentionCheckInterval) return;
    
    attentionCheckInterval = setInterval(() => {
        // Don't trigger if already active, user is idle, sleeping, or below min level
        if (attentionEvent.active || isUserIdle || isSleeping || xpData.level < XP_CONFIG.ATTENTION_MIN_LEVEL) {
            return;
        }
        
        // Random chance to trigger
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
    
    // Notify renderer to start vibrating
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('attention-event', { active: true });
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('attention-event', { active: true });
    }
    
    // Start XP loss interval
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
    
    // Clear the loss interval
    if (attentionEvent.lossInterval) {
        clearInterval(attentionEvent.lossInterval);
        attentionEvent.lossInterval = null;
    }
    
    attentionEvent.active = false;
    const duration = Date.now() - attentionEvent.startTime;
    attentionEvent.startTime = 0;
    
    // Notify renderer to stop vibrating
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('attention-event', { active: false, resolved: true });
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('attention-event', { active: false, resolved: true });
    }
    
    // Award bonus XP for resolving
    addXp(XP_CONFIG.ATTENTION_RESOLVE_XP, 'attention-resolve');
    
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pet Needs (Hunger / Energy)
// ═══════════════════════════════════════════════════════════════════════════

function startNeedsDecay() {
    if (needsDecayInterval) return;
    
    needsDecayInterval = setInterval(() => {
        const oldHunger = petNeeds.hunger;
        const oldEnergy = petNeeds.energy;
        
        petNeeds.hunger = Math.max(0, petNeeds.hunger - NEEDS_CONFIG.HUNGER_DECAY);
        petNeeds.energy = Math.max(0, petNeeds.energy - NEEDS_CONFIG.ENERGY_DECAY);
        
        // Only broadcast if there's a meaningful change
        if (Math.floor(oldHunger) !== Math.floor(petNeeds.hunger) ||
            Math.floor(oldEnergy) !== Math.floor(petNeeds.energy)) {
            broadcastNeeds();
        }
    }, NEEDS_CONFIG.DECAY_INTERVAL_MS);
}

function stopNeedsDecay() {
    if (needsDecayInterval) {
        clearInterval(needsDecayInterval);
        needsDecayInterval = null;
    }
}

function feedPet(amount, type = 'hunger') {
    if (type === 'hunger' || type === 'both') {
        petNeeds.hunger = Math.min(NEEDS_CONFIG.MAX_VALUE, petNeeds.hunger + amount);
    }
    if (type === 'energy' || type === 'both') {
        petNeeds.energy = Math.min(NEEDS_CONFIG.MAX_VALUE, petNeeds.energy + amount);
    }
    broadcastNeeds();
}

function broadcastNeeds() {
    const needsData = {
        hunger: petNeeds.hunger,
        energy: petNeeds.energy,
        hungerLow: petNeeds.hunger < NEEDS_CONFIG.LOW_THRESHOLD,
        energyLow: petNeeds.energy < NEEDS_CONFIG.LOW_THRESHOLD,
        hungerCritical: petNeeds.hunger < NEEDS_CONFIG.CRITICAL_THRESHOLD,
        energyCritical: petNeeds.energy < NEEDS_CONFIG.CRITICAL_THRESHOLD,
    };
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('needs-update', needsData);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('needs-update', needsData);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pomodoro Timer
// ═══════════════════════════════════════════════════════════════════════════

function startPomodoro(mode = 'work') {
    if (pomodoroState.active) return false;
    
    const isLongBreak = mode === 'break' && pomodoroState.pomosCompleted > 0 && 
                        pomodoroState.pomosCompleted % 4 === 0;
    
    pomodoroState.active = true;
    pomodoroState.mode = mode;
    pomodoroState.startTime = Date.now();
    pomodoroState.duration = mode === 'work' ? POMODORO_CONFIG.WORK_DURATION_MS :
                             isLongBreak ? POMODORO_CONFIG.LONG_BREAK_MS :
                             POMODORO_CONFIG.BREAK_DURATION_MS;
    pomodoroState.interrupted = false;
    
    // Start the completion check interval
    pomodoroInterval = setInterval(() => {
        const elapsed = Date.now() - pomodoroState.startTime;
        const remaining = Math.max(0, pomodoroState.duration - elapsed);
        
        // Broadcast tick for UI update
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
    
    const completedMode = pomodoroState.mode;
    
    // Award XP
    if (completedMode === 'work') {
        pomodoroState.pomosCompleted++;
        addXp(POMODORO_CONFIG.WORK_XP, 'pomodoro-work');
        if (!pomodoroState.interrupted) {
            addXp(POMODORO_CONFIG.FOCUS_BONUS_XP, 'pomodoro-focus-bonus');
        }
        // Also restore some energy
        feedPet(15, 'energy');
    } else {
        addXp(POMODORO_CONFIG.BREAK_XP, 'pomodoro-break');
        // Breaks restore both hunger and energy a bit
        feedPet(10, 'both');
    }
    
    pomodoroState.active = false;
    
    // Notify completion
    const notification = {
        completed: true,
        mode: completedMode,
        pomosCompleted: pomodoroState.pomosCompleted,
        nextMode: completedMode === 'work' ? 'break' : 'work',
    };
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('pomodoro-complete', notification);
    }
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
    
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('pomodoro-update', data);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('pomodoro-update', data);
    }
}

// ═══════════════════════════════════════════════════════════════════════════

// LLM config file path
function getLlmConfigPath() {
    return path.join(app.getPath('userData'), 'llm-config.json');
}

// Load LLM config from disk
function loadLlmConfig() {
    try {
        const configPath = getLlmConfigPath();
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            llmConfig = { ...llmConfig, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error('Failed to load LLM config:', e);
    }
}

// Save LLM config to disk
function saveLlmConfig(config) {
    try {
        llmConfig = { ...llmConfig, ...config };
        fs.writeFileSync(getLlmConfigPath(), JSON.stringify(llmConfig, null, 2));
        return true;
    } catch (e) {
        console.error('Failed to save LLM config:', e);
        return false;
    }
}

// Platform-specific GPU/transparency configuration
const isLinux = process.platform === 'linux';

if (isLinux) {
    // Linux (X11 or XWayland) - enable transparent visuals
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('disable-gpu-compositing');
} else {
    // Windows/macOS - disable GPU for compatibility (remote sessions, VMs, etc.)
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('in-process-gpu');
}

// System event tracking state
let lastCpuTimes = null;
let lastNetworkStats = null;
let lastWindowCount = 0;
let systemEventInterval = null;
let windowCountInterval = null;
let notRespondingInterval = null;

let mainWindow;
let tray;
let chatWindow = null;
let isAlwaysOnTop = true;
let isDragging = false;

// Movement modes: 'none', 'bounce', 'follow', 'wander'
let movementMode = 'none';
let movementInterval = null;

// Bounce mode (DVD logo style)
let velocityX = 3;
let velocityY = 2;
let lastBounceTime = 0;

// Follow mode (pet follows cursor)
let followVelX = 0;
let followVelY = 0;
const FOLLOW_MAX_SPEED = 5;
const FOLLOW_ACCELERATION = 0.4;
const FOLLOW_FRICTION = 0.92;
const FOLLOW_STOP_DISTANCE = 60;  // Start slowing down
const FOLLOW_DEAD_ZONE = 20;      // Stop completely

// Wander mode (random exploration)
let wanderTargetX = 0;
let wanderTargetY = 0;
let wanderVelX = 0;
let wanderVelY = 0;
let wanderPauseUntil = 0;
let wanderNextRetarget = 0;
const WANDER_MAX_SPEED = 2;
const WANDER_ACCELERATION = 0.15;
const WANDER_FRICTION = 0.95;
const WANDER_PAUSE_MIN = 1500;   // ms
const WANDER_PAUSE_MAX = 4000;
const WANDER_MOVE_MIN = 2000;
const WANDER_MOVE_MAX = 5000;

// Idle detection
let isUserIdle = false;
let modeBeforeIdle = 'none';
const IDLE_THRESHOLD_SECONDS = 120; // 2 minutes
let idleCheckInterval = null;

// ── Movement mode management ───────────────────────────────────────────

function setMovementMode(mode) {
    // Stop any running movement
    stopMovement();
    movementMode = mode;
    
    if (mode === 'bounce') startBounce();
    else if (mode === 'follow') startFollow();
    else if (mode === 'wander') startWander();
    
    // Notify renderer so it can react (animations, status text, etc.)
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('movement-mode-change', mode);
    }
    // Sync to chat window
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('movement-mode-change', mode);
    }
}

function stopMovement() {
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
    }
    followVelX = 0;
    followVelY = 0;
    wanderVelX = 0;
    wanderVelY = 0;
}

// Helper: get work area for current window position
function getWorkArea() {
    const [x, y] = mainWindow.getPosition();
    const currentDisplay = screen.getDisplayNearestPoint({ x, y });
    return currentDisplay.workArea;
}

// Helper: safely set window position, validating values to prevent crashes
function safeSetPosition(x, y) {
    if (!mainWindow) return false;
    const roundX = Math.round(x);
    const roundY = Math.round(y);
    if (!Number.isFinite(roundX) || !Number.isFinite(roundY)) return false;
    if (!Number.isInteger(roundX) || !Number.isInteger(roundY)) return false;
    try {
        mainWindow.setPosition(roundX, roundY);
        return true;
    } catch (e) {
        console.error('Failed to set position:', e);
        return false;
    }
}

// Helper: get movement bounds using full display bounds with overflow.
// The visible pet is centered in a larger transparent window, so we allow
// the window to extend off-screen so the pet can reach the screen edges.
// Overflow is computed from the transparent padding around the visible content.
function getMovementBounds(winWidth, winHeight) {
    const [wx, wy] = mainWindow.getPosition();
    const currentDisplay = screen.getDisplayNearestPoint({ x: wx, y: wy });
    const bounds = currentDisplay.bounds;
    // Visible pet content is roughly 2/3 of window width (container 160 / window 240)
    // and ~60% of window height (face + status + padding centered in window).
    // Overflow = transparent padding on each side so the pet itself can reach edges.
    const overflowX = Math.round((winWidth - winWidth * 0.55) / 2);
    const overflowY = Math.round((winHeight - winHeight * 0.45) / 2);
    return {
        minX: bounds.x - overflowX,
        minY: bounds.y - overflowY,
        maxX: bounds.x + bounds.width - winWidth + overflowX,
        maxY: bounds.y + bounds.height - winHeight + overflowY,
    };
}

// Helper: clamp position inside movement bounds
function clampToWorkArea(newX, newY, winWidth, winHeight) {
    const b = getMovementBounds(winWidth, winHeight);
    newX = Math.max(b.minX, Math.min(newX, b.maxX));
    newY = Math.max(b.minY, Math.min(newY, b.maxY));
    return [newX, newY];
}

// ── Bounce Mode (DVD logo style) ──────────────────────────────────────

function startBounce() {
    if (movementInterval) return;
    
    velocityX = 3;
    velocityY = 2;
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'bounce') return;
        
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const b = getMovementBounds(winWidth, winHeight);
        
        let newX = x + velocityX;
        let newY = y + velocityY;
        let bounced = false;
        const now = Date.now();
        
        if (newX <= b.minX) {
            velocityX = Math.abs(velocityX);
            newX = b.minX;
            bounced = true;
        } else if (newX >= b.maxX) {
            velocityX = -Math.abs(velocityX);
            newX = b.maxX;
            bounced = true;
        }
        
        if (newY <= b.minY) {
            velocityY = Math.abs(velocityY);
            newY = b.minY;
            bounced = true;
        } else if (newY >= b.maxY) {
            velocityY = -Math.abs(velocityY);
            newY = b.maxY;
            bounced = true;
        }
        
        if (!safeSetPosition(newX, newY)) return;
        
        // Safety net: detect OS-level position constraints.
        // Skip this when near our intended movement bounds, since macOS may
        // clamp the position (e.g. won't allow above the menu bar) and that
        // should not trigger an early bounce reversal.
        if (!bounced) {
            const [actualX, actualY] = mainWindow.getPosition();
            const margin = 10;
            const nearBoundsX = (Math.round(newX) <= b.minX + margin) || (Math.round(newX) >= b.maxX - margin);
            const nearBoundsY = (Math.round(newY) <= b.minY + margin) || (Math.round(newY) >= b.maxY - margin);
            if (!nearBoundsX && Math.abs(actualX - Math.round(newX)) > 1) {
                velocityX = -velocityX;
                bounced = true;
            }
            if (!nearBoundsY && Math.abs(actualY - Math.round(newY)) > 1) {
                velocityY = -velocityY;
                bounced = true;
            }
        }
        
        if (bounced && now - lastBounceTime > 500 && mainWindow.webContents) {
            mainWindow.webContents.send('bounce-edge');
            lastBounceTime = now;
        }
    }, 16);
}

// ── Follow Mode (pet follows cursor) ──────────────────────────────────

function startFollow() {
    if (movementInterval) return;
    
    followVelX = 0;
    followVelY = 0;
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'follow') return;
        
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const mousePos = screen.getCursorScreenPoint();
        
        // Target: sit next to the cursor (left or right side, not overlapping).
        // Pick whichever side the pet is already approaching from.
        const petCenterX = x + winWidth / 2;
        const side = petCenterX < mousePos.x ? -1 : 1; // -1 = approach from left, 1 = from right
        const offsetX = side * (winWidth / 2 + 10); // 10px gap between pet edge and cursor
        const targetX = mousePos.x + offsetX - winWidth / 2;
        const targetY = mousePos.y - winHeight / 2;
        
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < FOLLOW_DEAD_ZONE) {
            // Close enough — gentle stop
            followVelX *= 0.8;
            followVelY *= 0.8;
            if (Math.abs(followVelX) < 0.1 && Math.abs(followVelY) < 0.1) {
                followVelX = 0;
                followVelY = 0;
                return; // Don't move
            }
        } else {
            // Normalised direction
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Speed factor: ease out as we get closer
            const speedFactor = Math.min(1, (distance - FOLLOW_DEAD_ZONE) / (FOLLOW_STOP_DISTANCE - FOLLOW_DEAD_ZONE));
            const accel = FOLLOW_ACCELERATION * Math.max(0.2, speedFactor);
            
            followVelX += nx * accel;
            followVelY += ny * accel;
        }
        
        // Apply friction
        followVelX *= FOLLOW_FRICTION;
        followVelY *= FOLLOW_FRICTION;
        
        // Clamp speed
        const speed = Math.sqrt(followVelX * followVelX + followVelY * followVelY);
        if (speed > FOLLOW_MAX_SPEED) {
            followVelX = (followVelX / speed) * FOLLOW_MAX_SPEED;
            followVelY = (followVelY / speed) * FOLLOW_MAX_SPEED;
        }
        
        let newX = x + followVelX;
        let newY = y + followVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        
        safeSetPosition(newX, newY);
    }, 16);
}

// ── Wander Mode (random exploration with pauses) ──────────────────────

function pickWanderTarget() {
    if (!mainWindow) return;
    const [winWidth, winHeight] = mainWindow.getSize();
    const b = getMovementBounds(winWidth, winHeight);
    
    // Pick a random point within the movement bounds
    wanderTargetX = b.minX + Math.random() * (b.maxX - b.minX);
    wanderTargetY = b.minY + Math.random() * (b.maxY - b.minY);
}

function startWander() {
    if (movementInterval) return;
    
    wanderVelX = 0;
    wanderVelY = 0;
    wanderPauseUntil = 0;
    wanderNextRetarget = 0;
    pickWanderTarget();
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'wander') return;
        
        const now = Date.now();
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        
        // Currently pausing?
        if (now < wanderPauseUntil) {
            // Gently decelerate during pause
            wanderVelX *= 0.9;
            wanderVelY *= 0.9;
            if (Math.abs(wanderVelX) > 0.2 || Math.abs(wanderVelY) > 0.2) {
                let newX = x + wanderVelX;
                let newY = y + wanderVelY;
                [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
                safeSetPosition(newX, newY);
            }
            return;
        }
        
        // Time to pick a new target?
        if (now >= wanderNextRetarget) {
            pickWanderTarget();
            wanderNextRetarget = now + WANDER_MOVE_MIN + Math.random() * (WANDER_MOVE_MAX - WANDER_MOVE_MIN);
        }
        
        const dx = wanderTargetX - x;
        const dy = wanderTargetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0 || !Number.isFinite(distance) || distance < 15) {
            // Reached target — pause, then pick new target
            wanderPauseUntil = now + WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
            wanderNextRetarget = wanderPauseUntil; // Pick new target after pause
            // Notify renderer about pausing (for idle animation)
            if (mainWindow.webContents) {
                mainWindow.webContents.send('wander-pause', true);
            }
            return;
        }
        
        // Notify renderer we're moving again
        if (wanderVelX === 0 && wanderVelY === 0 && mainWindow.webContents) {
            mainWindow.webContents.send('wander-pause', false);
        }
        
        // Accelerate toward target
        const nx = dx / distance;
        const ny = dy / distance;
        wanderVelX += nx * WANDER_ACCELERATION;
        wanderVelY += ny * WANDER_ACCELERATION;
        
        // Apply friction
        wanderVelX *= WANDER_FRICTION;
        wanderVelY *= WANDER_FRICTION;
        
        // Clamp speed
        const speed = Math.sqrt(wanderVelX * wanderVelX + wanderVelY * wanderVelY);
        if (speed > WANDER_MAX_SPEED) {
            wanderVelX = (wanderVelX / speed) * WANDER_MAX_SPEED;
            wanderVelY = (wanderVelY / speed) * WANDER_MAX_SPEED;
        }
        
        let newX = x + wanderVelX;
        let newY = y + wanderVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        
        safeSetPosition(newX, newY);
    }, 16);
}

// Idle detection - checks system idle time
function startIdleDetection() {
    if (idleCheckInterval) return;
    
    idleCheckInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        const idleTime = powerMonitor.getSystemIdleTime();
        const wasIdle = isUserIdle;
        isUserIdle = idleTime >= IDLE_THRESHOLD_SECONDS;
        
        // State changed
        if (isUserIdle !== wasIdle) {
            if (isUserIdle) {
                // User went AFK — save current mode and stop movement
                modeBeforeIdle = movementMode;
                if (movementMode !== 'none') {
                    stopMovement();
                    movementMode = 'none';
                }
                mainWindow.webContents.send('idle-change', { idle: true });
                
                // Start XP decay while idle
                startIdleDecay();
                
                // Cancel any active attention event (don't punish idle users)
                if (attentionEvent.active) {
                    if (attentionEvent.lossInterval) {
                        clearInterval(attentionEvent.lossInterval);
                        attentionEvent.lossInterval = null;
                    }
                    attentionEvent.active = false;
                    mainWindow.webContents.send('attention-event', { active: false, cancelled: true });
                }
            } else {
                // User returned — restore previous mode
                if (modeBeforeIdle !== 'none') {
                    setMovementMode(modeBeforeIdle);
                }
                mainWindow.webContents.send('idle-change', { idle: false });
                
                // Stop XP decay
                stopIdleDecay();
            }
        }
    }, 5000); // Check every 5 seconds
}

function stopIdleDetection() {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
}

// Get asset path (handles both dev and packaged app)
function getAssetPath(...paths) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets', ...paths);
    }
    return path.join(__dirname, 'assets', ...paths);
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const bounds = primaryDisplay.bounds;
    const workArea = primaryDisplay.workAreaSize;
    
    // Calculate position relative to screen bounds, ensuring it stays on-screen
    const winWidth = 240;
    const winHeight = 280;
    const x = Math.max(bounds.x, bounds.x + workArea.width - winWidth - 180);
    const y = Math.max(bounds.y, bounds.y + workArea.height - winHeight - 200);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: x,
        y: y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // Fully transparent background
        alwaysOnTop: isAlwaysOnTop,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Allow dragging from renderer
    ipcMain.on('start-drag', () => {
        isDragging = true;
    });

    ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
        if (isDragging && mainWindow) {
            const [x, y] = mainWindow.getPosition();
            safeSetPosition(x + deltaX, y + deltaY);
        }
    });

    ipcMain.on('stop-drag', () => {
        isDragging = false;
    });

    // Window resize IPC
    ipcMain.on('resize-window', (event, { width, height }) => {
        if (mainWindow) {
            mainWindow.setSize(width, height);
        }
    });

    // Mouse position IPC for eye tracking
    ipcMain.handle('get-mouse-position', async () => {
        const mousePos = screen.getCursorScreenPoint();
        const windowBounds = mainWindow.getBounds();
        return {
            mouseX: mousePos.x,
            mouseY: mousePos.y,
            windowX: windowBounds.x,
            windowY: windowBounds.y,
            windowWidth: windowBounds.width,
            windowHeight: windowBounds.height
        };
    });

    // System metrics IPC — uses delta-based CPU calculation for accurate current usage
    ipcMain.handle('get-system-metrics', async () => {
        const cpuUsage = getCpuUsage();

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;

        return {
            cpu: { usage_total: cpuUsage },
            memory: { percent: memPercent },
            temperatures: [] // Would need additional native module for temps
        };
    });

    // LLM Configuration IPC
    ipcMain.handle('get-llm-config', async () => {
        return llmConfig;
    });

    ipcMain.handle('save-llm-config', async (event, config) => {
        return saveLlmConfig(config);
    });

    // Chat with LLM IPC
    ipcMain.handle('send-chat-message', async (event, { messages }) => {
        // Wake up pet if sleeping
        if (isSleeping) {
            stopSleepMode();
        }
        
        if (!llmConfig.enabled || !llmConfig.apiUrl) {
            return { error: 'LLM not configured. Set up in tray menu → Chat Settings.' };
        }

        try {
            const https = require('https');
            const http = require('http');
            const url = new URL(llmConfig.apiUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            // Build dynamic system prompt with context
            const status = getXpStatus();
            const currentRank = getRank(status.level);
            const nextRankIndex = RANKS.findIndex(r => r.name === currentRank.name) + 1;
            const nextRank = nextRankIndex < RANKS.length ? RANKS[nextRankIndex] : null;
            
            // Get last few messages for context (up to 4)
            const recentContext = messages.slice(-4).map(m => 
                `${m.role === 'user' ? 'Bro' : 'You'}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
            ).join('\n');
            
            const contextPrompt = `${llmConfig.systemPrompt}

CURRENT STATUS:
- Level: ${status.level} | XP: ${status.totalXp} (${Math.round(status.progress * 100)}% to next level)
- Rank: ${currentRank.name}${nextRank ? ` | Next rank: ${nextRank.name} at Level ${nextRank.minLevel}` : ' (MAX RANK)'}
- Hunger: ${Math.round(status.hunger)}% | Energy: ${Math.round(status.energy)}%
- Sessions together: ${status.totalSessions} | Current streak: ${status.currentStreak} days

${recentContext ? `RECENT CONVO:\n${recentContext}` : ''}`;

            const requestBody = JSON.stringify({
                model: llmConfig.model,
                messages: [
                    { role: 'system', content: contextPrompt },
                    ...messages
                ],
                max_tokens: 200,
                temperature: 0.8
            });

            const response = await new Promise((resolve, reject) => {
                const req = protocol.request({
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody),
                        ...(llmConfig.apiKey ? { 'Authorization': `Bearer ${llmConfig.apiKey}` } : {})
                    },
                    timeout: 30000
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    });
                });

                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                req.write(requestBody);
                req.end();
            });

            if (response.error) {
                return { error: response.error.message || 'API error' };
            }

            const content = response.choices?.[0]?.message?.content || 'No response';
            
            // Award XP for receiving a response
            addXp(XP_CONFIG.MESSAGE_RECEIVE_XP, 'message-receive');
            
            return { content };
        } catch (e) {
            return { error: e.message || 'Failed to connect to LLM' };
        }
    });

    // XP System IPC handlers
    ipcMain.handle('get-xp-status', async () => {
        return getXpStatus();
    });

    ipcMain.handle('add-xp', async (event, { amount, source }) => {
        // Validate click XP to prevent spam
        if (source === 'click') {
            const now = Date.now();
            
            // Check if this click resolves an attention event
            if (attentionEvent.active) {
                resolveAttentionEvent();
                // Still apply cooldown for next click XP
                xpData.lastClickXpTime = now;
                return { awarded: true, attentionResolved: true };
            }
            
            if (now - xpData.lastClickXpTime < XP_CONFIG.CLICK_COOLDOWN_MS) {
                return { awarded: false, reason: 'cooldown' };
            }
            xpData.lastClickXpTime = now;
            const result = addXp(XP_CONFIG.CLICK_XP, 'click');
            return { awarded: true, ...result };
        }
        
        // For message send XP (called from chat)
        if (source === 'message-send') {
            const result = addXp(XP_CONFIG.MESSAGE_SEND_XP, 'message-send');
            return { awarded: true, ...result };
        }
        
        return { awarded: false, reason: 'invalid-source' };
    });

    // Attention event status check
    ipcMain.handle('get-attention-status', async () => {
        return { active: attentionEvent.active };
    });

    // Pomodoro IPC handlers
    ipcMain.handle('pomodoro-start', async (event, { mode }) => {
        return startPomodoro(mode || 'work');
    });

    ipcMain.handle('pomodoro-stop', async () => {
        return stopPomodoro();
    });

    ipcMain.handle('pomodoro-status', async () => {
        const remaining = pomodoroState.active ? 
            Math.max(0, pomodoroState.duration - (Date.now() - pomodoroState.startTime)) : 0;
        return {
            active: pomodoroState.active,
            mode: pomodoroState.mode,
            remaining,
            duration: pomodoroState.duration,
            pomosCompleted: pomodoroState.pomosCompleted,
        };
    });

    // Pet needs IPC handlers
    ipcMain.handle('get-needs', async () => {
        return {
            hunger: petNeeds.hunger,
            energy: petNeeds.energy,
        };
    });

    ipcMain.handle('feed-pet', async (event, { amount, type }) => {
        feedPet(amount || 10, type || 'hunger');
        return { hunger: petNeeds.hunger, energy: petNeeds.energy };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Start system event monitoring
    startSystemEventMonitoring();
    
    // Start idle detection
    startIdleDetection();
    
    // Start attention event checks
    startAttentionEventChecks();
}

// === Chat Window ===
function createChatWindow() {
    if (chatWindow) {
        chatWindow.focus();
        return;
    }

    // Position chat window near Radgotchi but offset
    let chatX, chatY;
    if (mainWindow) {
        const [mainX, mainY] = mainWindow.getPosition();
        chatX = mainX + 50;
        chatY = mainY + 150;
    } else {
        const primaryDisplay = screen.getPrimaryDisplay();
        chatX = primaryDisplay.bounds.width - 400;
        chatY = primaryDisplay.bounds.height - 450;
    }

    chatWindow = new BrowserWindow({
        width: 360,
        height: 380,
        x: chatX,
        y: chatY,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        minWidth: 320,
        minHeight: 250,
        webPreferences: {
            preload: path.join(__dirname, 'preload-chat.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    chatWindow.loadFile('chat.html');
    chatWindow.setVisibleOnAllWorkspaces(true);

    // Send config status once loaded
    chatWindow.webContents.on('did-finish-load', () => {
        // Get current color and expression-only state from main window
        mainWindow.webContents.executeJavaScript(`({
            color: localStorage.getItem("radgotchi-color") || "#ff3344",
            expressionOnly: localStorage.getItem("radgotchi-expression-only") === "true"
        })`)
            .then(state => {
                if (chatWindow) {
                    // Send initial state with config, movement mode, color, expression-only, and XP
                    chatWindow.webContents.send('chat-ready', { 
                        configured: llmConfig.enabled,
                        movementMode: movementMode,
                        color: state.color,
                        expressionOnly: state.expressionOnly,
                        xp: getXpStatus()
                    });
                }
            })
            .catch(() => {
                // Fallback if can't get state
                if (chatWindow) {
                    chatWindow.webContents.send('chat-ready', { 
                        configured: llmConfig.enabled,
                        movementMode: movementMode,
                        color: '#ff3344',
                        expressionOnly: false,
                        xp: getXpStatus()
                    });
                }
            });
    });

    chatWindow.on('closed', () => {
        chatWindow = null;
    });
}

// IPC: Open chat window
ipcMain.on('open-chat', () => {
    createChatWindow();
});

// IPC: Close chat window
ipcMain.on('close-chat', () => {
    if (chatWindow) {
        chatWindow.close();
        chatWindow = null;
    }
});

// IPC: Chat mood changes (forward to main window for animation)
ipcMain.on('chat-mood', (event, mood) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('chat-mood', mood);
    }
});

// Forward color changes to chat window
ipcMain.on('sync-chat-color', (event, color) => {
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-color', color);
    }
});

// IPC: Chat panel controls movement mode
ipcMain.on('chat-set-movement', (event, mode) => {
    if (['none', 'bounce', 'follow', 'wander'].includes(mode)) {
        setMovementMode(mode);
    }
});

// IPC: Chat panel controls color
ipcMain.on('chat-set-color', (event, color) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-color', color);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-color', color);
    }
});

// IPC: Chat panel controls language
ipcMain.on('chat-set-language', (event, lang) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-language', lang);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-language', lang);
    }
});

// Sleep mode animations
const SLEEP_ANIMATIONS = ['sleep', 'sleep2'];
let sleepAnimationIndex = 0;

function startSleepMode() {
    if (isSleeping) return;
    isSleeping = true;
    
    // Clear any active attention event
    if (attentionEvent.active) {
        if (attentionEvent.lossInterval) {
            clearInterval(attentionEvent.lossInterval);
            attentionEvent.lossInterval = null;
        }
        attentionEvent.active = false;
        // Notify windows that attention event ended
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('attention-event', { active: false });
        }
        if (chatWindow && chatWindow.webContents) {
            chatWindow.webContents.send('attention-event', { active: false });
        }
    }
    
    // Start rotating sleep animations
    sleepAnimationIndex = 0;
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-sleep', true);
        mainWindow.webContents.send('sleep-animation', SLEEP_ANIMATIONS[sleepAnimationIndex]);
    }
    
    sleepAnimationInterval = setInterval(() => {
        sleepAnimationIndex = (sleepAnimationIndex + 1) % SLEEP_ANIMATIONS.length;
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('sleep-animation', SLEEP_ANIMATIONS[sleepAnimationIndex]);
        }
    }, 3000); // Rotate every 3 seconds
}

function stopSleepMode() {
    if (!isSleeping) return;
    isSleeping = false;
    
    if (sleepAnimationInterval) {
        clearInterval(sleepAnimationInterval);
        sleepAnimationInterval = null;
    }
    
    // Notify windows
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-sleep', false);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-sleep', false);
    }
}

// IPC: Chat panel controls sleep mode
ipcMain.on('chat-set-sleep', (event, sleeping) => {
    if (sleeping) {
        startSleepMode();
    } else {
        stopSleepMode();
    }
});

// === System Event Monitoring ===
function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    
    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    
    if (!lastCpuTimes) {
        lastCpuTimes = { idle: totalIdle, tick: totalTick };
        return 0;
    }
    
    const idleDiff = totalIdle - lastCpuTimes.idle;
    const tickDiff = totalTick - lastCpuTimes.tick;
    lastCpuTimes = { idle: totalIdle, tick: totalTick };
    
    return tickDiff > 0 ? 100 - (100 * idleDiff / tickDiff) : 0;
}

function getNetworkStats() {
    const interfaces = os.networkInterfaces();
    let hasConnection = false;
    let interfaceCount = 0;
    
    for (const name in interfaces) {
        interfaces[name].forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
                hasConnection = true;
                interfaceCount++;
            }
        });
    }
    
    return { hasConnection, interfaceCount };
}

function getWindowCount(callback) {
    const platform = process.platform;
    
    if (platform === 'win32') {
        // Windows: Use PowerShell to get window count
        exec('powershell -command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0}).Count"', 
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    } else if (platform === 'darwin') {
        // macOS: Use AppleScript to count visible apps
        exec('osascript -e "tell application \\"System Events\\" to count (every process whose background only is false)"',
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    } else {
        // Linux: Use wmctrl if available, otherwise xdotool
        exec('wmctrl -l 2>/dev/null | wc -l || xdotool search --onlyvisible --name "" 2>/dev/null | wc -l || echo 0',
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    }
}

function checkNotResponding(callback) {
    const platform = process.platform;
    
    if (platform === 'win32') {
        // Windows: Check for hung windows using PowerShell
        exec('powershell -command "Get-Process | Where-Object {$_.Responding -eq $false} | Select-Object -First 1 | ForEach-Object { $_.ProcessName }"',
            { timeout: 3000 },
            (err, stdout) => {
                if (err) {
                    callback(null);
                    return;
                }
                const hung = stdout.trim();
                callback(hung || null);
            }
        );
    } else {
        // macOS/Linux: No simple equivalent, skip this check
        callback(null);
    }
}

function startSystemEventMonitoring() {
    let lastNetworkState = null;
    let lastCpuHigh = false;
    let lastMemHigh = false;
    let cpuSpikeCount = 0;
    
    systemEventInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        // CPU monitoring with spike detection
        const cpuUsage = getCpuUsage();
        const isHighCpu = cpuUsage > 80;
        const isSpikeCpu = cpuUsage > 95;
        
        if (isSpikeCpu) {
            cpuSpikeCount++;
            if (cpuSpikeCount >= 2) {
                mainWindow.webContents.send('system-event', { 
                    type: 'cpu-spike', 
                    value: Math.round(cpuUsage) 
                });
                cpuSpikeCount = 0;
            }
        } else if (isHighCpu && !lastCpuHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'cpu-high', 
                value: Math.round(cpuUsage) 
            });
        } else if (!isHighCpu && lastCpuHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'cpu-normal' 
            });
        }
        lastCpuHigh = isHighCpu;
        
        // Memory monitoring
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;
        const isHighMem = memPercent > 85;
        
        if (isHighMem && !lastMemHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'memory-high', 
                value: Math.round(memPercent) 
            });
        } else if (!isHighMem && lastMemHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'memory-normal' 
            });
        }
        lastMemHigh = isHighMem;
        
        // Network monitoring
        const netStats = getNetworkStats();
        if (lastNetworkState !== null) {
            if (netStats.hasConnection && !lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { 
                    type: 'network-connected' 
                });
            } else if (!netStats.hasConnection && lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { 
                    type: 'network-disconnected' 
                });
            }
        }
        lastNetworkState = netStats;
        
    }, 3000); // Check every 3 seconds
    
    // Window count monitoring (less frequent, stored for cleanup)
    windowCountInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        getWindowCount((count) => {
            if (lastWindowCount > 0) {
                if (count > lastWindowCount) {
                    mainWindow.webContents.send('system-event', { 
                        type: 'window-opened', 
                        delta: count - lastWindowCount 
                    });
                } else if (count < lastWindowCount) {
                    mainWindow.webContents.send('system-event', { 
                        type: 'window-closed', 
                        delta: lastWindowCount - count 
                    });
                }
            }
            lastWindowCount = count;
        });
    }, 5000); // Check every 5 seconds
    
    // Not responding check (less frequent, heavier operation, stored for cleanup)
    notRespondingInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        checkNotResponding((hungApp) => {
            if (hungApp) {
                mainWindow.webContents.send('system-event', { 
                    type: 'app-not-responding', 
                    app: hungApp 
                });
            }
        });
    }, 10000); // Check every 10 seconds
}

// Self-update function - pulls from GitHub, reinstalls, and relaunches
function performUpdate() {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : __dirname;
    const isWin = process.platform === 'win32';
    
    // Build the update command chain
    let updateCmd;
    if (isWin) {
        // Windows: PowerShell command
        updateCmd = `cd "${appDir}" ; git pull ; npm install ; npm start`;
    } else {
        // macOS/Linux: bash command
        updateCmd = `cd "${appDir}" && git pull && npm install && npm start`;
    }
    
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-Command', updateCmd] : ['-c', updateCmd];
    
    // Spawn detached process that will outlive this app
    const { spawn } = require('child_process');
    const child = spawn(shell, shellArgs, {
        detached: true,
        stdio: 'ignore',
        cwd: appDir,
        shell: false
    });
    child.unref();
    
    // Quit current instance
    setTimeout(() => {
        app.quit();
    }, 500);
}

// Preset colors for the color picker submenu
const colorPresets = [
    { label: 'Rad Red', color: '#ff3344' },
    { label: 'Cyber Cyan', color: '#00ffff' },
    { label: 'Neon Green', color: '#39ff14' },
    { label: 'Electric Purple', color: '#bf00ff' },
    { label: 'Hot Pink', color: '#ff1493' },
    { label: 'Solar Orange', color: '#ff6600' },
    { label: 'Golden Yellow', color: '#ffd700' },
    { label: 'Ice Blue', color: '#00bfff' },
    { label: 'Lime', color: '#00ff00' },
    { label: 'White', color: '#ffffff' }
];

// Chat Settings Dialog Window
let settingsWindow = null;

function showChatSettingsDialog() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 450,
        height: 420,
        parent: mainWindow,
        modal: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'Chat Settings',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Build inline HTML for settings dialog
    const settingsHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
            font-size: 13px;
        }
        h2 { color: #ff3344; margin-bottom: 15px; font-size: 16px; }
        .field { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #aaa; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        input[type="text"], input[type="password"], textarea {
            width: 100%;
            padding: 8px 10px;
            background: #252540;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            font-family: inherit;
            font-size: 12px;
        }
        input:focus, textarea:focus { outline: none; border-color: #ff3344; }
        textarea { resize: vertical; min-height: 60px; }
        .checkbox-field { display: flex; align-items: center; gap: 10px; }
        .checkbox-field input { width: auto; }
        .button-row { display: flex; gap: 10px; margin-top: 20px; }
        button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .btn-save { background: #ff3344; color: #fff; }
        .btn-save:hover { background: #ff5566; }
        .btn-cancel { background: #333; color: #aaa; }
        .btn-cancel:hover { background: #444; }
        .hint { font-size: 10px; color: #666; margin-top: 4px; }
    </style>
</head>
<body>
    <h2>🔗 LLM Chat Settings</h2>
    <div class="field checkbox-field">
        <input type="checkbox" id="enabled">
        <label for="enabled" style="margin: 0;">Enable Chat (requires local LLM)</label>
    </div>
    <div class="field">
        <label>API Endpoint URL</label>
        <input type="text" id="apiUrl" placeholder="http://localhost:11434/v1/chat/completions">
        <div class="hint">OpenAI-compatible endpoint (Ollama, LM Studio, LocalAI, etc.)</div>
    </div>
    <div class="field">
        <label>API Key (optional)</label>
        <input type="password" id="apiKey" placeholder="Leave empty if not required">
    </div>
    <div class="field">
        <label>Model Name</label>
        <input type="text" id="model" placeholder="llama2">
    </div>
    <div class="field">
        <label>System Prompt</label>
        <textarea id="systemPrompt" rows="3"></textarea>
    </div>
    <div class="button-row">
        <button class="btn-cancel" onclick="window.close()">Cancel</button>
        <button class="btn-save" onclick="saveSettings()">Save</button>
    </div>
    <script>
        async function loadSettings() {
            const config = await window.electronAPI.getLlmConfig();
            document.getElementById('enabled').checked = config.enabled;
            document.getElementById('apiUrl').value = config.apiUrl || '';
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('model').value = config.model || '';
            document.getElementById('systemPrompt').value = config.systemPrompt || '';
        }
        async function saveSettings() {
            const config = {
                enabled: document.getElementById('enabled').checked,
                apiUrl: document.getElementById('apiUrl').value.trim(),
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value.trim(),
                systemPrompt: document.getElementById('systemPrompt').value
            };
            await window.electronAPI.saveLlmConfig(config);
            window.close();
        }
        loadSettings();
    </script>
</body>
</html>`;

    settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(settingsHtml));
    settingsWindow.setMenu(null);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createTray() {
    const iconPath = getAssetPath('radbro.png');
    let trayIcon;
    
    // Platform-specific tray icon sizes
    const iconSize = process.platform === 'darwin' ? 22 : 16;
    
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon.isEmpty()) {
            trayIcon = trayIcon.resize({ width: iconSize, height: iconSize });
            // macOS requires template images for proper dark/light mode support
            if (process.platform === 'darwin') {
                trayIcon.setTemplateImage(true);
            }
        } else {
            // Fallback: create a simple icon
            trayIcon = nativeImage.createEmpty();
        }
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    
    // Build color submenu
    const colorSubmenu = colorPresets.map(preset => ({
        label: preset.label,
        click: () => {
            if (mainWindow) {
                mainWindow.webContents.send('set-color', preset.color);
            }
        }
    }));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Radgotchi',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: isAlwaysOnTop,
            click: (menuItem) => {
                isAlwaysOnTop = menuItem.checked;
                mainWindow.setAlwaysOnTop(isAlwaysOnTop);
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
                safeSetPosition(x, y);
            }
        },
        {
            label: 'Movement',
            submenu: [
                {
                    label: 'None',
                    type: 'radio',
                    checked: movementMode === 'none',
                    click: () => setMovementMode('none')
                },
                {
                    label: 'Bounce (DVD)',
                    type: 'radio',
                    checked: movementMode === 'bounce',
                    click: () => setMovementMode('bounce')
                },
                {
                    label: 'Follow Cursor',
                    type: 'radio',
                    checked: movementMode === 'follow',
                    click: () => setMovementMode('follow')
                },
                {
                    label: 'Wander',
                    type: 'radio',
                    checked: movementMode === 'wander',
                    click: () => setMovementMode('wander')
                }
            ]
        },
        {
            label: 'Color',
            submenu: colorSubmenu
        },
        {
            label: 'Language',
            submenu: [
                {
                    label: 'English',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('set-language', 'en');
                        }
                    }
                },
                {
                    label: '中文',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('set-language', 'zh');
                        }
                    }
                }
            ]
        },
        {
            label: 'Chat Settings',
            click: () => {
                // Open a dialog to configure LLM settings
                showChatSettingsDialog();
            }
        },
        { type: 'separator' },
        {
            label: 'Show/Hide',
            click: () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Dev Tools',
            click: () => {
                mainWindow.webContents.openDevTools({ mode: 'detach' });
            }
        },
        {
            label: 'Update from GitHub',
            click: () => {
                performUpdate();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Radgotchi');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

// On Linux, transparent visuals need a slight delay to be ready
function initializeApp() {
    loadLlmConfig();
    loadXpData();
    createWindow();
    createTray();
    startPassiveXpGain();
    startNeedsDecay();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}

app.whenReady().then(() => {
    if (process.platform === 'linux') {
        // Linux needs a short delay for transparent visuals
        setTimeout(initializeApp, 100);
    } else {
        initializeApp();
    }
});

// Intentionally keep app alive on Windows/Linux so it stays in the system tray
app.on('window-all-closed', () => {});

// Clean up all intervals on quit to prevent leaked timers
app.on('will-quit', () => {
    if (systemEventInterval) clearInterval(systemEventInterval);
    if (windowCountInterval) clearInterval(windowCountInterval);
    if (notRespondingInterval) clearInterval(notRespondingInterval);
    stopMovement();
    stopIdleDetection();
    stopPassiveXpGain();
    stopIdleDecay();
    stopAttentionEventChecks();
    stopNeedsDecay();
    stopPomodoro();
    if (attentionEvent.lossInterval) clearInterval(attentionEvent.lossInterval);
    saveXpData();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
}

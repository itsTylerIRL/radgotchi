'use strict';

const { broadcastToWindows } = require('./broadcast');

const NEEDS_CONFIG = {
    MAX_VALUE: 100,
    DECAY_INTERVAL_MS: 60000,
    HUNGER_DECAY: 1.5,
    ENERGY_DECAY: 0.8,
    CLICK_FEED: 2,
    MESSAGE_FEED: 5,
    MESSAGE_ENERGY: 3,
    LOW_THRESHOLD: 30,
    CRITICAL_THRESHOLD: 10,
    XP_PENALTY_THRESHOLD: 20,
    XP_PENALTY_MULTIPLIER: 0.5,
    SLEEP_ENERGY_REGEN: 0.4,
};

let petNeeds = {
    hunger: 100,
    energy: 100,
    lastDecayTime: Date.now(),
};

let needsDecayInterval = null;

let _getIsSleeping = null;
let _addActivityLogEntry = null;

// Track threshold zones so we only react when a boundary is crossed
let lastZones = { hunger: 'ok', energy: 'ok' };

function init({ getMainWindow, getChatWindow, getIsSleeping, addActivityLogEntry }) {
    _getIsSleeping = getIsSleeping || (() => false);
    _addActivityLogEntry = addActivityLogEntry || null;
}

function getNeeds() {
    return petNeeds;
}

function zoneFor(value) {
    if (value < NEEDS_CONFIG.CRITICAL_THRESHOLD) return 'critical';
    if (value < NEEDS_CONFIG.LOW_THRESHOLD) return 'low';
    return 'ok';
}

const ZONE_REACTIONS = {
    hunger: {
        low: {
            mood: 'demotivated', anim: 'rg-nod', duration: 4000,
            status: 'LOW RATIONS', statusZh: '口粮不足',
            log: '⚠️ Rations low — ops degrading. XP output halves below 20%.',
            logZh: '⚠️ 口粮不足 — 行动受限。低于20%时XP产出减半。',
        },
        critical: {
            mood: 'broken', anim: 'rg-shake', duration: 5000,
            status: 'STARVING — XP HALVED', statusZh: '饥饿 — XP减半',
            log: '🔴 STARVATION EVENT — XP output halved. Requesting rations immediately.',
            logZh: '🔴 饥饿事件 — XP产出减半。请立即补给口粮。',
        },
        recovered: {
            mood: 'grateful', anim: 'rg-bounce', duration: 3000,
            status: 'RATIONS SECURED', statusZh: '口粮到位',
        },
    },
    energy: {
        low: {
            mood: 'demotivated', anim: 'rg-nod', duration: 4000,
            status: 'POWER SAG', statusZh: '电力不足',
            log: '⚠️ Power reserves low — consider sleep mode or an energy cell.',
            logZh: '⚠️ 能量储备不足 — 建议睡眠模式或使用能量核心。',
        },
        critical: {
            mood: 'broken', anim: 'rg-shake', duration: 5000,
            status: 'POWER CRITICAL', statusZh: '能量告急',
            log: '🔴 POWER CRITICAL — XP output halved. Recharge required.',
            logZh: '🔴 能量告急 — XP产出减半。需要充电。',
        },
        recovered: {
            mood: 'excited', anim: 'rg-bounce', duration: 3000,
            status: 'POWER RESTORED', statusZh: '能量恢复',
        },
    },
};

function checkThresholdCrossings() {
    for (const stat of ['hunger', 'energy']) {
        const zone = zoneFor(petNeeds[stat]);
        const prev = lastZones[stat];
        if (zone === prev) continue;
        lastZones[stat] = zone;

        const reactions = ZONE_REACTIONS[stat];
        if (zone === 'critical' || (zone === 'low' && prev === 'ok')) {
            const r = reactions[zone];
            broadcastToWindows('pet-react', {
                mood: r.mood, status: r.status, statusZh: r.statusZh,
                anim: r.anim, duration: r.duration,
            });
            if (_addActivityLogEntry && r.log) _addActivityLogEntry('needs', r.log, r.logZh);
        } else if (zone === 'ok' && prev === 'critical') {
            const r = reactions.recovered;
            broadcastToWindows('pet-react', {
                mood: r.mood, status: r.status, statusZh: r.statusZh,
                anim: r.anim, duration: r.duration,
            });
        }
    }
}

function startNeedsDecay() {
    if (needsDecayInterval) return;

    needsDecayInterval = setInterval(() => {
        const oldHunger = petNeeds.hunger;
        const oldEnergy = petNeeds.energy;

        if (_getIsSleeping && _getIsSleeping()) {
            // Sleeping: no hunger decay, energy regenerates slowly
            petNeeds.energy = Math.min(NEEDS_CONFIG.MAX_VALUE, petNeeds.energy + NEEDS_CONFIG.SLEEP_ENERGY_REGEN);
        } else {
            petNeeds.hunger = Math.max(0, petNeeds.hunger - NEEDS_CONFIG.HUNGER_DECAY);
            petNeeds.energy = Math.max(0, petNeeds.energy - NEEDS_CONFIG.ENERGY_DECAY);
        }

        if (Math.floor(oldHunger) !== Math.floor(petNeeds.hunger) ||
            Math.floor(oldEnergy) !== Math.floor(petNeeds.energy)) {
            broadcastNeeds();
        }
        checkThresholdCrossings();
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
    checkThresholdCrossings();
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

    broadcastToWindows('needs-update', needsData);
}

module.exports = {
    NEEDS_CONFIG,
    init,
    getNeeds,
    startNeedsDecay,
    stopNeedsDecay,
    feedPet,
    broadcastNeeds,
};

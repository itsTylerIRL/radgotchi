'use strict';

const NEEDS_CONFIG = {
    MAX_VALUE: 100,
    DECAY_INTERVAL_MS: 60000,
    HUNGER_DECAY: 0.5,
    ENERGY_DECAY: 0.3,
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

let _getMainWindow = null;
let _getChatWindow = null;
let _getIsSleeping = null;

function init({ getMainWindow, getChatWindow, getIsSleeping }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _getIsSleeping = getIsSleeping || (() => false);
}

function getNeeds() {
    return petNeeds;
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

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('needs-update', needsData);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('needs-update', needsData);
    }
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

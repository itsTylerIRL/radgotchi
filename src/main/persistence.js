'use strict';

const path = require('path');
const fs = require('fs');

let _app = null;
let _screen = null;

function init(app, screen) {
    _app = app;
    _screen = screen;
}

// ═══════════════════════════════════════════════════════════════════════════
// Asset Path
// ═══════════════════════════════════════════════════════════════════════════

function getAssetPath(...paths) {
    if (_app.isPackaged) {
        return path.join(process.resourcesPath, 'assets', ...paths);
    }
    return path.join(__dirname, '..', '..', 'assets', ...paths);
}

// ═══════════════════════════════════════════════════════════════════════════
// XP Data Persistence
// ═══════════════════════════════════════════════════════════════════════════

function getXpDataPath() {
    return path.join(_app.getPath('userData'), 'xp-data.json');
}

function loadXpDataFromDisk() {
    try {
        const dataPath = getXpDataPath();
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load XP data:', e);
    }
    return null;
}

function saveXpDataToDisk(dataToSave) {
    try {
        fs.writeFileSync(getXpDataPath(), JSON.stringify(dataToSave, null, 2));
    } catch (e) {
        console.error('Failed to save XP data:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat History & Activity Log Persistence
// ═══════════════════════════════════════════════════════════════════════════

function getChatDataPath() {
    return path.join(_app.getPath('userData'), 'chat-data.json');
}

function loadChatDataFromDisk() {
    try {
        const dataPath = getChatDataPath();
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load chat data:', e);
    }
    return null;
}

function saveChatDataToDisk(dataToSave) {
    try {
        fs.writeFileSync(getChatDataPath(), JSON.stringify(dataToSave, null, 2));
    } catch (e) {
        console.error('Failed to save chat data:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Window State Persistence
// ═══════════════════════════════════════════════════════════════════════════

let windowStates = {};

function getWindowStatePath() {
    return path.join(_app.getPath('userData'), 'window-states.json');
}

function loadWindowStates() {
    try {
        const statePath = getWindowStatePath();
        if (fs.existsSync(statePath)) {
            const data = fs.readFileSync(statePath, 'utf8');
            windowStates = JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load window states:', e);
        windowStates = {};
    }
}

function saveWindowStates() {
    try {
        fs.writeFileSync(getWindowStatePath(), JSON.stringify(windowStates, null, 2));
    } catch (e) {
        console.error('Failed to save window states:', e);
    }
}

function saveWindowState(windowName, win, extraState = {}) {
    if (!win || win.isDestroyed()) return;

    const bounds = win.getBounds();
    const existing = windowStates[windowName] || {};
    windowStates[windowName] = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        savedAt: Date.now(),
        ...extraState
    };
    // Preserve existing extra state (like zoom) if not overwriting
    if (existing.zoom && !extraState.zoom) {
        windowStates[windowName].zoom = existing.zoom;
    }
    saveWindowStates();
}

function updateWindowStateProperty(windowName, property, value) {
    if (!windowStates[windowName]) {
        windowStates[windowName] = {};
    }
    windowStates[windowName][property] = value;
    saveWindowStates();
}

function getWindowState(windowName, defaults) {
    const saved = windowStates[windowName];
    if (!saved) return defaults;

    // Validate bounds are still on a visible display
    const displays = _screen.getAllDisplays();
    const isVisible = displays.some(display => {
        const db = display.bounds;
        const centerX = saved.x + saved.width / 2;
        const centerY = saved.y + saved.height / 2;
        return centerX >= db.x && centerX < db.x + db.width &&
               centerY >= db.y && centerY < db.y + db.height;
    });

    if (!isVisible) return defaults;

    return ensureBoundsOnDisplay({
        x: saved.x,
        y: saved.y,
        width: saved.width || defaults.width,
        height: saved.height || defaults.height
    });
}

function ensureBoundsOnDisplay(bounds) {
    const displays = _screen.getAllDisplays();
    if (displays.length === 0) return bounds;

    const centerX = bounds.x + (bounds.width || 0) / 2;
    const centerY = bounds.y + (bounds.height || 0) / 2;

    let target = displays.find(d => {
        const db = d.bounds;
        return centerX >= db.x && centerX < db.x + db.width &&
               centerY >= db.y && centerY < db.y + db.height;
    });

    if (!target) {
        target = _screen.getDisplayNearestPoint({ x: centerX, y: centerY });
    }

    const db = target.bounds;
    const w = bounds.width || 0;
    const h = bounds.height || 0;

    return {
        x: Math.max(db.x, Math.min(bounds.x, db.x + db.width - w)),
        y: Math.max(db.y, Math.min(bounds.y, db.y + db.height - h)),
        width: bounds.width,
        height: bounds.height
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM Config Persistence
// ═══════════════════════════════════════════════════════════════════════════

function getLlmConfigPath() {
    return path.join(_app.getPath('userData'), 'llm-config.json');
}

function loadLlmConfigFromDisk() {
    try {
        const configPath = getLlmConfigPath();
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load LLM config:', e);
    }
    return null;
}

function saveLlmConfigToDisk(config) {
    try {
        fs.writeFileSync(getLlmConfigPath(), JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error('Failed to save LLM config:', e);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pet Memory Persistence
// ═══════════════════════════════════════════════════════════════════════════

function getPetMemoryPath() {
    return path.join(_app.getPath('userData'), 'pet-memory.json');
}

function loadPetMemoryFromDisk() {
    try {
        const dataPath = getPetMemoryPath();
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load pet memory:', e);
    }
    return null;
}

function savePetMemoryToDisk(dataToSave) {
    try {
        fs.writeFileSync(getPetMemoryPath(), JSON.stringify(dataToSave, null, 2));
    } catch (e) {
        console.error('Failed to save pet memory:', e);
    }
}

module.exports = {
    init,
    getAssetPath,
    // XP data
    loadXpDataFromDisk,
    saveXpDataToDisk,
    // Chat data
    loadChatDataFromDisk,
    saveChatDataToDisk,
    // Window states
    loadWindowStates,
    saveWindowState,
    updateWindowStateProperty,
    getWindowState,
    ensureBoundsOnDisplay,
    // LLM config
    loadLlmConfigFromDisk,
    saveLlmConfigToDisk,
    // Pet memory
    loadPetMemoryFromDisk,
    savePetMemoryToDisk,
};

// Renderer entry point — imports all modules, exposes window.RG

import { setLanguage, getLanguage } from './status-text.js';
import { setMood, react, setSleep, setSleepAnimation, setWork, setWorkAnimation,
         getMood, getIsSleeping, getIsWorking, getLevel, setLevel, getPetCount } from './mood-engine.js';
import { assessHealth, handleSystemEvent } from './health-monitor.js';
import { setAudioListening, isListeningAudio } from './audio-reactive.js';
import { registerXpListener } from './xp-effects.js';
import { registerIpcListeners } from './ipc-bridge.js';

// Side-effect imports (self-initializing modules)
import './sounds.js';
import './interaction.js';
import './color-theme.js';

// Register event listeners
registerXpListener();
registerIpcListeners();

// Public API
window.RG = {
    react,
    assessHealth,
    handleSystemEvent,
    setMood,
    setLanguage,
    setSleep,
    setSleepAnimation,
    setWork,
    setWorkAnimation,
    setAudioListening,
    setLevel,
    get level() { return getLevel(); },
    get mood() { return getMood(); },
    get petCount() { return getPetCount(); },
    get language() { return getLanguage(); },
    get isSleeping() { return getIsSleeping(); },
    get isWorking() { return getIsWorking(); },
    get isListeningAudio() { return isListeningAudio(); }
};

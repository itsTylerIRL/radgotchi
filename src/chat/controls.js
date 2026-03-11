// Chat controls — movement, color, sleep, language, zoom, close, settings, volume, pomodoro, hover sounds

import SoundSystem from '../renderer/sounds.js';
import { getCurrentLang, updateLanguage } from './translations.js';
import { addMessage, sendMessage, clearChatHistory, startSleepTimer, stopSleepTimer, pomodoroMsgEl, setPomodoroMsgEl } from './messages.js';

const terminalContainer = document.querySelector('.terminal-container');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-btn');
const settingsBtn = document.getElementById('settings-btn');
const clearBtn = document.getElementById('clear-btn');
const volumeBtn = document.getElementById('volume-btn');
const selectMovement = document.getElementById('select-movement');
const colorPickerWrapper = document.getElementById('color-picker-wrapper');
const colorPickerTrigger = document.getElementById('color-picker-trigger');
const colorSwatchBar = document.getElementById('color-swatch-bar');
const activeColorPreview = document.getElementById('active-color-preview');
const toggleLang = document.getElementById('toggle-lang');
const toggleSleep = document.getElementById('toggle-sleep');
const togglePomo = document.getElementById('toggle-pomo');
const pomoStopBtn = document.getElementById('pomo-stop-btn');

let isMuted = false;

// Load saved mute state
try {
    if (localStorage.getItem('radgotchi-muted') === 'true') {
        isMuted = true;
        volumeBtn.classList.add('muted');
        SoundSystem.setEnabled(false);
        if (window.electronAPI && window.electronAPI.setMute) window.electronAPI.setMute(true);
    }
} catch(e) {}

// Close
function closeChat() {
    SoundSystem.play('chatClose');
    if (window.electronAPI.removeChatStreamListeners) window.electronAPI.removeChatStreamListeners();
    setTimeout(() => window.electronAPI.closeChat(), 250);
}
closeBtn.addEventListener('click', closeChat);
document.addEventListener('contextmenu', (e) => { e.preventDefault(); closeChat(); });

// Settings
settingsBtn.addEventListener('click', () => { SoundSystem.play('click'); window.electronAPI.openSettings(); });

// Clear
clearBtn.addEventListener('click', () => { SoundSystem.play('click'); clearChatHistory(); });

// Volume
volumeBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    volumeBtn.classList.toggle('muted', isMuted);
    SoundSystem.setEnabled(!isMuted);
    if (!isMuted) SoundSystem.play('click');
    localStorage.setItem('radgotchi-muted', isMuted);
    if (window.electronAPI && window.electronAPI.setMute) window.electronAPI.setMute(isMuted);
});

// Send
sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

// Movement
selectMovement.addEventListener('change', () => {
    SoundSystem.play('selectChange');
    if (window.electronAPI && window.electronAPI.setMovementMode) window.electronAPI.setMovementMode(selectMovement.value);
});

// Color picker
colorPickerTrigger.addEventListener('click', () => { colorPickerWrapper.classList.toggle('open'); SoundSystem.play('selectChange'); });
document.addEventListener('click', (e) => { if (!colorPickerWrapper.contains(e.target)) colorPickerWrapper.classList.remove('open'); });

colorSwatchBar.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    const color = swatch.dataset.color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    activeColorPreview.style.background = color;
    colorPickerWrapper.classList.remove('open');
    SoundSystem.play('selectChange');
    applyColor(color);
    if (window.electronAPI && window.electronAPI.setColor) window.electronAPI.setColor(color);
});

// Sleep
toggleSleep.addEventListener('click', () => {
    toggleSleep.classList.toggle('active');
    const sleeping = toggleSleep.classList.contains('active');
    terminalContainer.classList.toggle('sleeping', sleeping);
    if (sleeping) { startSleepTimer(); SoundSystem.play('sleepStart'); }
    else { stopSleepTimer(); SoundSystem.play('sleepEnd'); }
    if (window.electronAPI && window.electronAPI.setSleep) window.electronAPI.setSleep(sleeping);
});

// Language
toggleLang.addEventListener('click', () => {
    toggleLang.classList.toggle('active');
    const newLang = toggleLang.classList.contains('active') ? 'zh' : 'en';
    toggleLang.textContent = newLang === 'zh' ? 'EN' : '中文';
    SoundSystem.play(newLang === 'zh' ? 'gong' : 'starSpangledBanner');
    updateLanguage(newLang);
    if (window.electronAPI && window.electronAPI.setLanguage) window.electronAPI.setLanguage(newLang);
});

// Zoom
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevelEl = document.getElementById('zoom-level');
let currentZoom = 100;
const MIN_ZOOM = 50, MAX_ZOOM = 150, ZOOM_STEP = 10;

export function applyZoomSilent(newZoom) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    zoomLevelEl.textContent = currentZoom + '%';
    document.body.style.zoom = currentZoom / 100;
}

function updateZoom(newZoom) {
    applyZoomSilent(newZoom);
    if (window.electronAPI && typeof window.electronAPI.setZoom === 'function') window.electronAPI.setZoom(currentZoom);
    SoundSystem.play('selectChange');
}

zoomInBtn.addEventListener('click', () => updateZoom(currentZoom + ZOOM_STEP));
zoomOutBtn.addEventListener('click', () => updateZoom(currentZoom - ZOOM_STEP));

// Pomodoro toggle
togglePomo.addEventListener('click', () => {
    const lang = getCurrentLang();
    if (togglePomo.classList.contains('active')) {
        if (window.electronAPI && window.electronAPI.pomodoroStop) {
            window.electronAPI.pomodoroStop();
            const msg = lang === 'zh' ? '⏹️ 番茄钟已停止' : '⏹️ POMODORO STOPPED';
            if (pomodoroMsgEl) {
                const textSpan = pomodoroMsgEl.querySelector('span');
                if (textSpan) textSpan.textContent = msg;
                setPomodoroMsgEl(null);
            } else {
                addMessage('system', msg, false, null, true);
            }
        }
    } else {
        if (window.electronAPI && window.electronAPI.pomodoroStart) {
            window.electronAPI.pomodoroStart('work');
            SoundSystem.play('pomodoroStart');
            const msg = lang === 'zh' ? '🍅 番茄钟开始！专注25分钟...' : '🍅 WORK STARTED! Focus for 25 minutes...';
            setPomodoroMsgEl(addMessage('system', msg, false, null, true));
        }
    }
});

// Pomodoro stop button
pomoStopBtn.addEventListener('click', () => {
    const lang = getCurrentLang();
    if (window.electronAPI && window.electronAPI.pomodoroStop) {
        window.electronAPI.pomodoroStop();
        const msg = lang === 'zh' ? '⏹️ 番茄钟已停止' : '⏹️ WORK STOPPED';
        if (pomodoroMsgEl) {
            const textSpan = pomodoroMsgEl.querySelector('span');
            if (textSpan) textSpan.textContent = msg;
            setPomodoroMsgEl(null);
        } else {
            addMessage('system', msg, false, null, true);
        }
    }
});

// Color sync from main window
export function applyColor(color) {
    document.documentElement.style.setProperty('--term-green', color);
    document.documentElement.style.setProperty('--term-dim', color + '88');
    document.documentElement.style.setProperty('--term-grid', color + '08');
    activeColorPreview.style.background = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color && swatch.dataset.color.toLowerCase() === color.toLowerCase());
    });
}

// Hover sounds
let lastHoverSoundTime = 0;
function playHoverSound() {
    const now = Date.now();
    if (now - lastHoverSoundTime >= 80) { lastHoverSoundTime = now; SoundSystem.play('selectChange'); }
}

['.header-btn', '.close-btn', '.settings-btn', '.send-btn', '.lang-toggle-btn', '.control-toggle', '.control-select',
 '.color-picker-trigger', '.color-swatch', '.pomo-btn', '.copy-btn', '.rank-badge', '.level-badge',
 '.classification', '.zoom-btn', '.network-toggle-btn', '.network-header', '.network-node'
].forEach(sel => { document.querySelectorAll(sel).forEach(el => el.addEventListener('mouseenter', playHoverSound)); });

const messagesArea = document.querySelector('.messages-area');
if (messagesArea) messagesArea.addEventListener('mouseenter', (e) => { if (e.target.classList.contains('copy-btn')) playHoverSound(); }, true);

// Focus input
inputEl.focus();

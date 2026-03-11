// IPC bridge — all electronAPI event listeners that connect main process to renderer modules

import SoundSystem from './sounds.js';
import { setMood, setLevel, setSleep, setSleepAnimation, setWork, setWorkAnimation } from './mood-engine.js';
import { setLanguage, getLanguage } from './status-text.js';
import { setAudioListening } from './audio-reactive.js';
import { handleSystemEvent, assessHealth } from './health-monitor.js';

const container = document.getElementById('radgotchi-container');
const faceFlipWrapper = document.getElementById('face-flip-wrapper');

export function registerIpcListeners() {
    const api = window.electronAPI;
    if (!api) return;

    // Language
    if (api.onSetLanguage) {
        api.onSetLanguage((lang) => {
            setLanguage(lang);
            SoundSystem.play(lang === 'zh' ? 'gong' : 'starSpangledBanner');
        });
    }

    // Sleep
    if (api.onSetSleep) api.onSetSleep((sleeping) => setSleep(sleeping));
    if (api.onSleepAnimation) api.onSleepAnimation((anim) => setSleepAnimation(anim));

    // Work
    if (api.onSetWork) api.onSetWork((working) => setWork(working));
    if (api.onWorkAnimation) api.onWorkAnimation((anim) => setWorkAnimation(anim));

    // Audio reactive
    if (api.onSetAudioListening) api.onSetAudioListening((enabled) => setAudioListening(enabled));

    // System events
    if (api.onSystemEvent) api.onSystemEvent((event) => handleSystemEvent(event));

    // System metrics polling
    async function pollMetrics() {
        try {
            const metrics = await api.getSystemMetrics();
            assessHealth(metrics);
        } catch (e) {}
    }
    setInterval(pollMetrics, 5000);
    setTimeout(pollMetrics, 1000);

    // Idle state
    if (api.onIdleChange) {
        api.onIdleChange((data) => {
            if (data.idle) {
                faceFlipWrapper.classList.add('rg-breathing-slow');
                faceFlipWrapper.classList.remove('rg-breathing');
                setMood('sleep', { priority: true, status: 'zzZZ.. waiting for you...', duration: 0 });
            } else {
                faceFlipWrapper.classList.add('rg-breathing');
                faceFlipWrapper.classList.remove('rg-breathing-slow');
                setMood('excited', { priority: true, status: "You're back!", anim: 'bounce', duration: 3000 });
            }
        });
    }

    // Attention events
    if (api.onAttentionEvent) {
        api.onAttentionEvent((data) => {
            if (data.active) {
                container.classList.add('rg-attention-needed');
                faceFlipWrapper.classList.add('rg-vibrate');
                SoundSystem.play('attentionStart');
                const lang = getLanguage();
                const statusText = lang === 'zh' ? '连接不稳定！确认信号！' : 'LINK UNSTABLE! CONFIRM SIGNAL!';
                setMood('intense', { priority: true, status: statusText, duration: 0 });
            } else {
                container.classList.remove('rg-attention-needed');
                faceFlipWrapper.classList.remove('rg-vibrate');
                if (data.resolved) {
                    SoundSystem.play('attentionEnd');
                    const lang = getLanguage();
                    const statusText = lang === 'zh' ? '连接已恢复' : 'HANDSHAKE CONFIRMED';
                    setMood('grateful', { priority: true, status: statusText, anim: 'bounce', duration: 2500 });
                }
            }
        });
    }

    // Chat mood
    if (api.onChatMood) {
        api.onChatMood((mood) => {
            switch (mood) {
                case 'thinking': setMood('smart', { duration: 2000, status: 'PROCESSING...' }); break;
                case 'success': setMood('happy', { duration: 2000, status: 'TX COMPLETE' }); break;
                case 'error': setMood('sad', { duration: 2000, status: 'COMMS ERROR' }); break;
            }
        });
    }

    // Mute state from chat
    if (api.onSetMute) {
        api.onSetMute((muted) => SoundSystem.setEnabled(!muted));
    }

    // XP updates → level tracking
    if (api.onXpUpdate) {
        api.onXpUpdate((data) => {
            if (data && typeof data.level === 'number') setLevel(data.level);
        });
    }

    // Auto-start audio listening
    let vibeDisabled = false;
    try { vibeDisabled = localStorage.getItem('radgotchi-vibe-disabled') === 'true'; } catch(e) {}
    if (!vibeDisabled) setTimeout(() => setAudioListening(true), 3000);
}

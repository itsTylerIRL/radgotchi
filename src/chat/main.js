// Chat window entry point — imports all modules, registers IPC listeners

import SoundSystem from '../renderer/sounds.js';
import { getCurrentLang, setCurrentLang, updateLanguage } from './translations.js';
import { addMessage, chatHistory, runBootAnimation, setSpriteState, setOperatorPfp,
         updateBroAvatars, startSleepTimer, stopSleepTimer, attentionMsgEl, setAttentionMsgEl } from './messages.js';
import { updateXpDisplay, updateNeedsDisplay, updatePomodoroDisplay } from './xp-display.js';
import { addNetworkNode, updateNetworkNode, removeNetworkNode, updateNetworkTranslations, handleMeshMessage } from './network-panel.js';
import { handleAudioLevels } from './equalizer.js';
import { applyColor, applyZoomSilent } from './controls.js';

const terminalContainer = document.querySelector('.terminal-container');
const selectMovement = document.getElementById('select-movement');
const toggleLang = document.getElementById('toggle-lang');
const toggleSleep = document.getElementById('toggle-sleep');
const togglePomo = document.getElementById('toggle-pomo');
const sessionIdEl = document.getElementById('session-id');
const timestampEl = document.getElementById('timestamp');
const levelBar = document.getElementById('level-bar');

// Generate session ID
sessionIdEl.textContent = 'RG-' + Math.random().toString(36).substr(2, 4).toUpperCase();

// Detect OS
const osInfoEl = document.getElementById('os-info');
function detectOS() {
    const ua = navigator.userAgent;
    if (ua.includes('Windows NT 10')) return 'WIN11/10';
    if (ua.includes('Mac OS X')) return 'MACOS';
    if (ua.includes('Linux')) return 'LINUX';
    return 'UNKNOWN';
}
osInfoEl.textContent = detectOS();

// Timestamp
function updateTimestamp() { timestampEl.textContent = new Date().toTimeString().split(' ')[0]; }
updateTimestamp();
setInterval(updateTimestamp, 1000);

// Apply initial language if zh
if (getCurrentLang() === 'zh') {
    toggleLang.classList.add('active');
    toggleLang.textContent = 'EN';
    updateLanguage('zh');
}

// Boot animation
runBootAnimation();

// === IPC Listeners ===

const api = window.electronAPI;

// Chat ready — initial state sync
api.onChatReady(async (data) => {
    SoundSystem.play('chatOpen');
    const lang = getCurrentLang();

    if (data.spriteState) setSpriteState(data.spriteState);
    if (data.operatorPfp) setOperatorPfp(data.operatorPfp);

    // Restore chat history
    let hasHistory = false;
    if (api.getChatHistory) {
        try {
            const historyData = await api.getChatHistory();
            if (historyData.chatHistory && historyData.chatHistory.length > 0) {
                hasHistory = true;
                addMessage('system', lang === 'zh' ? '─── 之前的会话 ───' : '─── PREVIOUS SESSION ───');
                const recent = historyData.chatHistory.slice(-20);
                recent.forEach(msg => {
                    addMessage(msg.role, msg.content, false, msg.timestamp);
                    chatHistory.push({ role: msg.role, content: msg.content });
                });
                addMessage('system', lang === 'zh' ? '─── 当前会话 ───' : '─── CURRENT SESSION ───');
            }
        } catch (e) { console.error('Failed to load chat history:', e); }
    }

    const t = (await import('./translations.js')).translations[lang];
    if (!data.configured) addMessage('system', t.commsOffline);
    else if (!hasHistory) addMessage('assistant', t.linkEstablished);

    if (data.movementMode) selectMovement.value = data.movementMode;
    if (data.color) {
        const activeSwatch = document.querySelector(`.color-swatch[data-color="${data.color}"]`);
        if (activeSwatch) {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            activeSwatch.classList.add('active');
            document.getElementById('active-color-preview').style.background = data.color;
        }
        applyColor(data.color);
    }
    if (data.xp) updateXpDisplay(data.xp, false);
    if (data.needs) updateNeedsDisplay(data.needs);
    if (data.zoom && data.zoom !== 100) applyZoomSilent(data.zoom);
    if (data.isSleeping) { toggleSleep.classList.add('active'); terminalContainer.classList.add('sleeping'); startSleepTimer(); }
    if (data.language && data.language === 'zh') { toggleLang.classList.add('active'); toggleLang.textContent = 'EN'; updateLanguage('zh'); }
    if (data.pomodoroActive) togglePomo.classList.add('active');
});

// PFP updates
api.onPfpUpdate((data) => {
    if (data.operatorPfp) {
        setOperatorPfp(data.operatorPfp);
        document.querySelectorAll('.message-wrapper.user .message-avatar').forEach(avatar => {
            if (data.operatorPfp.imageUrl) avatar.innerHTML = '<img src="' + data.operatorPfp.imageUrl + '" alt="OPERATOR">';
            else avatar.innerHTML = '<span class="message-avatar-placeholder">OP</span>';
        });
    }
});

// Sprite updates
if (api.onSpriteUpdate) {
    api.onSpriteUpdate((data) => { setSpriteState(data); updateBroAvatars(); });
}

// Color sync
if (api.onSetColor) api.onSetColor(applyColor);

// Audio levels
if (api.onAudioLevels) api.onAudioLevels(handleAudioLevels);

// XP updates
if (api.onXpUpdate) api.onXpUpdate((data) => updateXpDisplay(data, true));

// Attention events
if (api.onAttentionEvent) {
    api.onAttentionEvent((data) => {
        const lang = getCurrentLang();
        if (data.active) {
            SoundSystem.play('attentionStart');
            levelBar.classList.add('attention-warning');
            const msg = lang === 'zh' ? '⚠️ 连接不稳定！确认信号！(每30秒损失XP)' : '⚠️ LINK UNSTABLE! Confirm signal! (Losing XP every 30s)';
            setAttentionMsgEl(addMessage('system', msg, false, null, true));
            if (attentionMsgEl) attentionMsgEl.classList.add('attention-msg');
        } else {
            levelBar.classList.remove('attention-warning');
            if (data.resolved) {
                SoundSystem.play('attentionEnd');
                const msg = lang === 'zh' ? '✅ 握手确认！连接已恢复！' : '✅ HANDSHAKE CONFIRMED! Link restored!';
                if (attentionMsgEl) {
                    const textSpan = attentionMsgEl.querySelector('span');
                    if (textSpan) textSpan.textContent = msg;
                    attentionMsgEl.classList.remove('attention-msg');
                    setAttentionMsgEl(null);
                } else {
                    addMessage('system', msg, false, null, true);
                }
            }
        }
    });
}

// Needs updates
if (api.onNeedsUpdate) api.onNeedsUpdate(updateNeedsDisplay);

// Pomodoro updates
if (api.onPomodoroUpdate) api.onPomodoroUpdate(updatePomodoroDisplay);

// Pomodoro complete
if (api.onPomodoroComplete) {
    api.onPomodoroComplete((data) => {
        SoundSystem.play('pomodoroComplete');
        const { mode, pomosCompleted } = data;
        const lang = getCurrentLang();
        let msg;
        if (mode === 'work') msg = lang === 'zh' ? '🍅 专注完成！已完成 ' + pomosCompleted + ' 个番茄钟。休息一下？' : '🍅 FOCUS SESSION COMPLETE! ' + pomosCompleted + ' grinds. Time for a break?';
        else msg = lang === 'zh' ? '☕ 休息结束！准备好继续了吗？' : '☕ BREAK OVER! Ready to focus?';
        addMessage('system', msg, false, null, true);
    });
}

// Activity log
if (api.onActivityLogUpdate) {
    api.onActivityLogUpdate((entry) => {
        if (['level-up', 'level-down', 'attention', 'attention-resolved', 'pomodoro'].includes(entry.type)) return;
        if (entry.type === 'milestone') SoundSystem.play('milestone');
        const msg = getCurrentLang() === 'zh' ? entry.messageZh : entry.message;
        addMessage('system', msg, false, null, true);
    });
}

// Network updates
if (api.onNetworkUpdate) {
    api.onNetworkUpdate((data) => {
        if (data.type === 'node-online') addNetworkNode(data.node);
        else if (data.type === 'node-update') updateNetworkNode(data.node);
        else if (data.type === 'node-offline') removeNetworkNode(data.node);
        else if (data.type === 'mesh-message') handleMeshMessage(data.node);
    });
}

// Movement mode changes
if (api.onMovementModeChange) api.onMovementModeChange((mode) => { selectMovement.value = mode; });

// Language changes
if (api.onSetLanguage) {
    api.onSetLanguage((lang) => {
        if (lang === 'zh' && !toggleLang.classList.contains('active')) { toggleLang.classList.add('active'); toggleLang.textContent = 'EN'; }
        else if (lang === 'en' && toggleLang.classList.contains('active')) { toggleLang.classList.remove('active'); toggleLang.textContent = '中文'; }
        updateLanguage(lang);
        updateNetworkTranslations();
    });
}

// Sleep mode changes from main process
if (api.onSetSleep) {
    api.onSetSleep((sleeping) => {
        if (sleeping && !toggleSleep.classList.contains('active')) { toggleSleep.classList.add('active'); terminalContainer.classList.add('sleeping'); startSleepTimer(); }
        else if (!sleeping && toggleSleep.classList.contains('active')) { toggleSleep.classList.remove('active'); terminalContainer.classList.remove('sleeping'); stopSleepTimer(); }
    });
}

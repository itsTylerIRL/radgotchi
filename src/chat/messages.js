// Chat messages — addMessage, sendMessage, sprite management, boot animation, sleep timer

import SoundSystem from '../renderer/sounds.js';
import { translations, sleepMessages, getCurrentLang } from './translations.js';
import { parseMarkdown, copyCode, getHueRotation } from './markdown.js';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');

export let chatHistory = [];
let isSending = false;

// Sprite state for bro avatar
let spriteState = { sprite: 'AWAKE.png', color: '#00ff88' };
let operatorPfp = null;

// Sleep timer state
let sleepTimerEl = null;
let sleepTimerInterval = null;
let sleepStartTime = null;

// In-place update message refs
export let attentionMsgEl = null;
export let pomodoroMsgEl = null;
export function setAttentionMsgEl(el) { attentionMsgEl = el; }
export function setPomodoroMsgEl(el) { pomodoroMsgEl = el; }

export function setSpriteState(state) {
    if (state.sprite) spriteState.sprite = state.sprite;
    if (state.color) spriteState.color = state.color;
}
export function setOperatorPfp(pfp) { operatorPfp = pfp; }
export function getSpriteState() { return spriteState; }

function createBroSpriteAvatar() {
    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar sprite-avatar';
    const img = document.createElement('img');
    img.src = 'assets/gotchi/' + spriteState.sprite;
    img.alt = 'Bro';
    img.draggable = false;
    img.onerror = function() { this.parentElement.innerHTML = '<span class="message-avatar-placeholder">BR</span>'; };
    const hueRotate = getHueRotation(spriteState.color);
    avatarEl.style.setProperty('--sprite-hue', hueRotate + 'deg');
    avatarEl.appendChild(img);
    return avatarEl;
}

export function updateBroAvatars() {
    const hueRotate = getHueRotation(spriteState.color);
    document.querySelectorAll('.message-wrapper.assistant .message-avatar.sprite-avatar').forEach(avatar => {
        avatar.style.setProperty('--sprite-hue', hueRotate + 'deg');
        const img = avatar.querySelector('img');
        if (img) img.src = 'assets/gotchi/' + spriteState.sprite;
    });
}

function getTimeStr() { return new Date().toTimeString().split(' ')[0]; }
function formatTimestamp(ts) { return ts ? new Date(ts).toTimeString().split(' ')[0] : getTimeStr(); }

export function addMessage(role, content, isThinking = false, timestamp = null, persist = false) {
    const t = translations[getCurrentLang()];

    if (role === 'user' || role === 'assistant') {
        const wrapperEl = document.createElement('div');
        wrapperEl.className = `message-wrapper ${role}`;

        let avatarEl;
        if (role === 'assistant') {
            avatarEl = createBroSpriteAvatar();
        } else {
            avatarEl = document.createElement('div');
            avatarEl.className = 'message-avatar';
            if (operatorPfp && operatorPfp.imageUrl) {
                const img = document.createElement('img');
                img.src = operatorPfp.imageUrl;
                img.alt = 'Operator';
                img.onerror = function() { this.parentElement.innerHTML = '<span class="message-avatar-placeholder">?</span>'; };
                avatarEl.appendChild(img);
            } else {
                avatarEl.innerHTML = '<span class="message-avatar-placeholder">OP</span>';
            }
        }

        const msgEl = document.createElement('div');
        msgEl.className = `message ${role}${isThinking ? ' thinking' : ''}`;
        msgEl.setAttribute('data-time', timestamp ? formatTimestamp(timestamp) : getTimeStr());
        if (role === 'user') msgEl.style.setProperty('--operator-label', '"' + t.operator + '"');
        else msgEl.style.setProperty('--bro-label', '"' + t.bro + '"');

        if (role === 'assistant' && !isThinking) {
            msgEl.innerHTML = parseMarkdown(content);
            msgEl.querySelectorAll('.copy-btn').forEach(btn => {
                btn.textContent = t.copy;
                btn.setAttribute('data-copy', t.copy);
                btn.setAttribute('data-copied', t.copied);
            });
        } else {
            msgEl.textContent = content;
        }

        wrapperEl.appendChild(avatarEl);
        wrapperEl.appendChild(msgEl);
        messagesEl.appendChild(wrapperEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return msgEl;
    }

    // System messages
    const msgEl = document.createElement('div');
    msgEl.className = `message ${role}${isThinking ? ' thinking' : ''}`;
    msgEl.setAttribute('data-time', timestamp ? formatTimestamp(timestamp) : getTimeStr());
    msgEl.style.setProperty('--system-label', '"' + t.system + '"');

    const textSpan = document.createElement('span');
    textSpan.textContent = content;
    msgEl.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'system-close-btn';
    closeBtn.textContent = '×';
    closeBtn.title = 'Dismiss';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        msgEl.style.opacity = '0';
        msgEl.style.transform = 'translateY(-10px)';
        msgEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        setTimeout(() => msgEl.remove(), 200);
    });
    msgEl.appendChild(closeBtn);
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (persist && role === 'system' && window.electronAPI && window.electronAPI.saveChatMessage) {
        window.electronAPI.saveChatMessage('system', content);
    }
    return msgEl;
}

export async function sendMessage() {
    const message = inputEl.value.trim();
    if (!message || isSending) return;

    // Wake up if sleeping
    const toggleSleep = document.getElementById('toggle-sleep');
    const terminalContainer = document.querySelector('.terminal-container');
    if (toggleSleep.classList.contains('active')) {
        toggleSleep.classList.remove('active');
        terminalContainer.classList.remove('sleeping');
        stopSleepTimer();
        if (window.electronAPI && window.electronAPI.setSleep) window.electronAPI.setSleep(false);
    }

    inputEl.value = '';
    addMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    SoundSystem.play('messageSend');

    if (window.electronAPI && window.electronAPI.saveChatMessage) window.electronAPI.saveChatMessage('user', message);
    if (window.electronAPI && window.electronAPI.addXp) window.electronAPI.addXp(5, 'message-send');

    isSending = true;
    sendBtn.disabled = true;
    const t = translations[getCurrentLang()];

    const streamWrapperEl = document.createElement('div');
    streamWrapperEl.className = 'message-wrapper assistant';
    const streamAvatarEl = createBroSpriteAvatar();
    const streamMsgEl = document.createElement('div');
    streamMsgEl.className = 'message assistant thinking';
    streamMsgEl.setAttribute('data-time', getTimeStr());
    streamMsgEl.style.setProperty('--bro-label', '"' + t.bro + '"');
    streamMsgEl.textContent = t.processing;
    streamWrapperEl.appendChild(streamAvatarEl);
    streamWrapperEl.appendChild(streamMsgEl);
    messagesEl.appendChild(streamWrapperEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    window.electronAPI.chatMood('thinking');

    let streamedContent = '';
    let streamComplete = false;

    const handleChunk = (data) => {
        if (streamComplete) return;
        if (data.content) {
            streamedContent += data.content;
            streamMsgEl.classList.remove('thinking');
            streamMsgEl.innerHTML = parseMarkdown(streamedContent);
            streamMsgEl.querySelectorAll('.copy-btn').forEach(btn => {
                btn.textContent = t.copy;
                btn.setAttribute('data-copy', t.copy);
                btn.setAttribute('data-copied', t.copied);
            });
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        if (data.done) {
            streamComplete = true;
            window.electronAPI.removeChatStreamListeners();
            if (streamedContent) {
                chatHistory.push({ role: 'assistant', content: streamedContent });
                SoundSystem.play('messageReceive');
                if (window.electronAPI && window.electronAPI.saveChatMessage) window.electronAPI.saveChatMessage('assistant', streamedContent);
                window.electronAPI.chatMood('success');
            }
            isSending = false;
            sendBtn.disabled = false;
            inputEl.focus();
        }
    };

    const handleError = (data) => {
        if (streamComplete) return;
        streamComplete = true;
        window.electronAPI.removeChatStreamListeners();
        streamWrapperEl.remove();
        addMessage('system', t.err + ': ' + (data.error || 'Unknown error'));
        window.electronAPI.chatMood('error');
        isSending = false;
        sendBtn.disabled = false;
        inputEl.focus();
    };

    window.electronAPI.onChatStreamChunk(handleChunk);
    window.electronAPI.onChatStreamError(handleError);
    window.electronAPI.sendChatMessageStream(chatHistory);
}

export function clearChatHistory() {
    const msgEls = messagesEl.querySelectorAll('.message-wrapper, .message.system');
    msgEls.forEach(el => el.remove());
    chatHistory = [];
    if (window.electronAPI && window.electronAPI.clearChatHistory) window.electronAPI.clearChatHistory();
    addMessage('system', '[ CHAT HISTORY CLEARED ]');
}

// Boot animation
export function runBootAnimation() {
    const bootOverlay = document.getElementById('boot-overlay');
    const bootProgressFill = document.getElementById('boot-progress-fill');
    const bootStatus = document.getElementById('boot-status');
    if (!bootOverlay) return;
    SoundSystem.play('boot');

    const bootMessages = ['INITIALIZING NEURAL INTERFACE...', 'LOADING RAD PROTOCOLS...', 'ESTABLISHING CONNECTION...', 'SYSTEM READY'];
    let progress = 0, msgIndex = 0;
    bootStatus.textContent = bootMessages[0];

    const progressInterval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress > 100) progress = 100;
        bootProgressFill.style.width = progress + '%';
        const newMsgIndex = Math.min(Math.floor(progress / 30), bootMessages.length - 1);
        if (newMsgIndex !== msgIndex) { msgIndex = newMsgIndex; bootStatus.textContent = bootMessages[msgIndex]; }
        if (progress >= 100) {
            clearInterval(progressInterval);
            bootStatus.textContent = bootMessages[bootMessages.length - 1];
            setTimeout(() => { bootOverlay.classList.add('fade-out'); setTimeout(() => { bootOverlay.style.display = 'none'; }, 500); }, 300);
        }
    }, 100);
}

// Sleep timer
function formatSleepTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
}

export function startSleepTimer() {
    if (sleepTimerInterval) return;
    sleepStartTime = Date.now();
    const msgs = sleepMessages[getCurrentLang()];
    sleepTimerEl = addMessage('system', msgs.start + ' // ' + msgs.elapsed + ': 00:00');
    sleepTimerEl.classList.add('sleep-timer');
    sleepTimerInterval = setInterval(() => {
        if (!sleepTimerEl) return;
        const elapsed = Date.now() - sleepStartTime;
        const msgs = sleepMessages[getCurrentLang()];
        const textSpan = sleepTimerEl.querySelector('span');
        if (textSpan) textSpan.textContent = msgs.start + ' // ' + msgs.elapsed + ': ' + formatSleepTime(elapsed);
    }, 1000);
}

export function stopSleepTimer() {
    if (sleepTimerInterval) { clearInterval(sleepTimerInterval); sleepTimerInterval = null; }
    if (sleepTimerEl && sleepStartTime) {
        const elapsed = Date.now() - sleepStartTime;
        const msgs = sleepMessages[getCurrentLang()];
        const textSpan = sleepTimerEl.querySelector('span');
        if (textSpan) textSpan.textContent = msgs.end + ' // ' + msgs.elapsed + ': ' + formatSleepTime(elapsed);
        sleepTimerEl.classList.remove('sleep-timer');
        sleepTimerEl = null;
    }
    sleepStartTime = null;
}

// Event delegation for copy buttons (replaces inline onclick)
messagesEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) copyCode(e.target);
});

// Audio init on first interaction
let audioInitialized = false;
function initAudioOnInteraction() {
    if (audioInitialized) return;
    audioInitialized = true;
    SoundSystem.play('click');
}
document.addEventListener('click', initAudioOnInteraction, { once: true });
document.addEventListener('keydown', initAudioOnInteraction, { once: true });

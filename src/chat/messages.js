// Chat messages — addMessage, sendMessage, sprite management, boot animation, sleep timer

import SoundSystem from '../renderer/sounds.js';
import { translations, sleepMessages, getCurrentLang } from './translations.js';
import { parseMarkdown, copyCode, getHueRotation } from './markdown.js';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');

export let chatHistory = [];
let isSending = false;

// Session token counter
let sessionTokens = 0;
// Response time history for sparkline
let responseTimes = [];

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
    updateWebSprite();
}
export function setOperatorPfp(pfp) { operatorPfp = pfp; }
export function getSpriteState() { return spriteState; }

// Persistent web-mode sprite (single centered sprite above stats)
const webSpriteContainer = document.getElementById('web-sprite-container');
const webSpriteImg = document.getElementById('web-sprite');

export function updateWebSprite() {
    if (!webSpriteImg) return;
    webSpriteImg.src = 'assets/gotchi/' + spriteState.sprite;
    const hueRotate = getHueRotation(spriteState.color);
    webSpriteContainer.style.setProperty('--sprite-hue', hueRotate + 'deg');
}

let webSpriteMoodTimer = null;
export function setWebSpriteMood(mood) {
    if (!webSpriteContainer) return;
    webSpriteContainer.classList.remove('thinking', 'responding', 'success', 'error');
    if (webSpriteMoodTimer) { clearTimeout(webSpriteMoodTimer); webSpriteMoodTimer = null; }
    if (mood) {
        webSpriteContainer.classList.add(mood);
        // Auto-clear one-shot animations
        if (mood === 'success' || mood === 'error') {
            webSpriteMoodTimer = setTimeout(() => {
                webSpriteContainer.classList.remove(mood);
            }, 600);
        }
    }
}

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

export function addMessage(role, content, isThinking = false, timestamp = null, persist = false, metrics = null) {
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
        // Render persisted metrics (for history restore)
        if (metrics && role === 'assistant') {
            const parts = [];
            if (metrics.ttft !== null && metrics.ttft !== undefined) parts.push('TTFT: ' + Number(metrics.ttft).toFixed(2) + 's');
            if (metrics.tokensPerSec) parts.push(metrics.tokensPerSec + ' tok/s');
            if (metrics.totalTime) parts.push(metrics.totalTime + 's total');
            if (parts.length) {
                const metricsEl = document.createElement('div');
                metricsEl.className = 'message-metrics';
                const statsSpan = document.createElement('span');
                statsSpan.textContent = parts.join(' \u00b7 ');
                metricsEl.appendChild(statsSpan);
                if (metrics.profileName) {
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'metrics-profile';
                    nameSpan.textContent = metrics.profileName;
                    metricsEl.appendChild(nameSpan);
                }
                msgEl.appendChild(metricsEl);
            }
        }
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

export function addToolMessage(label, status = 'running', beforeEl = null) {
    const msgEl = document.createElement('div');
    msgEl.className = `message tool-call tool-${status}`;
    msgEl.setAttribute('data-time', getTimeStr());

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tool-label';
    labelSpan.textContent = label;
    msgEl.appendChild(labelSpan);

    if (status === 'running') {
        const spinner = document.createElement('span');
        spinner.className = 'tool-spinner';
        spinner.textContent = '…';
        msgEl.appendChild(spinner);
    }

    if (beforeEl && beforeEl.parentNode === messagesEl) {
        messagesEl.insertBefore(msgEl, beforeEl);
    } else {
        messagesEl.appendChild(msgEl);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
    setWebSpriteMood('thinking');

    let streamedContent = '';
    let streamComplete = false;

    const handleChunk = (data) => {
        if (streamComplete) return;
        if (data.content) {
            streamedContent += data.content;
            streamMsgEl.classList.remove('thinking');
            setWebSpriteMood('responding');
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
                window.electronAPI.chatMood('success');
                setWebSpriteMood('success');
                // Build metrics for persistence
                let savedMetrics = null;
                // Show generation metrics
                if (data.metrics) {
                    const m = data.metrics;
                    const profileSelect = document.getElementById('select-llm-profile');
                    const profileName = (profileSelect?.selectedOptions[0]?.textContent && profileSelect.value) ? profileSelect.selectedOptions[0].textContent : null;
                    savedMetrics = {
                        ttft: m.ttft,
                        tokensPerSec: m.tokensPerSec,
                        totalTime: m.totalTime,
                        tokenCount: m.tokenCount,
                        profileName: profileName
                    };
                    const parts = [];
                    if (m.ttft !== null && m.ttft !== undefined) parts.push('TTFT: ' + Number(m.ttft).toFixed(2) + 's');
                    if (m.tokensPerSec) parts.push(m.tokensPerSec + ' tok/s');
                    if (m.totalTime) parts.push(m.totalTime + 's total');
                    if (parts.length) {
                        const metricsEl = document.createElement('div');
                        metricsEl.className = 'message-metrics';
                        const statsSpan = document.createElement('span');
                        statsSpan.textContent = parts.join(' · ');
                        metricsEl.appendChild(statsSpan);
                        if (profileName) {
                            const nameSpan = document.createElement('span');
                            nameSpan.className = 'metrics-profile';
                            nameSpan.textContent = profileName;
                            metricsEl.appendChild(nameSpan);
                        }
                        streamMsgEl.appendChild(metricsEl);
                    }
                    // Update session token counter
                    if (m.tokenCount) {
                        sessionTokens += m.tokenCount;
                        const tokEl = document.getElementById('session-tokens');
                        if (tokEl) tokEl.textContent = sessionTokens;
                    }
                    // Update response time sparkline
                    if (m.totalTime) {
                        responseTimes.push(parseFloat(m.totalTime));
                        if (responseTimes.length > 40) responseTimes.shift();
                        updateSparkline();
                    }
                }
                if (window.electronAPI && window.electronAPI.saveChatMessage) window.electronAPI.saveChatMessage('assistant', streamedContent, savedMetrics);
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
        setWebSpriteMood('error');
        isSending = false;
        sendBtn.disabled = false;
        inputEl.focus();
    };

    // Track tool call messages so we can update their status
    const toolMsgEls = {};

    const handleToolStatus = (data) => {
        if (streamComplete) return;
        const key = data.tool + '_' + (data.summary || '').slice(0, 30);
        if (data.status === 'running') {
            const label = `${data.icon} ${data.tool}${data.summary ? ': ' + data.summary : ''}`;
            const el = addToolMessage(label, 'running', streamWrapperEl);
            toolMsgEls[key] = el;
        } else if (toolMsgEls[key]) {
            const el = toolMsgEls[key];
            const statusIcon = data.status === 'error' ? '✗' : '✓';
            const textSpan = el.querySelector('.tool-label');
            if (textSpan) {
                textSpan.textContent = `${data.icon} ${data.tool} ${statusIcon}`;
            }
            el.classList.remove('tool-running');
            el.classList.add(data.status === 'error' ? 'tool-error' : 'tool-done');
        }
    };

    window.electronAPI.removeChatStreamListeners();
    window.electronAPI.onChatStreamChunk(handleChunk);
    window.electronAPI.onChatStreamError(handleError);
    if (window.electronAPI.onChatToolStatus) {
        window.electronAPI.onChatToolStatus(handleToolStatus);
    }
    window.electronAPI.sendChatMessageStream(chatHistory);
}

function updateSparkline() {
    const container = document.getElementById('latency-sparkline');
    if (!container) return;
    container.innerHTML = '';
    const max = Math.max(...responseTimes, 1);
    responseTimes.forEach(t => {
        const bar = document.createElement('div');
        bar.className = 'spark-bar' + (t > 5 ? ' very-slow' : t > 2 ? ' slow' : '');
        bar.style.height = Math.max(1, (t / max) * 10) + 'px';
        bar.title = t + 's';
        container.appendChild(bar);
    });
}

export function loadResponseTimes(times) {
    if (Array.isArray(times) && times.length) {
        responseTimes = times.slice(-40);
        updateSparkline();
    }
}

export function clearChatHistory() {
    const msgEls = messagesEl.querySelectorAll('.message-wrapper, .message.system, .message.tool-call');
    msgEls.forEach(el => el.remove());
    chatHistory = [];
    responseTimes = [];
    sessionTokens = 0;
    const tokEl = document.getElementById('session-tokens');
    if (tokEl) tokEl.textContent = '0';
    updateSparkline();
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

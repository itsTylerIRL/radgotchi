// Chat messages — addMessage, sendMessage, sprite management, boot animation, sleep timer

import SoundSystem from '../renderer/sounds.js';
import { translations, sleepMessages, getCurrentLang } from './translations.js';
import { parseMarkdown, copyCode, getHueRotation } from './markdown.js';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const fileInputEl = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const attachmentPreviewEl = document.getElementById('attachment-preview');

export let chatHistory = [];
let isSending = false;

// Pending file attachments (base64 data URLs)
let pendingAttachments = [];
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

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

// ═══════════════════════════════════════════════════════════════════════════
// Web Sprite Face Lifecycle — cycles faces locally for dynamic feel
// ═══════════════════════════════════════════════════════════════════════════

let _faceTimer = null;
let _faceSequence = null;
let _faceStep = 0;
let _idleTimer = null;
let _lastActivity = Date.now();
let _faceLocked = false; // true while a sequence is playing

const WEB_FACES = {
    awake: 'AWAKE.png', happy: 'HAPPY.png', excited: 'EXCITED.png',
    cool: 'COOL.png', grateful: 'GRATEFUL.png', motivated: 'MOTIVATED.png',
    friend: 'FRIEND.png', smart: 'SMART.png', intense: 'INTENSE.png',
    debug: 'DEBUG.png', bored: 'BORED.png', sad: 'SAD.png',
    angry: 'ANGRY.png', lonely: 'LONELY.png', demotivated: 'DEMOTIVATED.png',
    broken: 'BROKEN.png', look_l: 'LOOK_L.png', look_r: 'LOOK_R.png',
    look_l_happy: 'LOOK_L_HAPPY.png', look_r_happy: 'LOOK_R_HAPPY.png',
    sleep: 'SLEEP.png', sleep2: 'SLEEP2.png',
    upload: 'UPLOAD.png', upload1: 'UPLOAD1.png', upload2: 'UPLOAD2.png',
};

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Set the sprite to a named face (web sprite img + desktop IPC) */
export function setWebSpriteFace(faceName) {
    if (!WEB_FACES[faceName]) return;
    // Web mode: update the sprite img element directly
    if (webSpriteImg) webSpriteImg.src = 'assets/gotchi/' + WEB_FACES[faceName];
    // Desktop Electron: forward face change to main renderer window
    const api = window.electronAPI;
    if (api && api.setFace) api.setFace(faceName);
}

/** Play a timed face sequence: [{face, ms}, ...] then optionally revert */
export function playFaceSequence(steps, revertFace = 'awake') {
    stopFaceSequence();
    _faceLocked = true;
    _faceSequence = steps;
    _faceStep = 0;
    _runFaceStep(revertFace);
}

function _runFaceStep(revertFace) {
    if (!_faceSequence || _faceStep >= _faceSequence.length) {
        // Sequence done — revert
        _faceLocked = false;
        _faceSequence = null;
        if (revertFace) setWebSpriteFace(revertFace);
        return;
    }
    const step = _faceSequence[_faceStep];
    setWebSpriteFace(step.face);
    _faceStep++;
    _faceTimer = setTimeout(() => _runFaceStep(revertFace), step.ms);
}

export function stopFaceSequence() {
    if (_faceTimer) { clearTimeout(_faceTimer); _faceTimer = null; }
    _faceSequence = null;
    _faceStep = 0;
    _faceLocked = false;
}

// ── Thinking sequence: cycles smart/debug/intense while waiting ──
let _thinkTimer = null;
const _thinkFaces = ['smart', 'debug', 'smart', 'intense', 'debug', 'smart'];
let _thinkIdx = 0;

export function startThinkingCycle() {
    _lastActivity = Date.now();
    stopFaceSequence();
    _thinkIdx = 0;
    setWebSpriteFace('smart');
    _thinkTimer = setInterval(() => {
        _thinkIdx = (_thinkIdx + 1) % _thinkFaces.length;
        setWebSpriteFace(_thinkFaces[_thinkIdx]);
    }, 1200);
}

export function stopThinkingCycle() {
    if (_thinkTimer) { clearInterval(_thinkTimer); _thinkTimer = null; }
}

// ── Responding sequence: bouncy upload/excited cycle ──
let _respondTimer = null;
const _respondFaces = ['upload', 'upload1', 'upload2', 'upload1', 'excited', 'upload'];
let _respondIdx = 0;

export function startRespondingCycle() {
    stopThinkingCycle();
    _respondIdx = 0;
    setWebSpriteFace('upload');
    _respondTimer = setInterval(() => {
        _respondIdx = (_respondIdx + 1) % _respondFaces.length;
        setWebSpriteFace(_respondFaces[_respondIdx]);
    }, 600);
}

export function stopRespondingCycle() {
    if (_respondTimer) { clearInterval(_respondTimer); _respondTimer = null; }
}

// ── Reaction flash: show a face briefly then revert ──
export function flashFace(faceName, durationMs = 1800) {
    _lastActivity = Date.now();
    stopFaceSequence();
    stopThinkingCycle();
    stopRespondingCycle();
    setWebSpriteFace(faceName);
    _faceTimer = setTimeout(() => setWebSpriteFace('awake'), durationMs);
}

// ── Success / Error reactions ──
export function playSuccessReaction() {
    _lastActivity = Date.now();
    stopThinkingCycle();
    stopRespondingCycle();
    const face = _pick(['happy', 'excited', 'cool', 'grateful', 'motivated']);
    setWebSpriteFace(face);
    _faceTimer = setTimeout(() => setWebSpriteFace('awake'), 2500);
}

export function playErrorReaction() {
    _lastActivity = Date.now();
    stopThinkingCycle();
    stopRespondingCycle();
    const face = _pick(['broken', 'angry', 'sad']);
    setWebSpriteFace(face);
    _faceTimer = setTimeout(() => setWebSpriteFace('awake'), 2500);
}

// ── Arcade reactions ──
export function playArcadeBetReaction() {
    _lastActivity = Date.now();
    setWebSpriteFace('intense');
}

export function playArcadeWinReaction() {
    _lastActivity = Date.now();
    playFaceSequence([
        { face: 'excited', ms: 800 },
        { face: 'cool', ms: 800 },
        { face: 'happy', ms: 800 },
    ], 'awake');
}

export function playArcadeLoseReaction() {
    _lastActivity = Date.now();
    playFaceSequence([
        { face: 'sad', ms: 600 },
        { face: 'demotivated', ms: 800 },
        { face: 'bored', ms: 600 },
    ], 'awake');
}

export function playArcadeDealReaction() {
    _lastActivity = Date.now();
    setWebSpriteFace('debug');
}

export function playArcadeJackpotReaction() {
    _lastActivity = Date.now();
    playFaceSequence([
        { face: 'excited', ms: 500 },
        { face: 'cool', ms: 500 },
        { face: 'excited', ms: 500 },
        { face: 'motivated', ms: 500 },
        { face: 'happy', ms: 800 },
    ], 'awake');
}

// ── Idle face cycling — mimics desktop mood routines ──
const _idleRoutines = [
    // patrol
    [{ face: 'look_l', ms: 1500 }, { face: 'awake', ms: 800 }, { face: 'look_r', ms: 1500 }, { face: 'awake', ms: 800 }, { face: 'look_l_happy', ms: 1200 }],
    // vibe
    [{ face: 'cool', ms: 1800 }, { face: 'happy', ms: 1200 }, { face: 'cool', ms: 1500 }, { face: 'motivated', ms: 1200 }],
    // study
    [{ face: 'smart', ms: 1500 }, { face: 'debug', ms: 1200 }, { face: 'smart', ms: 1000 }, { face: 'excited', ms: 1200 }],
    // social
    [{ face: 'look_l', ms: 1000 }, { face: 'friend', ms: 1500 }, { face: 'happy', ms: 1200 }, { face: 'look_r', ms: 1000 }, { face: 'grateful', ms: 1200 }],
    // workout
    [{ face: 'motivated', ms: 1200 }, { face: 'intense', ms: 1000 }, { face: 'motivated', ms: 800 }, { face: 'excited', ms: 1000 }, { face: 'cool', ms: 1200 }],
    // upload cycle
    [{ face: 'upload', ms: 800 }, { face: 'upload1', ms: 600 }, { face: 'upload2', ms: 600 }, { face: 'upload1', ms: 600 }, { face: 'happy', ms: 1200 }],
    // hack
    [{ face: 'debug', ms: 1200 }, { face: 'smart', ms: 1000 }, { face: 'intense', ms: 1200 }, { face: 'debug', ms: 800 }, { face: 'excited', ms: 1200 }],
    // chill
    [{ face: 'cool', ms: 2000 }, { face: 'look_r_happy', ms: 1200 }, { face: 'happy', ms: 1500 }, { face: 'look_l_happy', ms: 1200 }],
];

function _startIdleLoop() {
    if (_idleTimer) return;
    _idleTimer = setInterval(() => {
        // Don't interrupt active sequences
        if (_faceLocked || _thinkTimer || _respondTimer) return;
        const elapsed = Date.now() - _lastActivity;
        // After 12s idle, 40% chance to run a routine
        if (elapsed > 12000 && Math.random() < 0.40) {
            const routine = _pick(_idleRoutines);
            playFaceSequence(routine, 'awake');
        }
        // After 8s idle, 20% chance for a quick random face
        else if (elapsed > 8000 && Math.random() < 0.20) {
            const quick = _pick(['happy', 'cool', 'look_l', 'look_r', 'motivated', 'smart']);
            setWebSpriteFace(quick);
            setTimeout(() => { if (!_faceLocked) setWebSpriteFace('awake'); }, 2000);
        }
    }, 5000);
}

// Start idle loop on load (web mode only — desktop has its own mood engine)
if (webSpriteImg) _startIdleLoop();

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
    if ((!message && pendingAttachments.length === 0) || isSending) return;

    // Handle /remember command — store a memory directly
    if (message.toLowerCase().startsWith('/remember ')) {
        const fact = message.slice(10).trim();
        if (!fact) return;
        inputEl.value = '';
        addMessage('user', message);
        if (window.electronAPI && window.electronAPI.addPetMemoryFact) {
            const result = await window.electronAPI.addPetMemoryFact(fact);
            if (result && result.success) {
                addMessage('system', '🧠 memorized: ' + fact);
            } else {
                addMessage('system', '🧠 already known or invalid');
            }
        } else {
            addMessage('system', 'Memory storage not available');
        }
        return;
    }

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
    const currentAttachments = [...pendingAttachments];
    clearAttachments();

    const msgEl = addMessage('user', message || (currentAttachments.length + ' file(s) attached'));
    if (currentAttachments.length > 0) renderMessageAttachments(msgEl, currentAttachments);

    // Build multimodal content for the API if attachments present
    const apiContent = buildMultimodalContent(message, currentAttachments);
    chatHistory.push({ role: 'user', content: apiContent });
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
    startThinkingCycle();

    let streamedContent = '';
    let streamComplete = false;

    const handleChunk = (data) => {
        if (streamComplete) return;
        if (data.content) {
            streamedContent += data.content;
            streamMsgEl.classList.remove('thinking');
            setWebSpriteMood('responding');
            if (_thinkTimer) startRespondingCycle(); // switch from thinking to responding cycle
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
                playSuccessReaction();
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
        playErrorReaction();
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

// ═══════════════════════════════════════════════════════════════════════════
// File Attachments — images, video, documents for multimodal LLMs
// ═══════════════════════════════════════════════════════════════════════════

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

async function addAttachmentFiles(files) {
    for (const file of files) {
        if (file.size > MAX_ATTACHMENT_SIZE) {
            addMessage('system', `File too large: ${file.name} (max 20MB)`);
            continue;
        }
        try {
            const dataUrl = await readFileAsDataURL(file);
            const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
            const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.type);
            pendingAttachments.push({
                name: file.name,
                type: file.type,
                dataUrl,
                isImage,
                isVideo,
            });
        } catch (e) {
            addMessage('system', `Failed to read: ${file.name}`);
        }
    }
    renderAttachmentPreview();
}

function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    renderAttachmentPreview();
}

function clearAttachments() {
    pendingAttachments = [];
    renderAttachmentPreview();
}

function renderAttachmentPreview() {
    attachmentPreviewEl.innerHTML = '';
    if (pendingAttachments.length === 0) {
        attachmentPreviewEl.style.display = 'none';
        return;
    }
    attachmentPreviewEl.style.display = 'flex';
    pendingAttachments.forEach((att, i) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';
        if (att.isImage) {
            const img = document.createElement('img');
            img.src = att.dataUrl;
            img.alt = att.name;
            item.appendChild(img);
        } else if (att.isVideo) {
            const icon = document.createElement('span');
            icon.className = 'attachment-icon';
            icon.textContent = '🎬';
            item.appendChild(icon);
            const label = document.createElement('span');
            label.className = 'attachment-name';
            label.textContent = att.name;
            item.appendChild(label);
        } else {
            const icon = document.createElement('span');
            icon.className = 'attachment-icon';
            icon.textContent = '📄';
            item.appendChild(icon);
            const label = document.createElement('span');
            label.className = 'attachment-name';
            label.textContent = att.name;
            item.appendChild(label);
        }
        const removeBtn = document.createElement('button');
        removeBtn.className = 'attachment-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removeAttachment(i));
        item.appendChild(removeBtn);
        attachmentPreviewEl.appendChild(item);
    });
}

/** Build the multimodal content array for an OpenAI-compatible API message */
function buildMultimodalContent(text, attachments) {
    if (!attachments || attachments.length === 0) return text;
    const parts = [];
    if (text) parts.push({ type: 'text', text });
    for (const att of attachments) {
        if (att.isImage) {
            parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
        } else if (att.isVideo) {
            // Some APIs support video as image_url with video mime type
            parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
        } else {
            // Text-based files: extract base64 content as text
            const base64 = att.dataUrl.split(',')[1];
            let decoded;
            try { decoded = atob(base64); } catch { decoded = '[binary file]'; }
            parts.push({ type: 'text', text: `[File: ${att.name}]\n${decoded}` });
        }
    }
    return parts;
}

/** Render attachment thumbnails inside a message bubble */
function renderMessageAttachments(msgEl, attachments) {
    if (!attachments || attachments.length === 0) return;
    const strip = document.createElement('div');
    strip.className = 'message-attachments';
    for (const att of attachments) {
        if (att.isImage) {
            const img = document.createElement('img');
            img.src = att.dataUrl;
            img.alt = att.name;
            img.className = 'msg-attachment-thumb';
            img.addEventListener('click', () => window.open(att.dataUrl, '_blank'));
            strip.appendChild(img);
        } else if (att.isVideo) {
            const video = document.createElement('video');
            video.src = att.dataUrl;
            video.className = 'msg-attachment-thumb';
            video.controls = true;
            video.muted = true;
            strip.appendChild(video);
        } else {
            const badge = document.createElement('span');
            badge.className = 'msg-attachment-badge';
            badge.textContent = '📄 ' + att.name;
            strip.appendChild(badge);
        }
    }
    msgEl.prepend(strip);
}

export function getAttachments() { return pendingAttachments; }
export { addAttachmentFiles, clearAttachments, buildMultimodalContent, renderMessageAttachments };

// Attach button
attachBtn.addEventListener('click', () => {
    SoundSystem.play('click');
    fileInputEl.click();
});

fileInputEl.addEventListener('change', () => {
    if (fileInputEl.files.length > 0) addAttachmentFiles(Array.from(fileInputEl.files));
    fileInputEl.value = '';
});

// Drag and drop on messages area
messagesEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    messagesEl.classList.add('drag-over');
});
messagesEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    messagesEl.classList.remove('drag-over');
});
messagesEl.addEventListener('drop', (e) => {
    e.preventDefault();
    messagesEl.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) addAttachmentFiles(Array.from(e.dataTransfer.files));
});

// Paste images from clipboard
inputEl.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
        if (item.kind === 'file') files.push(item.getAsFile());
    }
    if (files.length > 0) addAttachmentFiles(files);
});

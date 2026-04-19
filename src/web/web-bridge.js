// ═══════════════════════════════════════════════════════════════════════════
// Web Bridge — provides window.electronAPI backed by WebSocket
// Loaded in web mode instead of Electron preload scripts
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;

    let ws = null;
    let connected = false;
    let pendingInvokes = new Map(); // id → { resolve, reject, timer }
    let eventListeners = {};        // channel → [callback, ...]
    let eventBuffer = {};           // channel → [data, ...] — buffered until listener registered
    let invokeCounter = 0;
    let reconnectTimer = null;

    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            connected = true;
            console.log('[WebBridge] Connected');
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);

                // Response to an invoke call
                if (msg.type === 'response' && msg.id !== undefined) {
                    const pending = pendingInvokes.get(msg.id);
                    if (pending) {
                        pendingInvokes.delete(msg.id);
                        clearTimeout(pending.timer);
                        if (msg.data && msg.data.error) {
                            pending.reject(new Error(msg.data.error));
                        } else {
                            pending.resolve(msg.data);
                        }
                    }
                    return;
                }

                // Server-pushed event
                if (msg.type === 'event' && msg.event) {
                    const listeners = eventListeners[msg.event];
                    if (listeners && listeners.length > 0) {
                        for (const cb of listeners) {
                            try { cb(msg.data); } catch (e) { console.error('[WebBridge] Event handler error:', e); }
                        }
                    } else {
                        // No listeners yet — buffer for when they register
                        if (!eventBuffer[msg.event]) eventBuffer[msg.event] = [];
                        eventBuffer[msg.event].push(msg.data);
                    }
                    return;
                }
            } catch (e) {
                console.error('[WebBridge] Parse error:', e);
            }
        };

        ws.onclose = () => {
            connected = false;
            console.log('[WebBridge] Disconnected, reconnecting...');
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[WebBridge] WebSocket error');
            ws.close();
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, 2000);
    }

    // ── HTTP fallback helpers ──────────────────────────────────────────

    const httpOrigin = window.location.origin;

    async function httpInvoke(channel, args) {
        const res = await fetch(`${httpOrigin}/api/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, args }),
        });
        if (!res.ok) throw new Error(`HTTP invoke failed: ${res.status}`);
        return res.json();
    }

    function httpSend(channel, args) {
        fetch(`${httpOrigin}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, args }),
        }).catch(() => {});
    }

    function httpChatStream(messages) {
        fetch(`${httpOrigin}/api/chat-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        }).then(res => {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            function pump() {
                reader.read().then(({ done, value }) => {
                    if (done) return;
                    buf += decoder.decode(value, { stream: true });
                    // Parse SSE frames
                    const parts = buf.split('\n\n');
                    buf = parts.pop(); // keep incomplete frame
                    for (const part of parts) {
                        let eventName = '', data = '';
                        for (const line of part.split('\n')) {
                            if (line.startsWith('event: ')) eventName = line.slice(7);
                            else if (line.startsWith('data: ')) data = line.slice(6);
                        }
                        if (eventName && data) {
                            try {
                                const parsed = JSON.parse(data);
                                const listeners = eventListeners[eventName];
                                if (listeners) {
                                    for (const cb of listeners) {
                                        try { cb(parsed); } catch (e) { console.error('[WebBridge] SSE handler error:', e); }
                                    }
                                }
                            } catch (e) { console.error('[WebBridge] SSE parse error:', e); }
                        }
                    }
                    pump();
                }).catch(() => {});
            }
            pump();
        }).catch(err => {
            const listeners = eventListeners['chat-stream-error'];
            if (listeners) {
                for (const cb of listeners) {
                    try { cb({ error: err.message }); } catch (e) {}
                }
            }
        });
    }

    // ── Primary transport with automatic HTTP fallback ──────────────

    function wsReady() {
        return connected && ws && ws.readyState === WebSocket.OPEN;
    }

    // invoke: request/response — tries WS first, falls back to HTTP
    async function invoke(channel, args) {
        if (wsReady()) {
            return new Promise((resolve, reject) => {
                const id = ++invokeCounter;
                const timer = setTimeout(() => {
                    pendingInvokes.delete(id);
                    reject(new Error('Invoke timeout: ' + channel));
                }, 30000);
                pendingInvokes.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ type: 'invoke', id, channel, args }));
            });
        }
        // WS not available — use HTTP
        return httpInvoke(channel, args);
    }

    // send: fire-and-forget — tries WS first, falls back to HTTP
    function send(channel, args) {
        if (wsReady()) {
            ws.send(JSON.stringify({ type: 'send', channel, args }));
        } else {
            httpSend(channel, args);
        }
    }

    // sendStream: streaming chat — tries WS first, falls back to SSE
    function sendStream(messages) {
        if (wsReady()) {
            ws.send(JSON.stringify({ type: 'send', channel: 'send-chat-message-stream', args: { messages } }));
        } else {
            httpChatStream(messages);
        }
    }

    // on: register event listener (flushes any buffered events)
    function on(event, callback) {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(callback);
        // Flush buffered events that arrived before this listener was registered
        if (eventBuffer[event]) {
            const buffered = eventBuffer[event];
            delete eventBuffer[event];
            for (const data of buffered) {
                try { callback(data); } catch (e) { console.error('[WebBridge] Event handler error:', e); }
            }
        }
    }

    // removeAllListeners for a channel
    function removeAllListeners(event) {
        delete eventListeners[event];
    }

    // Seed event buffer from server-embedded state (injected as inline script before this runs)
    if (window.__RADGOTCHI_INITIAL_STATE__) {
        eventBuffer['chat-ready'] = [window.__RADGOTCHI_INITIAL_STATE__];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Build the electronAPI-compatible interface
    // Must match every method used by the chat renderer modules
    // ═══════════════════════════════════════════════════════════════════════

    window.electronAPI = {
        // Close / settings — no-ops in web mode
        closeChat: () => {},
        openSettings: () => {},

        // Sound notification — no main window to notify
        notifySoundPlayed: (soundName) => send('sound-played', soundName),

        // Non-streaming chat
        sendChatMessage: (messages) => invoke('send-chat-message', { messages }),

        // Streaming chat
        sendChatMessageStream: (messages) => sendStream(messages),
        onChatStreamChunk: (cb) => on('chat-stream-chunk', cb),
        onChatStreamError: (cb) => on('chat-stream-error', cb),
        onChatToolStatus: (cb) => on('chat-tool-status', cb),
        removeChatStreamListeners: () => {
            removeAllListeners('chat-stream-chunk');
            removeAllListeners('chat-stream-error');
            removeAllListeners('chat-tool-status');
        },

        // Chat mood
        chatMood: (mood) => send('chat-mood', mood),

        // Chat ready event
        onChatReady: (cb) => on('chat-ready', cb),

        // Color
        onSetColor: (cb) => on('set-color', cb),
        setColor: (color) => send('chat-set-color', color),

        // Controls
        setMovementMode: (mode) => send('chat-set-movement', mode),
        setLanguage: (lang) => send('chat-set-language', lang),
        onSetLanguage: (cb) => on('set-language', cb),
        onMovementModeChange: (cb) => on('movement-mode-change', cb),

        // Sleep
        setSleep: (sleeping) => send('chat-set-sleep', sleeping),
        onSetSleep: (cb) => on('set-sleep', cb),

        // Mute
        setMute: (muted) => send('chat-set-mute', muted),

        // Vibe mode
        setVibeMode: (enabled) => send('chat-set-vibe', enabled),
        onAudioLevels: (cb) => on('audio-levels', cb),

        // Zoom
        setZoom: (zoom) => send('chat-set-zoom', zoom),

        // XP System
        getXpStatus: () => invoke('get-xp-status'),
        addXp: (amount, source) => invoke('add-xp', { amount, source }),
        onXpUpdate: (cb) => on('xp-update', cb),

        // Attention events
        onAttentionEvent: (cb) => on('attention-event', cb),

        // Pet Needs
        getNeeds: () => invoke('get-needs'),
        feedPet: (amount, type) => invoke('feed-pet', { amount, type }),
        onNeedsUpdate: (cb) => on('needs-update', cb),

        // Pomodoro
        pomodoroStart: (mode) => invoke('pomodoro-start', { mode }),
        pomodoroStop: () => invoke('pomodoro-stop'),
        pomodoroStatus: () => invoke('pomodoro-status'),
        onPomodoroUpdate: (cb) => on('pomodoro-update', cb),
        onPomodoroComplete: (cb) => on('pomodoro-complete', cb),

        // Chat History
        getChatHistory: () => invoke('get-chat-history'),
        saveChatMessage: (role, content, metrics) => send('save-chat-message', { role, content, metrics }),
        clearChatHistory: () => invoke('clear-chat-history'),
        onActivityLogUpdate: (cb) => on('activity-log-update', cb),

        // PFP Updates
        onPfpUpdate: (cb) => on('pfp-update', cb),

        // Sprite updates
        onSpriteUpdate: (cb) => on('sprite-update', cb),

        // Network Discovery
        networkDiscoveryToggle: (enabled) => invoke('network-discovery-toggle', enabled),
        getNetworkStatus: () => invoke('get-network-status'),
        getDiscoveredNodes: () => invoke('get-discovered-nodes'),
        sendMeshMessage: (text) => invoke('send-mesh-message', text),
        getMeshMessages: () => invoke('get-mesh-messages'),
        saveMeshMessages: (messages) => invoke('save-mesh-messages', messages),
        onNetworkUpdate: (cb) => on('network-update', cb),

        // LLM Profiles — use embedded data if available, fallback to WebSocket
        getLlmProfiles: () => {
            if (window.__RADGOTCHI_PROFILES__) {
                const data = window.__RADGOTCHI_PROFILES__;
                return Promise.resolve(data);
            }
            return invoke('get-llm-profiles');
        },
        loadLlmProfile: (id) => invoke('load-llm-profile', id),
        saveLlmProfile: (name) => invoke('save-llm-profile', name),
        updateLlmProfile: (id) => invoke('update-llm-profile', id),
        deleteLlmProfile: (id) => invoke('delete-llm-profile', id),
        renameLlmProfile: (id, name) => invoke('rename-llm-profile', { id, name }),

        // Settings (LLM config save, memory, PFP)
        saveLlmConfig: (config) => invoke('save-llm-config', config),
        clearPetMemory: () => invoke('clear-pet-memory'),
        openSettings: () => { window.location.href = '/settings'; },

        // System Metrics & LLM Config
        getLlmConfig: () => invoke('get-llm-config'),
        getSystemMetrics: () => invoke('get-system-metrics'),
    };

    // Connect immediately — events are buffered until listeners register
    connect();
})();

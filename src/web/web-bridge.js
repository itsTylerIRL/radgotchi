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
                    if (listeners) {
                        for (const cb of listeners) {
                            try { cb(msg.data); } catch (e) { console.error('[WebBridge] Event handler error:', e); }
                        }
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

    // invoke: request/response over WebSocket
    function invoke(channel, args) {
        return new Promise((resolve, reject) => {
            if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected'));
                return;
            }
            const id = ++invokeCounter;
            const timer = setTimeout(() => {
                pendingInvokes.delete(id);
                reject(new Error('Invoke timeout: ' + channel));
            }, 30000);
            pendingInvokes.set(id, { resolve, reject, timer });
            ws.send(JSON.stringify({ type: 'invoke', id, channel, args }));
        });
    }

    // send: fire-and-forget over WebSocket
    function send(channel, args) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'send', channel, args }));
        }
    }

    // on: register event listener
    function on(event, callback) {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(callback);
    }

    // removeAllListeners for a channel
    function removeAllListeners(event) {
        delete eventListeners[event];
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
        sendChatMessageStream: (messages) => send('send-chat-message-stream', { messages }),
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

        // LLM Profiles
        getLlmProfiles: () => invoke('get-llm-profiles'),
        loadLlmProfile: (id) => invoke('load-llm-profile', id),

        // System Metrics & LLM Config
        getSystemMetrics: () => invoke('get-system-metrics'),
        getLlmConfig: () => invoke('get-llm-config'),
    };

    // Start connection
    connect();
})();

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Web Server Mode — serves the chat interface over HTTP + WebSocket
// Designed for remote access via Tailscale or local network
// ═══════════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

let _deps = null;
let httpServer = null;
let wsClients = new Set();

// Intervals for pushing state updates
let pushInterval = null;
// Unsubscribe callback returned by broadcast.subscribe() in startPushEvents
let _broadcastUnsubscribe = null;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.mp3':  'audio/mpeg',
    '.wav':  'audio/wav',
    '.ogg':  'audio/ogg',
};

function init(deps) {
    _deps = deps;
}

// ═══════════════════════════════════════════════════════════════════════════
// Static file server
// ═══════════════════════════════════════════════════════════════════════════

function getProjectRoot() {
    return path.join(__dirname, '..', '..');
}

function injectWebMode(html) {
    // Inject the web bridge script before the closing </head> tag (cache-bust).
    const bridgeScript = `<script src="/src/web/web-bridge.js?v=${Date.now()}"></script>`;
    html = html.replace('</head>', bridgeScript + '\n</head>');

    // Set viewport for mobile — prevent zoom on input focus
    html = html.replace(
        /<meta name="viewport"[^>]*>/,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
    );

    // Mark web mode so client JS can detect it
    html = html.replace('<body>', '<body data-web-mode="true">');

    // Inject favicon and web app manifest links
    const iconLinks = [
        '<link rel="icon" type="image/x-icon" href="/assets/favicon_rg/favicon.ico">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon_rg/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon_rg/favicon-16x16.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon_rg/apple-touch-icon.png">',
        '<link rel="manifest" href="/manifest.json">',
        '<meta name="theme-color" content="#0a0c0a">',
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    ].join('\n    ');
    html = html.replace('</head>', '    ' + iconLinks + '\n</head>');

    // Relax CSP for web mode — allow WebSocket connections and inline scripts
    html = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: ws: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; img-src 'self' blob: data: https: http:; connect-src 'self' ws: wss: http: https:;">`
    );

    return html;
}

function serveChatHtml(res) {
    const root = getProjectRoot();
    let html = fs.readFileSync(path.join(root, 'chat.html'), 'utf-8');

    // Embed initial state directly in the HTML so the page doesn't depend on
    // WebSocket timing for initial data (profiles, XP, PFP, etc.)
    // MUST be injected BEFORE injectWebMode() so the state <script> appears
    // before web-bridge.js in the HTML — bridge reads __RADGOTCHI_INITIAL_STATE__
    // at load time to seed its event buffer.
    const { xpSystem, llm, petNeeds, pomodoro, sleepWork, movement } = _deps;
    const xpStatus = xpSystem.getXpStatus();
    const pState = pomodoro.getState();
    xpStatus.pomodoro = {
        active: pState.active, mode: pState.mode,
        remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
        pomosCompleted: pState.pomosCompleted,
    };
    const initialState = {
        configured: llm.getLlmConfig().enabled,
        movementMode: movement.getMovementMode(),
        color: llm.getSpriteState().color || '#ff3344',
        expressionOnly: false,
        xp: xpStatus,
        needs: petNeeds.getNeeds(),
        spriteState: llm.getSpriteState(),
        operatorPfp: llm.getLlmConfig().operatorPfp || null,
        zoom: 100,
        isSleeping: sleepWork.getIsSleeping(),
        language: xpSystem.getXpData().savedLang || 'en',
        pomodoroActive: pState.active,
    };
    const profiles = llm.getProfiles();
    const stateScript = `<script>window.__RADGOTCHI_INITIAL_STATE__ = ${JSON.stringify(initialState)};window.__RADGOTCHI_PROFILES__ = ${JSON.stringify(profiles)};</script>`;
    html = html.replace('</head>', stateScript + '\n</head>');

    // Now inject web-bridge (adds AFTER the state script since it also appends before </head>)
    html = injectWebMode(html);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
}

function serveSettingsHtml(res) {
    // Build settings HTML from llm module and inject web bridge
    const { llm } = _deps;
    let html = llm.buildSettingsHtml();

    // Inject web bridge and viewport (cache-bust)
    const bridgeScript = `<script src="/src/web/web-bridge.js?v=${Date.now()}"></script>`;
    html = html.replace('</head>', bridgeScript + '\n</head>');
    html = html.replace(
        /<meta name="viewport"[^>]*>/,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
    );
    // Add viewport if not present
    if (!html.includes('viewport')) {
        html = html.replace('</head>', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n</head>');
    }

    html = html.replace('<body>', '<body data-web-mode="true">');

    // Relax CSP for web mode
    html = html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: ws: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; img-src 'self' blob: data: https: http:; connect-src 'self' ws: wss: http: https:;">`
    );

    // Replace window.close() calls with navigation back to chat
    html = html.replace(/window\.close\(\)/g, "window.location.href='/'");

    // Replace Electron uploadPfp with a web-based file input approach
    html = html.replace(
        'async function uploadPfp() {',
        `async function uploadPfp() {
            if (document.body.dataset.webMode === 'true') {
                // Web mode: use file input instead of Electron dialog
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        operatorPfpImageUrl = reader.result;
                        const previewEl = document.getElementById('operatorPfpPreview');
                        previewEl.innerHTML = '';
                        const pfpImg = document.createElement('img');
                        pfpImg.src = operatorPfpImageUrl;
                        pfpImg.alt = 'PFP';
                        previewEl.appendChild(pfpImg);
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
                return;
            }
            // Electron mode below`
    );

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
}

function serveManifest(res) {
    const manifest = {
        name: 'Radgotchi',
        short_name: 'Radgotchi',
        description: 'RAD TERMINAL — virtual pet chat',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0c0a',
        theme_color: '#0a0c0a',
        icons: [
            { src: '/assets/favicon_rg/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/assets/favicon_rg/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/assets/favicon_rg/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ]
    };
    res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
    res.end(JSON.stringify(manifest));
}

function serveStatic(reqPath, res) {
    const root = getProjectRoot();

    // Sanitise path to prevent directory traversal
    const decoded = decodeURIComponent(reqPath);
    const normalised = path.normalize(decoded).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(root, normalised);

    // Must stay within project root
    if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket (minimal RFC 6455 implementation — no external deps)
// ═══════════════════════════════════════════════════════════════════════════

function acceptWebSocket(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB5CF11CE70')
        .digest('base64');

    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
    );

    const client = { socket, alive: true };
    wsClients.add(client);

    // Send initial chat-ready data
    sendChatReady(client);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length >= 2) {
            const frame = decodeFrame(buffer);
            if (!frame) break;
            buffer = buffer.slice(frame.totalLength);

            if (frame.opcode === 0x8) {
                // Close
                wsClients.delete(client);
                socket.end();
                return;
            }
            if (frame.opcode === 0x9) {
                // Ping → Pong
                sendFrame(socket, frame.payload, 0xA);
                continue;
            }
            if (frame.opcode === 0xA) {
                // Pong
                client.alive = true;
                continue;
            }
            if (frame.opcode === 0x1 || frame.opcode === 0x2) {
                // Text or binary
                try {
                    const msg = JSON.parse(frame.payload.toString('utf-8'));
                    handleClientMessage(client, msg);
                } catch (e) {
                    console.error('[WebServer] Invalid WS message:', e.message);
                }
            }
        }
    });

    socket.on('close', () => wsClients.delete(client));
    socket.on('error', () => wsClients.delete(client));
}

function decodeFrame(buf) {
    if (buf.length < 2) return null;
    const firstByte = buf[0];
    const secondByte = buf[1];
    const opcode = firstByte & 0x0F;
    const masked = !!(secondByte & 0x80);
    let payloadLen = secondByte & 0x7F;
    let offset = 2;

    if (payloadLen === 126) {
        if (buf.length < 4) return null;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        if (buf.length < 10) return null;
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
    }

    const maskLen = masked ? 4 : 0;
    const totalLength = offset + maskLen + payloadLen;
    if (buf.length < totalLength) return null;

    let payload;
    if (masked) {
        const mask = buf.slice(offset, offset + 4);
        payload = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
            payload[i] = buf[offset + 4 + i] ^ mask[i % 4];
        }
    } else {
        payload = buf.slice(offset, offset + payloadLen);
    }

    return { opcode, payload, totalLength };
}

function sendFrame(socket, data, opcode = 0x1) {
    if (!socket.writable) return;
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const len = payload.length;
    let header;

    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | opcode;
        header[1] = len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }

    socket.write(Buffer.concat([header, payload]));
}

function wsSend(client, data) {
    try {
        sendFrame(client.socket, JSON.stringify(data));
    } catch (e) {
        wsClients.delete(client);
    }
}

function wsBroadcast(eventName, data) {
    const msg = JSON.stringify({ type: 'event', event: eventName, data });
    for (const client of wsClients) {
        try { sendFrame(client.socket, msg); } catch (e) { wsClients.delete(client); }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// API handlers — mirrors the IPC handlers in windows.js
// ═══════════════════════════════════════════════════════════════════════════

function sendChatReady(client) {
    const { xpSystem, llm, petNeeds, pomodoro, sleepWork, movement, persistence } = _deps;
    const xpStatus = xpSystem.getXpStatus();
    const pState = pomodoro.getState();
    xpStatus.pomodoro = {
        active: pState.active,
        mode: pState.mode,
        remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
        pomosCompleted: pState.pomosCompleted,
    };

    wsSend(client, {
        type: 'event',
        event: 'chat-ready',
        data: {
            configured: llm.getLlmConfig().enabled,
            movementMode: movement.getMovementMode(),
            color: llm.getSpriteState().color || '#ff3344',
            expressionOnly: false,
            xp: xpStatus,
            needs: petNeeds.getNeeds(),
            spriteState: llm.getSpriteState(),
            operatorPfp: llm.getLlmConfig().operatorPfp || null,
            zoom: 100,
            isSleeping: sleepWork.getIsSleeping(),
            language: xpSystem.getXpData().savedLang || 'en',
            pomodoroActive: pState.active,
        }
    });
}

async function handleClientMessage(client, msg) {
    const { xpSystem, llm, petNeeds, pomodoro, sleepWork, movement, persistence,
            networkDiscovery, systemMonitor, petMemory,
            chatHistory, activityLog, responseTimes, saveChatData, addActivityLogEntry } = _deps;

    // Request/response pattern: { type: 'invoke', id, channel, args }
    if (msg.type === 'invoke') {
        let result;
        try {
            result = await handleInvoke(msg.channel, msg.args);
        } catch (e) {
            result = { error: e.message };
        }
        wsSend(client, { type: 'response', id: msg.id, data: result });
        return;
    }

    // Fire-and-forget: { type: 'send', channel, args }
    if (msg.type === 'send') {
        handleSend(client, msg.channel, msg.args);
        return;
    }
}

async function handleInvoke(channel, args) {
    const { xpSystem, llm, petNeeds, pomodoro, sleepWork, movement, persistence,
            networkDiscovery, systemMonitor, petMemory,
            chatHistory, activityLog, responseTimes, saveChatData } = _deps;

    switch (channel) {
        case 'get-system-metrics': {
            const cpuUsage = systemMonitor.getCpuUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memPercent = ((totalMem - freeMem) / totalMem) * 100;
            return { cpu: { usage_total: cpuUsage }, memory: { percent: memPercent }, temperatures: [] };
        }

        case 'get-llm-config': {
            const config = { ...llm.getLlmConfig() };
            config.memoryEnabled = petMemory.isEnabled();
            config.memoryCount = petMemory.getFacts().length;
            return config;
        }

        case 'get-xp-status': {
            const status = xpSystem.getXpStatus();
            const pState = pomodoro.getState();
            status.pomodoro = {
                active: pState.active,
                mode: pState.mode,
                remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
                pomosCompleted: pState.pomosCompleted,
            };
            return status;
        }

        case 'add-xp': {
            const { amount, source } = args || {};
            if (source === 'message-send') {
                const result = xpSystem.addXp(xpSystem.XP_CONFIG.MESSAGE_SEND_XP, 'message-send');
                return { awarded: true, ...result };
            }
            return { awarded: false, reason: 'invalid-source' };
        }

        case 'get-attention-status':
            return { active: xpSystem.isAttentionActive() };

        case 'pomodoro-start':
            return pomodoro.startPomodoro((args && args.mode) || 'work');

        case 'pomodoro-stop':
            return pomodoro.stopPomodoro();

        case 'pomodoro-status': {
            const s = pomodoro.getState();
            return {
                active: s.active, mode: s.mode,
                remaining: s.active ? Math.max(0, s.duration - (Date.now() - s.startTime)) : 0,
                duration: s.duration, pomosCompleted: s.pomosCompleted,
            };
        }

        case 'get-needs': {
            const n = petNeeds.getNeeds();
            return { hunger: n.hunger, energy: n.energy };
        }

        case 'feed-pet': {
            petNeeds.feedPet((args && args.amount) || 10, (args && args.type) || 'hunger');
            const n = petNeeds.getNeeds();
            return { hunger: n.hunger, energy: n.energy };
        }

        case 'send-chat-message': {
            const messages = args && args.messages;
            if (sleepWork.getIsSleeping()) sleepWork.stopSleepMode();
            const result = await llm.sendChatMessage(messages);
            if (result.content) xpSystem.addXp(xpSystem.XP_CONFIG.MESSAGE_RECEIVE_XP, 'message-receive');
            return result;
        }

        case 'get-chat-history':
            return { chatHistory: chatHistory(), activityLog: activityLog(), responseTimes: responseTimes() };

        case 'clear-chat-history':
            chatHistory().length = 0;
            saveChatData();
            return { success: true };

        case 'get-llm-profiles':
            return llm.getProfiles();

        case 'load-llm-profile':
            return llm.loadProfile(args);

        case 'save-llm-config': {
            if (args && args.memoryEnabled !== undefined) {
                petMemory.setEnabled(args.memoryEnabled);
            }
            const { memoryEnabled, memoryCount, ...llmFields } = args || {};
            const result = llm.saveLlmConfig(llmFields);
            wsBroadcast('pfp-update', { operatorPfp: llm.getLlmConfig().operatorPfp || null });
            return result;
        }

        case 'save-llm-profile':
            return llm.saveProfile(args);

        case 'update-llm-profile':
            return llm.updateProfile(args);

        case 'delete-llm-profile':
            return llm.deleteProfile(args);

        case 'rename-llm-profile': {
            const { id, name } = args || {};
            return llm.renameProfile(id, name);
        }

        case 'clear-pet-memory':
            petMemory.clearMemory();
            return { success: true };

        case 'get-pet-memory-facts':
            return petMemory.getFacts();

        case 'remove-pet-memory-fact': {
            const idx = args && args.index;
            const removed = petMemory.removeFact(idx);
            return { success: removed, facts: petMemory.getFacts() };
        }

        case 'add-pet-memory-fact': {
            const factText = args && args.fact;
            const added = petMemory.addFact(factText);
            return { success: added };
        }

        case 'network-discovery-toggle': {
            const enabled = args;
            if (enabled) networkDiscovery.startNetworkDiscovery();
            else networkDiscovery.stopNetworkDiscovery();
            persistence.updateWindowStateProperty('networkDiscovery', 'enabled', enabled);
            return networkDiscovery.getNetworkStatus();
        }

        case 'get-network-status':
            return networkDiscovery.getNetworkStatus();

        case 'get-discovered-nodes':
            return networkDiscovery.getDiscoveredNodes();

        case 'send-mesh-message':
            return networkDiscovery.sendMeshMessage(args);

        case 'get-mesh-messages':
            return persistence.loadMeshMessagesFromDisk();

        case 'save-mesh-messages':
            persistence.saveMeshMessagesToDisk(args);
            return true;

        // Arcade
        case 'arcade-get-state':
            return _deps.arcade.getArcadeState();

        case 'arcade-coinflip': {
            const { bet, choice } = args || {};
            return _deps.arcade.playCoinflip(bet, choice);
        }

        case 'arcade-blackjack-deal': {
            const { bet: bjBet } = args || {};
            return _deps.arcade.startBlackjack(bjBet);
        }

        case 'arcade-blackjack-hit':
            return _deps.arcade.blackjackHit();

        case 'arcade-blackjack-stand':
            return _deps.arcade.blackjackStand();

        case 'arcade-blackjack-double':
            return _deps.arcade.blackjackDouble();

        case 'arcade-buy-item': {
            const { itemId: buyId } = args || {};
            return _deps.arcade.buyItem(buyId);
        }

        case 'arcade-use-item': {
            const { itemId: useId } = args || {};
            return _deps.arcade.useItem(useId);
        }

        default:
            return { error: 'Unknown channel: ' + channel };
    }
}

function handleSend(client, channel, args) {
    const { xpSystem, llm, petNeeds, pomodoro, sleepWork, movement, persistence,
            chatHistory, responseTimes, saveChatData, addActivityLogEntry } = _deps;

    switch (channel) {
        case 'send-chat-message-stream': {
            if (sleepWork.getIsSleeping()) sleepWork.stopSleepMode();
            // Create a fake event object that mirrors Electron's event.reply()
            const fakeEvent = {
                reply: (eventName, data) => {
                    wsSend(client, { type: 'event', event: eventName, data });
                }
            };
            llm.sendChatMessageStream(fakeEvent, args && args.messages);
            break;
        }

        case 'chat-mood':
            // No main window in web mode; ignored
            break;

        case 'chat-set-movement':
            if (['none', 'bounce', 'follow', 'wander'].includes(args)) {
                movement.setMovementMode(args);
            }
            break;

        case 'chat-set-color':
            llm.broadcastColor(args);
            break;

        case 'chat-set-language':
            xpSystem.getXpData().savedLang = args;
            xpSystem.saveXpData();
            wsBroadcast('set-language', args);
            break;

        case 'chat-set-sleep':
            if (args) sleepWork.startSleepMode();
            else sleepWork.stopSleepMode();
            break;

        case 'chat-set-vibe':
            sleepWork.setIsVibing(args);
            break;

        case 'chat-set-mute':
            // No main window; ignored
            break;

        case 'chat-set-zoom':
            // No window state persistence needed in web mode
            break;

        case 'save-chat-message': {
            const { role, content, metrics } = args || {};
            const entry = { role, content, timestamp: Date.now() };
            if (metrics) entry.metrics = metrics;
            chatHistory().push(entry);
            if (metrics && metrics.totalTime) {
                const times = responseTimes();
                times.push(parseFloat(metrics.totalTime));
                if (times.length > 40) times.shift();
            }
            saveChatData();
            break;
        }

        case 'sound-played':
        case 'close-chat':
        case 'open-settings':
            // These are Electron-only; ignored in web mode
            break;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Push server-side events to all connected web clients
// ═══════════════════════════════════════════════════════════════════════════

function startPushEvents() {
    const { xpSystem, petNeeds, pomodoro, sleepWork, llm, networkDiscovery, addActivityLogEntry } = _deps;

    // Subscribe to the central broadcast channel so every event the Electron
    // windows would receive is also forwarded to web clients. This is the
    // primary path for real-time XP, needs, pomodoro, sprite, mood, etc.
    // Stored on _deps so stop() can unsubscribe.
    const broadcast = require('./broadcast');
    _broadcastUnsubscribe = broadcast.subscribe((eventName, data) => {
        wsBroadcast(eventName, data);
    });

    // Periodic state push as a safety net for clients that connect mid-session
    // or miss an update due to a transient WebSocket reconnect. Lower frequency
    // than before since broadcasts now happen in real time.
    pushInterval = setInterval(() => {
        if (wsClients.size === 0) return;

        const xpStatus = xpSystem.getXpStatus();
        const pState = pomodoro.getState();
        xpStatus.pomodoro = {
            active: pState.active,
            mode: pState.mode,
            remaining: pState.active ? Math.max(0, pState.duration - (Date.now() - pState.startTime)) : 0,
            pomosCompleted: pState.pomosCompleted,
        };
        wsBroadcast('xp-update', xpStatus);
        wsBroadcast('needs-update', petNeeds.getNeeds());
        wsBroadcast('pomodoro-update', xpStatus.pomodoro);
    }, 5000);

    // WebSocket keep-alive ping every 30s
    setInterval(() => {
        for (const client of wsClients) {
            if (!client.alive) {
                wsClients.delete(client);
                client.socket.destroy();
                continue;
            }
            client.alive = false;
            try { sendFrame(client.socket, Buffer.alloc(0), 0x9); } catch (e) { wsClients.delete(client); }
        }
    }, 30000);
}

// ═══════════════════════════════════════════════════════════════════════════
// Start / Stop
// ═══════════════════════════════════════════════════════════════════════════

function start(port = 7777) {
    httpServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // ── HTTP API fallback (when WebSocket is unavailable) ────────────

        // POST /api/invoke — generic invoke handler
        if (pathname === '/api/invoke' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const { channel, args } = JSON.parse(body);
                    const result = await handleInvoke(channel, args);
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify(result));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // POST /api/send — fire-and-forget handler
        if (pathname === '/api/send' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { channel, args } = JSON.parse(body);
                    // Use a virtual client that discards WS sends
                    handleSend({ socket: null }, channel, args);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // POST /api/chat-stream — SSE streaming for chat messages
        if (pathname === '/api/chat-stream' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { messages } = JSON.parse(body);
                    const { llm, sleepWork } = _deps;
                    if (sleepWork.getIsSleeping()) sleepWork.stopSleepMode();

                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                    });

                    const fakeEvent = {
                        reply: (eventName, data) => {
                            if (res.writableEnded) return;
                            res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
                            // Close the stream when chat is done
                            if (eventName === 'chat-stream-chunk' && data && data.done) {
                                res.end();
                            }
                        }
                    };
                    llm.sendChatMessageStream(fakeEvent, messages);

                    req.on('close', () => { /* client disconnected */ });
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // CORS preflight for API endpoints
        if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
        }

        // Root or /chat → serve chat.html with bridge injected
        if (pathname === '/' || pathname === '/chat' || pathname === '/chat.html') {
            serveChatHtml(res);
            return;
        }

        // Settings page
        if (pathname === '/settings') {
            serveSettingsHtml(res);
            return;
        }

        // Debug page — diagnose WebSocket + module loading issues
        if (pathname === '/debug') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
            res.end(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#111;color:#0f0;font:14px monospace;padding:12px}h2{color:#0ff;margin:8px 0}.ok{color:#0f0}.err{color:#f33}.warn{color:#ff0}pre{white-space:pre-wrap;word-break:break-all}</style>
</head><body><h2>RADGOTCHI WEB DEBUG</h2><div id="log"></div>
<script>
const log = document.getElementById('log');
function add(cls, msg) { const d = document.createElement('div'); d.className = cls; d.textContent = msg; log.appendChild(d); }
add('ok', '1. Page loaded');
add('ok', '2. Bridge exists: ' + (typeof window.electronAPI !== 'undefined'));

// Test WebSocket directly
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = proto + '//' + location.host + '/ws';
add('ok', '3. Connecting to: ' + wsUrl);
let gotOpen = false, gotReady = false, gotProfiles = false, msgCount = 0;
try {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => { gotOpen = true; add('ok', '4. WebSocket OPEN');
        // Send profiles invoke
        ws.send(JSON.stringify({ type: 'invoke', id: 1, channel: 'get-llm-profiles', args: null }));
        add('ok', '5. Sent get-llm-profiles invoke');
    };
    ws.onmessage = (evt) => { msgCount++;
        try { const m = JSON.parse(evt.data);
            if (m.type === 'event' && m.event === 'chat-ready') { gotReady = true;
                add('ok', '6. GOT chat-ready: configured=' + m.data.configured + ' xp.level=' + (m.data.xp&&m.data.xp.level) + ' pfp=' + !!(m.data.operatorPfp&&m.data.operatorPfp.imageUrl));
            }
            if (m.type === 'response' && m.id === 1) { gotProfiles = true;
                const p = m.data.profiles || [];
                add('ok', '7. GOT profiles: count=' + p.length + ' names=[' + p.map(x=>x.name).join(',') + '] active=' + m.data.activeProfileId);
            }
        } catch(e) { add('warn', 'Parse error: ' + e.message); }
    };
    ws.onerror = (e) => { add('err', 'WebSocket ERROR'); };
    ws.onclose = (e) => { add('warn', 'WebSocket closed code=' + e.code); };
    setTimeout(() => {
        add(gotOpen ? 'ok' : 'err', '--- SUMMARY ---');
        add(gotOpen ? 'ok' : 'err', 'WS connected: ' + gotOpen);
        add(gotReady ? 'ok' : 'err', 'chat-ready received: ' + gotReady);
        add(gotProfiles ? 'ok' : 'err', 'profiles received: ' + gotProfiles);
        add('ok', 'Total messages: ' + msgCount);
    }, 3000);
} catch(e) { add('err', 'WebSocket create failed: ' + e.message); }

// Test module loading
const script = document.createElement('script');
script.type = 'module';
script.textContent = 'window.__moduleOk = true; document.getElementById("log").innerHTML += "<div class=ok>8. ES modules work</div>";';
document.head.appendChild(script);
setTimeout(() => { if (!window.__moduleOk) add('err', '8. ES modules FAILED to execute'); }, 1000);

// Test web-bridge loading
const bridgeScript = document.createElement('script');
bridgeScript.src = '/src/web/web-bridge.js?v=' + Date.now();
bridgeScript.onload = () => add('ok', '9. web-bridge.js loaded successfully');
bridgeScript.onerror = (e) => add('err', '9. web-bridge.js FAILED to load');
document.head.appendChild(bridgeScript);
</script></body></html>`);
            return;
        }

        // Web app manifest
        if (pathname === '/manifest.json') {
            serveManifest(res);
            return;
        }

        // Favicon shortcut (browsers request /favicon.ico by default)
        if (pathname === '/favicon.ico') {
            serveStatic('/assets/favicon_rg/favicon.ico', res);
            return;
        }

        // Everything else → static files
        serveStatic(pathname, res);
    });

    // WebSocket upgrade
    httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === '/ws') {
            acceptWebSocket(req, socket);
        } else {
            socket.destroy();
        }
    });

    httpServer.listen(port, '0.0.0.0', () => {
        const addresses = getLocalAddresses();
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('  RADGOTCHI WEB MODE — RAD TERMINAL');
        console.log('═══════════════════════════════════════════════════');
        console.log(`  Local:     http://localhost:${port}`);
        for (const addr of addresses) {
            console.log(`  Network:   http://${addr}:${port}`);
        }
        console.log('');
        console.log('  Open the URL above on your phone via Tailscale');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
    });

    startPushEvents();
}

function stop() {
    if (pushInterval) { clearInterval(pushInterval); pushInterval = null; }
    if (_broadcastUnsubscribe) { _broadcastUnsubscribe(); _broadcastUnsubscribe = null; }
    for (const client of wsClients) {
        try { client.socket.destroy(); } catch (e) {}
    }
    wsClients.clear();
    if (httpServer) { httpServer.close(); httpServer = null; }
}

function getLocalAddresses() {
    const interfaces = os.networkInterfaces();
    const addrs = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addrs.push(iface.address);
            }
        }
    }
    return addrs;
}

module.exports = { init, start, stop, wsBroadcast };

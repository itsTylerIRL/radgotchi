'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

// LLM Configuration
let llmConfig = {
    enabled: false,
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    apiKey: '',
    model: 'llama2',
    systemPrompt: 'You are Radgotchi, a radbro themed virtual pet assistant. Keep responses short and punchy, using tech/hacker slang. You\'re helpful but maintain a mysterious, cool demeanor. You remember your conversations and are aware of your current level, rank, and stats. Reference your progression naturally when relevant.',
    operatorName: 'OPERATOR',
    operatorPfp: {
        collection: 'radbro',
        tokenId: '',
        imageUrl: ''
    }
};

// Current pet sprite state (for chat window bro avatar)
let currentSpriteState = {
    sprite: 'AWAKE.png',
    color: '#00ff9d'
};

let settingsWindow = null;

let _persistence = null;
let _getMainWindow = null;
let _getChatWindow = null;
let _screen = null;
let _xpSystem = null;
let _getSleepWork = null;
let _getMovement = null;
let _petMemory = null;

function init({ persistence, getMainWindow, getChatWindow, screen, xpSystem, getSleepWork, getMovement, petMemory }) {
    _persistence = persistence;
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _screen = screen;
    _xpSystem = xpSystem;
    _getSleepWork = getSleepWork;
    _getMovement = getMovement;
    _petMemory = petMemory;
}

function getLlmConfig() {
    return llmConfig;
}

function getSpriteState() {
    return currentSpriteState;
}

function loadLlmConfig() {
    const saved = _persistence.loadLlmConfigFromDisk();
    if (saved) {
        llmConfig = { ...llmConfig, ...saved };
    }
}

function saveLlmConfig(config) {
    llmConfig = { ...llmConfig, ...config };
    return _persistence.saveLlmConfigToDisk(llmConfig);
}

// Build context prompt for LLM
function buildContextPrompt(messages) {
    const status = _xpSystem.getXpStatus();
    const currentRank = _xpSystem.getRank(status.level);
    const nextRankIndex = _xpSystem.RANKS.findIndex(r => r.name === currentRank.name) + 1;
    const nextRank = nextRankIndex < _xpSystem.RANKS.length ? _xpSystem.RANKS[nextRankIndex] : null;

    const recentContext = messages.slice(-4).map(m =>
        `${m.role === 'user' ? 'Bro' : 'You'}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
    ).join('\n');

    const sleepWork = _getSleepWork();
    const movement = _getMovement();
    const currentState = sleepWork.getIsSleeping() ? 'SLEEP' :
                         false ? 'WORK' : // pomodoro checked via status
                         sleepWork.getIsVibing() ? 'VIBE' :
                         movement.getIsUserIdle() ? 'IDLE' : 'NORMAL';
    const movementLabel = movement.getMovementMode() === 'none' ? 'stationary' : movement.getMovementMode();
    const now = new Date();
    const dateTimeStr = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `${llmConfig.systemPrompt}

OPERATOR INFO:
- Callsign: ${llmConfig.operatorName || 'OPERATOR'}

CURRENT STATUS:
- Date/Time: ${dateTimeStr}
- State: ${currentState} | Movement: ${movementLabel}
- Level: ${status.level} | XP: ${status.totalXp} (${Math.round(status.progress * 100)}% to next level)
- Rank: ${currentRank.name}${nextRank ? ` | Next rank: ${nextRank.name} at Level ${nextRank.minLevel}` : ' (MAX RANK)'}
- Hunger: ${Math.round(status.hunger)}% | Energy: ${Math.round(status.energy)}%
- Sessions together: ${status.totalSessions} | Current streak: ${status.currentStreak} days

${_petMemory && _petMemory.buildMemoryBlock() ? _petMemory.buildMemoryBlock() + '\n\n' : ''}${recentContext ? `RECENT CONVO:\n${recentContext}` : ''}`;
}

// Non-streaming chat handler
async function sendChatMessage(messages) {
    if (!llmConfig.enabled || !llmConfig.apiUrl) {
        return { error: 'LLM not configured. Set up in tray menu → Chat Settings.' };
    }

    try {
        const https = require('https');
        const http = require('http');
        const url = new URL(llmConfig.apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const contextPrompt = buildContextPrompt(messages);
        const requestBody = JSON.stringify({
            model: llmConfig.model,
            messages: [
                { role: 'system', content: contextPrompt },
                ...messages
            ],
            max_tokens: 200,
            temperature: 0.8
        });

        const response = await new Promise((resolve, reject) => {
            const req = protocol.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    ...(llmConfig.apiKey ? { 'Authorization': `Bearer ${llmConfig.apiKey}` } : {})
                },
                timeout: 30000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Invalid JSON response')); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            req.write(requestBody);
            req.end();
        });

        if (response.error) {
            return { error: response.error.message || 'API error' };
        }
        const content = response.choices?.[0]?.message?.content || 'No response';
        if (_petMemory && content !== 'No response') {
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            if (lastUserMsg) _petMemory.afterResponse(lastUserMsg.content, content);
        }
        return { content };
    } catch (e) {
        return { error: e.message || 'Failed to connect to LLM' };
    }
}

// Streaming chat handler
function sendChatMessageStream(event, messages) {
    if (!llmConfig.enabled || !llmConfig.apiUrl) {
        event.reply('chat-stream-error', { error: 'LLM not configured. Set up in tray menu → Chat Settings.' });
        return;
    }

    try {
        const https = require('https');
        const http = require('http');
        const url = new URL(llmConfig.apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const contextPrompt = buildContextPrompt(messages);
        const requestBody = JSON.stringify({
            model: llmConfig.model,
            messages: [
                { role: 'system', content: contextPrompt },
                ...messages
            ],
            max_tokens: 200,
            temperature: 0.8,
            stream: true
        });

        const req = protocol.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                ...(llmConfig.apiKey ? { 'Authorization': `Bearer ${llmConfig.apiKey}` } : {})
            },
            timeout: 30000
        }, (res) => {
            let buffer = '';
            let fullContent = '';

            if (!res.headers['content-type']?.includes('text/event-stream') &&
                !res.headers['content-type']?.includes('application/x-ndjson')) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error) {
                            event.reply('chat-stream-error', { error: json.error.message || 'API error' });
                        } else {
                            const content = json.choices?.[0]?.message?.content || 'No response';
                            event.reply('chat-stream-chunk', { content, done: true });
                            if (_petMemory && content !== 'No response') {
                                const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                                if (lastUserMsg) _petMemory.afterResponse(lastUserMsg.content, content);
                            }
                        }
                    } catch (e) {
                        event.reply('chat-stream-error', { error: 'Invalid response from API' });
                    }
                });
                return;
            }

            res.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullContent += delta;
                                event.reply('chat-stream-chunk', { content: delta, done: false });
                            }
                        } catch (e) { /* skip malformed */ }
                    }
                }
            });

            res.on('end', () => {
                if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
                    if (buffer.trim().startsWith('data: ')) {
                        try {
                            const json = JSON.parse(buffer.trim().slice(6));
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullContent += delta;
                                event.reply('chat-stream-chunk', { content: delta, done: false });
                            }
                        } catch (e) {}
                    }
                }
                event.reply('chat-stream-chunk', { content: '', done: true, fullContent });
                if (_petMemory && fullContent) {
                    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                    if (lastUserMsg) _petMemory.afterResponse(lastUserMsg.content, fullContent);
                }
            });

            res.on('error', (e) => {
                event.reply('chat-stream-error', { error: e.message });
            });
        });

        req.on('error', (e) => {
            event.reply('chat-stream-error', { error: e.message || 'Connection failed' });
        });
        req.on('timeout', () => {
            req.destroy();
            event.reply('chat-stream-error', { error: 'Request timeout' });
        });

        req.write(requestBody);
        req.end();
    } catch (e) {
        event.reply('chat-stream-error', { error: e.message || 'Failed to connect to LLM' });
    }
}

// Settings dialog
function showChatSettingsDialog() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    const primaryDisplay = _screen.getPrimaryDisplay();
    const pb = primaryDisplay.bounds;
    const defaultBounds = {
        width: 500,
        height: 520,
        x: pb.x + Math.floor((pb.width - 500) / 2),
        y: pb.y + Math.floor((pb.height - 520) / 2)
    };
    const settingsBounds = _persistence.ensureBoundsOnDisplay(
        _persistence.getWindowState('settingsWindow', defaultBounds)
    );

    settingsWindow = new BrowserWindow({
        width: settingsBounds.width,
        height: settingsBounds.height,
        x: settingsBounds.x,
        y: settingsBounds.y,
        minWidth: 480,
        minHeight: 480,
        modal: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        frame: false,
        transparent: false,
        title: 'COMMS CONFIG',
        backgroundColor: '#0a0c0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, '..', '..', 'preload.js')
        }
    });

    settingsWindow.on('moved', () => _persistence.saveWindowState('settingsWindow', settingsWindow));
    settingsWindow.on('resized', () => _persistence.saveWindowState('settingsWindow', settingsWindow));

    const settingsHtml = buildSettingsHtml();
    settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(settingsHtml));
    settingsWindow.setMenu(null);

    settingsWindow.webContents.on('did-finish-load', () => {
        const mainWindow = _getMainWindow();
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript(`localStorage.getItem("radgotchi-color") || "#00ff9d"`)
                .then(color => {
                    if (settingsWindow && settingsWindow.webContents) {
                        syncColorToWindow(settingsWindow, color);
                    }
                })
                .catch(() => {});
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function syncColorToWindow(win, color) {
    if (!win || !win.webContents) return;
    const hex = color.replace('#', '');
    win.webContents.executeJavaScript(`
        const hex = '${hex}';
        document.documentElement.style.setProperty('--term-green', '${color}');
        const r = Math.round(parseInt(hex.substr(0,2), 16) * 0.65);
        const g = Math.round(parseInt(hex.substr(2,2), 16) * 0.65);
        const b = Math.round(parseInt(hex.substr(4,2), 16) * 0.65);
        const dim = '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
        document.documentElement.style.setProperty('--term-dim', dim);
        const br = Math.round(parseInt(hex.substr(0,2), 16) * 0.25);
        const bg = Math.round(parseInt(hex.substr(2,2), 16) * 0.25);
        const bb = Math.round(parseInt(hex.substr(4,2), 16) * 0.25);
        document.documentElement.style.setProperty('--term-border', '#' + br.toString(16).padStart(2,'0') + bg.toString(16).padStart(2,'0') + bb.toString(16).padStart(2,'0'));
    `).catch(() => {});
}

function syncColorToSettingsWindow(color) {
    if (settingsWindow) {
        syncColorToWindow(settingsWindow, color);
    }
}

function broadcastColor(color) {
    currentSpriteState.color = color;
    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-color', color);
    }
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-color', color);
    }
    syncColorToSettingsWindow(color);
}

// Color presets for tray
const colorPresets = [
    { label: 'Rad Red', color: '#ff3344' },
    { label: 'Cyber Cyan', color: '#00ffff' },
    { label: 'Neon Green', color: '#39ff14' },
    { label: 'Electric Purple', color: '#bf00ff' },
    { label: 'Hot Pink', color: '#ff1493' },
    { label: 'Solar Orange', color: '#ff6600' },
    { label: 'Golden Yellow', color: '#ffd700' },
    { label: 'Ice Blue', color: '#00bfff' },
    { label: 'Lime', color: '#00ff00' },
    { label: 'White', color: '#ffffff' }
];

function buildSettingsHtml() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://radbro.xyz https://schizoposters.xyz; img-src 'self' blob: data: https: http:;">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        :root { --term-green: #00ff88; --term-cyan: #00d4ff; --term-amber: #ffaa00; --term-red: #ff3344; --term-dim: #446655; --term-bg: #0a0c0a; --term-panel: #0d1117; --term-border: #1a3a2a; --term-grid: rgba(0, 255, 136, 0.03); --font-mono: 'Share Tech Mono', 'Consolas', 'Courier New', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: var(--term-bg); font-family: var(--font-mono); color: var(--term-green); font-size: 12px; }
        body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px); pointer-events: none; z-index: 1000; }
        body::after { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-image: linear-gradient(var(--term-grid) 1px, transparent 1px), linear-gradient(90deg, var(--term-grid) 1px, transparent 1px); background-size: 20px 20px; pointer-events: none; z-index: -1; }
        .terminal-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; border: 1px solid var(--term-green); }
        .terminal-container::before, .terminal-container::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: var(--term-green); border-style: solid; z-index: 10; }
        .terminal-container::before { top: 4px; left: 4px; border-width: 2px 0 0 2px; }
        .terminal-container::after { bottom: 4px; right: 4px; border-width: 0 2px 2px 0; }
        .terminal-header { display: flex; flex-shrink: 0; justify-content: space-between; align-items: center; padding: 6px 12px; background: linear-gradient(180deg, #0f120f 0%, #080a08 100%); border-bottom: 1px solid var(--term-green); -webkit-app-region: drag; cursor: grab; }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .classification { font-size: 8px; font-weight: 700; letter-spacing: 2px; color: var(--term-red); background: rgba(255,51,68,0.15); padding: 2px 6px; border: 1px solid var(--term-red); }
        .terminal-title { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: var(--term-green); text-shadow: 0 0 8px var(--term-green); }
        .header-right { display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag; }
        .status-indicator { display: flex; align-items: center; gap: 4px; font-size: 8px; color: var(--term-dim); letter-spacing: 1px; }
        .close-btn { background: transparent; border: 1px solid var(--term-dim); color: var(--term-dim); font-size: 12px; width: 18px; height: 18px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { border-color: var(--term-red); color: var(--term-red); box-shadow: 0 0 8px rgba(255,51,68,0.5); }
        .content-area { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px; }
        .field { margin-bottom: 12px; }
        label { display: block; margin-bottom: 4px; color: var(--term-dim); font-size: 9px; text-transform: uppercase; letter-spacing: 2px; }
        label::before { content: '█ '; color: var(--term-green); }
        input[type="text"], input[type="password"], textarea { width: 100%; padding: 8px 10px; background: var(--term-panel); border: 1px solid var(--term-border); color: var(--term-green); font-family: inherit; font-size: 11px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        input:focus, textarea:focus { border-color: var(--term-green); box-shadow: 0 0 10px rgba(0,255,136,0.2); }
        input::placeholder, textarea::placeholder { color: #335544; }
        textarea { resize: vertical; min-height: 60px; }
        .checkbox-field { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--term-panel); border: 1px solid var(--term-border); }
        .checkbox-field input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--term-green); cursor: pointer; }
        .checkbox-field label { margin: 0; font-size: 10px; color: var(--term-green); }
        .checkbox-field label::before { content: ''; }
        .hint { font-size: 8px; color: #335544; margin-top: 4px; letter-spacing: 1px; }
        .hint::before { content: '// '; color: var(--term-dim); }
        .button-row { display: flex; gap: 10px; padding: 10px 12px; background: linear-gradient(180deg, #080a08 0%, #0f120f 100%); border-top: 1px solid var(--term-green); }
        button { flex: 1; padding: 10px; border: 1px solid var(--term-border); background: var(--term-panel); color: var(--term-dim); cursor: pointer; font-family: inherit; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; transition: all 0.2s; }
        button:hover { border-color: var(--term-green); color: var(--term-green); box-shadow: 0 0 10px rgba(0,255,136,0.2); }
        .btn-save { background: rgba(0,255,136,0.1); border-color: var(--term-green); color: var(--term-green); }
        .btn-save:hover { background: rgba(0,255,136,0.2); box-shadow: 0 0 15px rgba(0,255,136,0.3); }
        .btn-cancel:hover { border-color: var(--term-red); color: var(--term-red); }
        .section-header { font-size: 9px; color: var(--term-cyan); letter-spacing: 2px; text-transform: uppercase; margin: 16px 0 10px 0; padding-bottom: 4px; border-bottom: 1px dashed var(--term-border); }
        .section-header:first-of-type { margin-top: 8px; }
        .section-header::before { content: '◆ '; }
        .identity-row { display: flex; gap: 16px; align-items: flex-start; }
        .identity-left { flex: 1; }
        .identity-right { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .pfp-preview-large { width: 64px; height: 64px; border: 2px solid var(--term-cyan); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; box-shadow: 0 0 12px color-mix(in srgb, var(--term-cyan) 30%, transparent); }
        .pfp-preview-large img { width: 100%; height: 100%; object-fit: cover; }
        .pfp-controls { display: flex; align-items: center; gap: 6px; }
        .pfp-controls select, .pfp-controls input { padding: 4px 6px; font-size: 8px; background: var(--term-bg); border: 1px solid var(--term-border); color: var(--term-green); }
        .pfp-controls input { width: 50px; }
        .pfp-controls select:focus, .pfp-controls input:focus { border-color: var(--term-green); outline: none; }
        .pfp-fetch-btn { padding: 5px 10px; background: var(--term-panel); border: 1px solid var(--term-dim); color: var(--term-dim); font-family: inherit; font-size: 8px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .pfp-fetch-btn:hover { border-color: var(--term-green); color: var(--term-green); box-shadow: 0 0 8px color-mix(in srgb, var(--term-green) 30%, transparent); }
        .pfp-preview-placeholder { font-size: 9px; color: var(--term-dim); text-align: center; }
        .pfp-status-inline { font-size: 7px; color: var(--term-dim); white-space: nowrap; }
        .pfp-status-inline.success { color: var(--term-green); }
        .pfp-status-inline.error { color: var(--term-red); }
        .pfp-status-inline.loading { color: var(--term-dim); }
    </style>
</head>
<body>
    <div class="terminal-container">
        <div class="terminal-header">
            <div class="header-left">
                <span class="classification">RB//WR</span>
                <span class="terminal-title">COMMS CONFIG</span>
            </div>
            <div class="header-right">
                <span class="status-indicator">█ ENCRYPTED</span>
                <button class="close-btn" onclick="window.close()">×</button>
            </div>
        </div>
        <div class="content-area">
            <div class="field checkbox-field">
                <input type="checkbox" id="enabled">
                <label for="enabled">ENABLE COMMS LINK (REQUIRES LOCAL LLM)</label>
            </div>
            <div class="section-header">OPERATOR IDENTITY</div>
            <div class="identity-row">
                <div class="identity-left">
                    <div class="field">
                        <label>CALLSIGN</label>
                        <input type="text" id="operatorName" placeholder="OPERATOR">
                    </div>
                    <div class="pfp-controls" style="margin-top: 8px;">
                        <select id="operatorCollection">
                            <option value="radbro">RADBRO</option>
                            <option value="schizo">SCHIZO</option>
                        </select>
                        <input type="text" id="operatorTokenId" placeholder="#">
                        <button type="button" class="pfp-fetch-btn" onclick="fetchPfp()">FETCH</button>
                        <span class="pfp-status-inline" id="operatorStatus"></span>
                    </div>
                </div>
                <div class="identity-right">
                    <div class="pfp-preview-large" id="operatorPfpPreview">
                        <span class="pfp-preview-placeholder">?</span>
                    </div>
                </div>
            </div>
            <div class="section-header">CONNECTION</div>
            <div class="field">
                <label>ENDPOINT URL</label>
                <input type="text" id="apiUrl" placeholder="http://localhost:11434/v1/chat/completions">
                <div class="hint">OpenAI-compatible endpoint (Ollama, LM Studio, LocalAI)</div>
            </div>
            <div class="field">
                <label>API KEY</label>
                <input type="password" id="apiKey" placeholder="Leave empty if not required">
            </div>
            <div class="field">
                <label>MODEL DESIGNATION</label>
                <input type="text" id="model" placeholder="llama2">
            </div>
            <div class="section-header">PERSONALITY</div>
            <div class="field">
                <label>SYSTEM DIRECTIVE</label>
                <textarea id="systemPrompt" rows="3"></textarea>
            </div>
            <div class="section-header">MEMORY</div>
            <div class="field checkbox-field">
                <input type="checkbox" id="memoryEnabled">
                <label for="memoryEnabled">ENABLE LONG-TERM MEMORY</label>
            </div>
            <div class="hint" style="margin-bottom:8px;">Remembers facts about you across sessions (<span id="memoryCount">0</span> stored)</div>
            <button type="button" class="btn-clear-memory" onclick="clearMemory()" style="flex:none;width:auto;padding:6px 14px;font-size:9px;border-color:var(--term-red);color:var(--term-red);">WIPE MEMORY</button>
        </div>
        <div class="button-row">
            <button class="btn-cancel" onclick="window.close()">ABORT</button>
            <button class="btn-save" onclick="saveSettings()">COMMIT</button>
        </div>
    </div>
    <script>
        document.addEventListener('contextmenu', (e) => { e.preventDefault(); window.close(); });
        let operatorPfpData = { collection: 'radbro', tokenId: '', imageUrl: '' };
        const API_URLS = { radbro: 'https://radbro.xyz/api/tokens/metadata/', schizo: 'https://schizoposters.xyz/api/tokens/metadata/' };
        function normalizeIpfsUrl(url) {
            const subdomainMatch = url.match(/https?:\\/\\/([a-zA-Z0-9]+)\\.ipfs\\.[^/]+(\\/.*)?$/);
            if (subdomainMatch) { return 'https://' + subdomainMatch[1] + '.ipfs.dweb.link' + (subdomainMatch[2] || ''); }
            const pathMatch = url.match(/https?:\\/\\/[^/]+\\/ipfs\\/([a-zA-Z0-9]+)(\\/.*)?$/);
            if (pathMatch) { return 'https://' + pathMatch[1] + '.ipfs.dweb.link' + (pathMatch[2] || ''); }
            return url;
        }
        async function fetchPfp() {
            const collection = document.getElementById('operatorCollection').value;
            const tokenId = document.getElementById('operatorTokenId').value.trim();
            const statusEl = document.getElementById('operatorStatus');
            const previewEl = document.getElementById('operatorPfpPreview');
            if (!tokenId) { statusEl.textContent = 'Enter ID'; statusEl.className = 'pfp-status-inline error'; return; }
            statusEl.textContent = 'Fetching...'; statusEl.className = 'pfp-status-inline loading';
            try {
                const apiUrl = API_URLS[collection] + tokenId;
                const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
                if (!response.ok) throw new Error('Token not found (' + response.status + ')');
                const data = await response.json();
                let imageUrl = data.image;
                if (!imageUrl) throw new Error('No image in metadata');
                imageUrl = normalizeIpfsUrl(imageUrl);
                statusEl.textContent = 'Loading image...';
                previewEl.innerHTML = '<img src="' + imageUrl + '" alt="PFP" onerror="this.parentElement.innerHTML=\\'<span class=pfp-preview-placeholder>LOAD ERR</span>\\'">';
                operatorPfpData = { collection, tokenId, imageUrl };
                statusEl.textContent = 'Loaded: #' + tokenId; statusEl.className = 'pfp-status-inline success';
            } catch (err) {
                statusEl.textContent = err.message || 'Failed to fetch'; statusEl.className = 'pfp-status-inline error';
                previewEl.innerHTML = '<span class="pfp-preview-placeholder">ERROR</span>';
            }
        }
        async function loadSettings() {
            const config = await window.electronAPI.getLlmConfig();
            document.getElementById('enabled').checked = config.enabled;
            document.getElementById('apiUrl').value = config.apiUrl || '';
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('model').value = config.model || '';
            document.getElementById('systemPrompt').value = config.systemPrompt || '';
            document.getElementById('operatorName').value = config.operatorName || 'OPERATOR';
            document.getElementById('memoryEnabled').checked = config.memoryEnabled !== false;
            document.getElementById('memoryCount').textContent = config.memoryCount || 0;
            if (config.operatorPfp && config.operatorPfp.tokenId) {
                operatorPfpData = { ...operatorPfpData, ...config.operatorPfp };
                document.getElementById('operatorCollection').value = operatorPfpData.collection || 'radbro';
                document.getElementById('operatorTokenId').value = operatorPfpData.tokenId || '';
                if (operatorPfpData.imageUrl) {
                    document.getElementById('operatorPfpPreview').innerHTML = '<img src="' + operatorPfpData.imageUrl + '" alt="PFP">';
                    document.getElementById('operatorStatus').textContent = 'Loaded: #' + operatorPfpData.tokenId;
                    document.getElementById('operatorStatus').className = 'pfp-status-inline success';
                }
            }
        }
        async function saveSettings() {
            const config = {
                enabled: document.getElementById('enabled').checked,
                apiUrl: document.getElementById('apiUrl').value.trim(),
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value.trim(),
                systemPrompt: document.getElementById('systemPrompt').value,
                operatorName: document.getElementById('operatorName').value.trim() || 'OPERATOR',
                memoryEnabled: document.getElementById('memoryEnabled').checked,
                operatorPfp: { collection: document.getElementById('operatorCollection').value, tokenId: document.getElementById('operatorTokenId').value.trim(), imageUrl: operatorPfpData.imageUrl || '' }
            };
            await window.electronAPI.saveLlmConfig(config);
            window.close();
        }
        async function clearMemory() {
            if (confirm('Wipe all stored memories? This cannot be undone.')) {
                await window.electronAPI.clearPetMemory();
                document.getElementById('memoryCount').textContent = '0';
            }
        }
        loadSettings();
    </script>
</body>
</html>`;
}

module.exports = {
    init,
    getLlmConfig,
    getSpriteState,
    loadLlmConfig,
    saveLlmConfig,
    sendChatMessage,
    sendChatMessageStream,
    showChatSettingsDialog,
    syncColorToSettingsWindow,
    broadcastColor,
    colorPresets,
};

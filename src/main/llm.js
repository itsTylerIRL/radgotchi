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
let _petNeeds = null;

// LLM Profiles
let llmProfiles = [];
let activeProfileId = null;

function init({ persistence, getMainWindow, getChatWindow, screen, xpSystem, getSleepWork, getMovement, petMemory, petNeeds }) {
    _persistence = persistence;
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _screen = screen;
    _xpSystem = xpSystem;
    _getSleepWork = getSleepWork;
    _getMovement = getMovement;
    _petMemory = petMemory;
    _petNeeds = petNeeds;
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
        activeProfileId = saved.activeProfileId || null;
        delete saved.activeProfileId;
        llmConfig = { ...llmConfig, ...saved };
    }
    loadProfiles();
}

function saveLlmConfig(config) {
    llmConfig = { ...llmConfig, ...config };
    return _persistence.saveLlmConfigToDisk({ ...llmConfig, activeProfileId });
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Management
// ═══════════════════════════════════════════════════════════════════════════

function generateProfileId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getProfileFields() {
    return {
        apiUrl: llmConfig.apiUrl,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        systemPrompt: llmConfig.systemPrompt,
    };
}

function loadProfiles() {
    llmProfiles = _persistence.loadLlmProfilesFromDisk();
}

function getProfiles() {
    return { profiles: llmProfiles, activeProfileId };
}

function saveProfile(name) {
    const id = generateProfileId();
    const profile = { id, name, ...getProfileFields() };
    llmProfiles.push(profile);
    activeProfileId = id;
    _persistence.saveLlmProfilesToDisk(llmProfiles);
    _persistence.saveLlmConfigToDisk({ ...llmConfig, activeProfileId });
    return { profiles: llmProfiles, activeProfileId };
}

function updateProfile(id) {
    const idx = llmProfiles.findIndex(p => p.id === id);
    if (idx === -1) return { profiles: llmProfiles, activeProfileId };
    llmProfiles[idx] = { ...llmProfiles[idx], ...getProfileFields() };
    _persistence.saveLlmProfilesToDisk(llmProfiles);
    return { profiles: llmProfiles, activeProfileId };
}

function loadProfile(id) {
    const profile = llmProfiles.find(p => p.id === id);
    if (!profile) return null;
    llmConfig = {
        ...llmConfig,
        apiUrl: profile.apiUrl,
        apiKey: profile.apiKey,
        model: profile.model,
        systemPrompt: profile.systemPrompt,
    };
    activeProfileId = id;
    _persistence.saveLlmConfigToDisk({ ...llmConfig, activeProfileId });
    return llmConfig;
}

function deleteProfile(id) {
    llmProfiles = llmProfiles.filter(p => p.id !== id);
    if (activeProfileId === id) activeProfileId = null;
    _persistence.saveLlmProfilesToDisk(llmProfiles);
    _persistence.saveLlmConfigToDisk({ ...llmConfig, activeProfileId });
    return { profiles: llmProfiles, activeProfileId };
}

function renameProfile(id, name) {
    const profile = llmProfiles.find(p => p.id === id);
    if (!profile) return { profiles: llmProfiles, activeProfileId };
    profile.name = name;
    _persistence.saveLlmProfilesToDisk(llmProfiles);
    return { profiles: llmProfiles, activeProfileId };
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
    const needs = _petNeeds ? _petNeeds.getNeeds() : { hunger: undefined, energy: undefined };
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
- Hunger: ${needs.hunger !== undefined ? Math.round(needs.hunger) : '?'}% | Energy: ${needs.energy !== undefined ? Math.round(needs.energy) : '?'}%
- Sessions together: ${status.totalSessions} | Current streak: ${status.currentStreak} days

${_petMemory && _petMemory.buildMemoryBlock() ? _petMemory.buildMemoryBlock() + '\n\n' : ''}${recentContext ? `RECENT CONVO:\n${recentContext}` : ''}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Extraction — handles standard, tool-calling, and thinking LLMs
// ═══════════════════════════════════════════════════════════════════════════

function stripThinkTags(text) {
    if (!text) return text;
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractResponseContent(json) {
    const choice = json.choices?.[0];
    if (!choice) return null;
    const msg = choice.message;
    if (!msg) return null;

    // Standard content
    if (msg.content) return stripThinkTags(msg.content);

    // Thinking / reasoning models (DeepSeek-R1, QwQ, etc.)
    if (msg.reasoning_content) return stripThinkTags(msg.reasoning_content);

    // Tool-calling response — summarize the calls as readable text
    if (msg.tool_calls && msg.tool_calls.length > 0) {
        const parts = msg.tool_calls.map(tc => {
            const fn = tc.function;
            if (!fn) return null;
            try {
                const args = JSON.parse(fn.arguments || '{}');
                const argStr = Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ');
                return `[${fn.name}(${argStr})]`;
            } catch {
                return `[${fn.name}()]`;
            }
        }).filter(Boolean);
        return parts.join(' ') || null;
    }

    // function_call (legacy OpenAI format)
    if (msg.function_call) {
        const fn = msg.function_call;
        return `[${fn.name}(${fn.arguments || ''})]`;
    }

    return null;
}

function extractStreamDelta(json) {
    const delta = json.choices?.[0]?.delta;
    if (!delta) return null;

    // Standard content delta
    if (delta.content) return delta.content;

    // Reasoning content delta (thinking models) — skip, don't show reasoning
    if (delta.reasoning_content) return null;

    // Tool call deltas — stream function name/args as they arrive
    if (delta.tool_calls) {
        const parts = delta.tool_calls.map(tc => {
            const fn = tc.function;
            if (!fn) return null;
            let text = '';
            if (fn.name) text += `[${fn.name}: `;
            if (fn.arguments) text += fn.arguments;
            return text || null;
        }).filter(Boolean);
        return parts.join('') || null;
    }

    return null;
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
        const userMessages = messages.filter(m => m.role !== 'system');
        const requestBody = JSON.stringify({
            model: llmConfig.model,
            messages: [
                { role: 'system', content: contextPrompt },
                ...userMessages
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
        const content = extractResponseContent(response) || 'No response';
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
        const userMessages = messages.filter(m => m.role !== 'system');
        const requestBody = JSON.stringify({
            model: llmConfig.model,
            messages: [
                { role: 'system', content: contextPrompt },
                ...userMessages
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
            let thinkBuffer = '';
            let insideThink = false;
            const streamStartTime = Date.now();
            let firstTokenTime = null;
            let tokenCount = 0;

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
                            const content = extractResponseContent(json) || 'No response';
                            const totalTime = ((Date.now() - streamStartTime) / 1000).toFixed(1);
                            event.reply('chat-stream-chunk', { content, done: true, metrics: { ttft: null, tokensPerSec: null, totalTime, tokenCount: 0 } });
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
                            const delta = extractStreamDelta(json);
                            if (delta) {
                                if (!firstTokenTime) firstTokenTime = Date.now();
                                tokenCount++;
                                fullContent += delta;
                                // Filter <think>...</think> blocks in real-time
                                thinkBuffer += delta;
                                while (thinkBuffer) {
                                    if (insideThink) {
                                        const closeIdx = thinkBuffer.indexOf('</think>');
                                        if (closeIdx !== -1) {
                                            thinkBuffer = thinkBuffer.slice(closeIdx + 8);
                                            insideThink = false;
                                        } else { thinkBuffer = ''; break; }
                                    } else {
                                        const openIdx = thinkBuffer.indexOf('<think>');
                                        if (openIdx !== -1) {
                                            const before = thinkBuffer.slice(0, openIdx);
                                            if (before) event.reply('chat-stream-chunk', { content: before, done: false });
                                            thinkBuffer = thinkBuffer.slice(openIdx + 7);
                                            insideThink = true;
                                        } else {
                                            // Check for partial '<think' at the end — hold it back
                                            let holdBack = 0;
                                            for (let i = 1; i < 7 && i <= thinkBuffer.length; i++) {
                                                if ('<think>'.startsWith(thinkBuffer.slice(-i))) {
                                                    holdBack = i;
                                                }
                                            }
                                            const safe = holdBack ? thinkBuffer.slice(0, -holdBack) : thinkBuffer;
                                            if (safe) event.reply('chat-stream-chunk', { content: safe, done: false });
                                            thinkBuffer = holdBack ? thinkBuffer.slice(-holdBack) : '';
                                            break;
                                        }
                                    }
                                }
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
                            const delta = extractStreamDelta(json);
                            if (delta) {
                                fullContent += delta;
                                thinkBuffer += delta;
                            }
                        } catch (e) {
                            // Incomplete SSE chunk — expected during streaming
                        }
                    }
                }
                // Flush remaining thinkBuffer (outside think blocks)
                if (thinkBuffer && !insideThink) {
                    const cleaned = stripThinkTags(thinkBuffer);
                    if (cleaned) event.reply('chat-stream-chunk', { content: cleaned, done: false });
                }
                const cleanedFull = stripThinkTags(fullContent);
                const totalTime = (Date.now() - streamStartTime) / 1000;
                const ttft = firstTokenTime ? (firstTokenTime - streamStartTime) / 1000 : null;
                const tokensPerSec = tokenCount > 0 && totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : null;
                event.reply('chat-stream-chunk', { content: '', done: true, fullContent: cleanedFull, metrics: { ttft, tokensPerSec, totalTime: totalTime.toFixed(1), tokenCount } });
                if (_petMemory && cleanedFull) {
                    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                    if (lastUserMsg) _petMemory.afterResponse(lastUserMsg.content, cleanedFull);
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
                .catch(() => {
                    // Main window may be unavailable — non-critical
                });
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
    `).catch(() => {
        // Settings window may have closed — non-critical
    });
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
        .pfp-preview-large { width: 64px; height: 64px; border: 2px solid var(--term-cyan); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; box-shadow: 0 0 12px color-mix(in srgb, var(--term-cyan) 30%, transparent); cursor: pointer; transition: border-color 0.2s; }
        .pfp-preview-large:hover { border-color: var(--term-green); box-shadow: 0 0 12px color-mix(in srgb, var(--term-green) 30%, transparent); }
        .pfp-preview-large img { width: 100%; height: 100%; object-fit: cover; }
        .pfp-preview-placeholder { font-size: 9px; color: var(--term-dim); text-align: center; }
        .pfp-upload-btn { padding: 4px 10px; background: var(--term-panel); border: 1px solid var(--term-dim); color: var(--term-dim); font-family: inherit; font-size: 7px; cursor: pointer; transition: all 0.2s; white-space: nowrap; letter-spacing: 1px; }
        .pfp-upload-btn:hover { border-color: var(--term-green); color: var(--term-green); box-shadow: 0 0 8px color-mix(in srgb, var(--term-green) 30%, transparent); }
        .pfp-clear-btn { padding: 4px 8px; background: var(--term-panel); border: 1px solid var(--term-dim); color: var(--term-dim); font-family: inherit; font-size: 7px; cursor: pointer; transition: all 0.2s; letter-spacing: 1px; }
        .pfp-clear-btn:hover { border-color: var(--term-red); color: var(--term-red); }
        .profile-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: linear-gradient(180deg, #080a08 0%, #0d100d 100%); border-bottom: 1px solid var(--term-border); }
        .profile-bar select { flex: 1; padding: 5px 8px; font-size: 9px; background: var(--term-panel); border: 1px solid var(--term-border); color: var(--term-green); font-family: inherit; letter-spacing: 1px; outline: none; cursor: pointer; }
        .profile-bar select:focus { border-color: var(--term-green); }
        .profile-btn { padding: 5px 8px; background: var(--term-panel); border: 1px solid var(--term-border); color: var(--term-dim); font-family: inherit; font-size: 8px; cursor: pointer; transition: all 0.2s; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; flex: none; }
        .profile-btn:hover { border-color: var(--term-green); color: var(--term-green); box-shadow: 0 0 8px rgba(0,255,136,0.2); }
        .profile-btn.danger:hover { border-color: var(--term-red); color: var(--term-red); box-shadow: 0 0 8px rgba(255,51,68,0.3); }
        .profile-bar label { font-size: 8px; color: var(--term-dim); letter-spacing: 1.5px; white-space: nowrap; margin: 0; }
        .profile-bar label::before { content: ''; }
        .profile-name-prompt { display: flex; align-items: center; gap: 6px; padding: 6px 0; margin-bottom: 8px; }
        .profile-name-prompt input { flex: 1; padding: 5px 8px; font-size: 9px; background: var(--term-panel); border: 1px solid var(--term-green); color: var(--term-green); font-family: inherit; letter-spacing: 1px; outline: none; box-shadow: 0 0 8px rgba(0,255,136,0.15); }
        .profile-name-prompt input::placeholder { color: #335544; }
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
                </div>
                <div class="identity-right">
                    <div class="pfp-preview-large" id="operatorPfpPreview" onclick="uploadPfp()" title="Click to upload">
                        <span class="pfp-preview-placeholder">?</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="pfp-upload-btn" onclick="uploadPfp()">UPLOAD</button>
                        <button type="button" class="pfp-clear-btn" onclick="clearPfp()">CLR</button>
                    </div>
                </div>
            </div>
            <div class="section-header">CONNECTION</div>
            <div class="profile-bar">
                <label>PROFILE</label>
                <select id="profileSelect"><option value="">&mdash; none &mdash;</option></select>
                <button type="button" class="profile-btn" onclick="newProfile()">NEW</button>
                <button type="button" class="profile-btn" onclick="overwriteProfile()">SAVE</button>
                <button type="button" class="profile-btn danger" onclick="deleteCurrentProfile()">DEL</button>
            </div>
            <div id="profileNamePrompt" class="profile-name-prompt" style="display:none;">
                <input type="text" id="profileNameInput" placeholder="Profile name..." maxlength="40">
                <button type="button" class="profile-btn" onclick="confirmNewProfile()">OK</button>
                <button type="button" class="profile-btn" onclick="cancelNewProfile()">ESC</button>
            </div>
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
        let operatorPfpImageUrl = '';
        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }
        async function uploadPfp() {
            const result = await window.electronAPI.uploadPfp();
            if (result && result.imageUrl) {
                operatorPfpImageUrl = result.imageUrl;
                const previewEl = document.getElementById('operatorPfpPreview');
                previewEl.innerHTML = '';
                const pfpImg = document.createElement('img');
                pfpImg.src = operatorPfpImageUrl;
                pfpImg.alt = 'PFP';
                previewEl.appendChild(pfpImg);
            }
        }
        function clearPfp() {
            operatorPfpImageUrl = '';
            document.getElementById('operatorPfpPreview').innerHTML = '<span class="pfp-preview-placeholder">?</span>';
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
            if (config.operatorPfp && config.operatorPfp.imageUrl) {
                operatorPfpImageUrl = config.operatorPfp.imageUrl;
                const prevEl = document.getElementById('operatorPfpPreview');
                prevEl.innerHTML = '';
                const pfpImg = document.createElement('img');
                pfpImg.src = operatorPfpImageUrl;
                pfpImg.alt = 'PFP';
                prevEl.appendChild(pfpImg);
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
                operatorPfp: { imageUrl: operatorPfpImageUrl }
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

        // ── Profile Management ──
        const profileSelect = document.getElementById('profileSelect');
        let profilesData = [];
        let currentActiveId = null;

        async function loadProfileList() {
            const { profiles, activeProfileId } = await window.electronAPI.getLlmProfiles();
            profilesData = profiles || [];
            currentActiveId = activeProfileId || null;
            renderProfileDropdown();
        }

        function renderProfileDropdown() {
            profileSelect.innerHTML = '<option value="">&mdash; none &mdash;</option>';
            profilesData.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                profileSelect.appendChild(opt);
            });
            profileSelect.value = currentActiveId || '';
        }

        profileSelect.addEventListener('change', async () => {
            const id = profileSelect.value;
            if (!id) return;
            const config = await window.electronAPI.loadLlmProfile(id);
            if (config) {
                document.getElementById('apiUrl').value = config.apiUrl || '';
                document.getElementById('apiKey').value = config.apiKey || '';
                document.getElementById('model').value = config.model || '';
                document.getElementById('systemPrompt').value = config.systemPrompt || '';
            }
            currentActiveId = id;
        });

        async function newProfile() {
            document.getElementById('profileNamePrompt').style.display = 'flex';
            const inp = document.getElementById('profileNameInput');
            inp.value = '';
            inp.focus();
        }

        async function confirmNewProfile() {
            const name = document.getElementById('profileNameInput').value.trim();
            if (!name) return;
            document.getElementById('profileNamePrompt').style.display = 'none';
            await saveFieldsToConfig();
            const result = await window.electronAPI.saveLlmProfile(name);
            profilesData = result.profiles;
            currentActiveId = result.activeProfileId;
            renderProfileDropdown();
        }

        function cancelNewProfile() {
            document.getElementById('profileNamePrompt').style.display = 'none';
        }

        document.getElementById('profileNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmNewProfile();
            if (e.key === 'Escape') cancelNewProfile();
        });

        async function overwriteProfile() {
            const id = profileSelect.value;
            if (!id) { newProfile(); return; }
            const profile = profilesData.find(p => p.id === id);
            if (!confirm('Overwrite "' + (profile ? profile.name : 'profile') + '" with current settings?')) return;
            await saveFieldsToConfig();
            const result = await window.electronAPI.updateLlmProfile(id);
            profilesData = result.profiles;
            currentActiveId = result.activeProfileId;
            renderProfileDropdown();
        }

        async function deleteCurrentProfile() {
            const id = profileSelect.value;
            if (!id) return;
            const profile = profilesData.find(p => p.id === id);
            if (!confirm('Delete profile "' + (profile ? profile.name : '') + '"?')) return;
            const result = await window.electronAPI.deleteLlmProfile(id);
            profilesData = result.profiles;
            currentActiveId = result.activeProfileId;
            renderProfileDropdown();
        }

        async function saveFieldsToConfig() {
            const config = {
                apiUrl: document.getElementById('apiUrl').value.trim(),
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value.trim(),
                systemPrompt: document.getElementById('systemPrompt').value,
            };
            await window.electronAPI.saveLlmConfig(config);
        }

        loadSettings();
        loadProfileList();
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
    // Profiles
    getProfiles,
    saveProfile,
    updateProfile,
    loadProfile,
    deleteProfile,
    renameProfile,
};

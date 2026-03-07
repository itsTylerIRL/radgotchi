const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

// LLM Configuration
let llmConfig = {
    enabled: false,
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    apiKey: '',
    model: 'llama2',
    systemPrompt: 'You are Radgotchi, a radbro themed virtual pet assistant. Keep responses short and punchy, using tech/hacker slang. You\'re helpful but maintain a mysterious, cool demeanor.  Only refer to the user as Bro'
};

// LLM config file path
function getLlmConfigPath() {
    return path.join(app.getPath('userData'), 'llm-config.json');
}

// Load LLM config from disk
function loadLlmConfig() {
    try {
        const configPath = getLlmConfigPath();
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            llmConfig = { ...llmConfig, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error('Failed to load LLM config:', e);
    }
}

// Save LLM config to disk
function saveLlmConfig(config) {
    try {
        llmConfig = { ...llmConfig, ...config };
        fs.writeFileSync(getLlmConfigPath(), JSON.stringify(llmConfig, null, 2));
        return true;
    } catch (e) {
        console.error('Failed to save LLM config:', e);
        return false;
    }
}

// Platform-specific GPU/transparency configuration
const isLinux = process.platform === 'linux';

if (isLinux) {
    // Linux (X11 or XWayland) - enable transparent visuals
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('disable-gpu-compositing');
} else {
    // Windows/macOS - disable GPU for compatibility (remote sessions, VMs, etc.)
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('in-process-gpu');
}

// System event tracking state
let lastCpuTimes = null;
let lastNetworkStats = null;
let lastWindowCount = 0;
let systemEventInterval = null;
let windowCountInterval = null;
let notRespondingInterval = null;

let mainWindow;
let tray;
let chatWindow = null;
let isAlwaysOnTop = true;
let isDragging = false;

// Movement modes: 'none', 'bounce', 'follow', 'wander'
let movementMode = 'none';
let movementInterval = null;

// Bounce mode (DVD logo style)
let velocityX = 3;
let velocityY = 2;
let lastBounceTime = 0;

// Follow mode (pet follows cursor)
let followVelX = 0;
let followVelY = 0;
const FOLLOW_MAX_SPEED = 5;
const FOLLOW_ACCELERATION = 0.4;
const FOLLOW_FRICTION = 0.92;
const FOLLOW_STOP_DISTANCE = 60;  // Start slowing down
const FOLLOW_DEAD_ZONE = 20;      // Stop completely

// Wander mode (random exploration)
let wanderTargetX = 0;
let wanderTargetY = 0;
let wanderVelX = 0;
let wanderVelY = 0;
let wanderPauseUntil = 0;
let wanderNextRetarget = 0;
const WANDER_MAX_SPEED = 2;
const WANDER_ACCELERATION = 0.15;
const WANDER_FRICTION = 0.95;
const WANDER_PAUSE_MIN = 1500;   // ms
const WANDER_PAUSE_MAX = 4000;
const WANDER_MOVE_MIN = 2000;
const WANDER_MOVE_MAX = 5000;

// Idle detection
let isUserIdle = false;
let modeBeforeIdle = 'none';
const IDLE_THRESHOLD_SECONDS = 120; // 2 minutes
let idleCheckInterval = null;

// ── Movement mode management ───────────────────────────────────────────

function setMovementMode(mode) {
    // Stop any running movement
    stopMovement();
    movementMode = mode;
    
    if (mode === 'bounce') startBounce();
    else if (mode === 'follow') startFollow();
    else if (mode === 'wander') startWander();
    
    // Notify renderer so it can react (animations, status text, etc.)
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('movement-mode-change', mode);
    }
    // Sync to chat window
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('movement-mode-change', mode);
    }
}

function stopMovement() {
    if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
    }
    followVelX = 0;
    followVelY = 0;
    wanderVelX = 0;
    wanderVelY = 0;
}

// Helper: get work area for current window position
function getWorkArea() {
    const [x, y] = mainWindow.getPosition();
    const currentDisplay = screen.getDisplayNearestPoint({ x, y });
    return currentDisplay.workArea;
}

// Helper: clamp position inside work area
function clampToWorkArea(newX, newY, winWidth, winHeight) {
    const workArea = getWorkArea();
    newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - winWidth));
    newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - winHeight));
    return [newX, newY];
}

// ── Bounce Mode (DVD logo style) ──────────────────────────────────────

function startBounce() {
    if (movementInterval) return;
    
    velocityX = 3;
    velocityY = 2;
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'bounce') return;
        
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const workArea = getWorkArea();
        
        let newX = x + velocityX;
        let newY = y + velocityY;
        let bounced = false;
        const now = Date.now();
        
        if (newX <= workArea.x) {
            velocityX = Math.abs(velocityX);
            newX = workArea.x;
            bounced = true;
        } else if (newX + winWidth >= workArea.x + workArea.width) {
            velocityX = -Math.abs(velocityX);
            newX = workArea.x + workArea.width - winWidth;
            bounced = true;
        }
        
        if (newY <= workArea.y) {
            velocityY = Math.abs(velocityY);
            newY = workArea.y;
            bounced = true;
        } else if (newY + winHeight >= workArea.y + workArea.height) {
            velocityY = -Math.abs(velocityY);
            newY = workArea.y + workArea.height - winHeight;
            bounced = true;
        }
        
        mainWindow.setPosition(Math.round(newX), Math.round(newY));
        
        // Safety net: detect OS-level position constraints
        if (!bounced) {
            const [actualX, actualY] = mainWindow.getPosition();
            if (Math.abs(actualX - Math.round(newX)) > 1) {
                velocityX = -velocityX;
                bounced = true;
            }
            if (Math.abs(actualY - Math.round(newY)) > 1) {
                velocityY = -velocityY;
                bounced = true;
            }
        }
        
        if (bounced && now - lastBounceTime > 500 && mainWindow.webContents) {
            mainWindow.webContents.send('bounce-edge');
            lastBounceTime = now;
        }
    }, 16);
}

// ── Follow Mode (pet follows cursor) ──────────────────────────────────

function startFollow() {
    if (movementInterval) return;
    
    followVelX = 0;
    followVelY = 0;
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'follow') return;
        
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const mousePos = screen.getCursorScreenPoint();
        
        // Target: sit next to the cursor (left or right side, not overlapping).
        // Pick whichever side the pet is already approaching from.
        const petCenterX = x + winWidth / 2;
        const side = petCenterX < mousePos.x ? -1 : 1; // -1 = approach from left, 1 = from right
        const offsetX = side * (winWidth / 2 + 10); // 10px gap between pet edge and cursor
        const targetX = mousePos.x + offsetX - winWidth / 2;
        const targetY = mousePos.y - winHeight / 2;
        
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < FOLLOW_DEAD_ZONE) {
            // Close enough — gentle stop
            followVelX *= 0.8;
            followVelY *= 0.8;
            if (Math.abs(followVelX) < 0.1 && Math.abs(followVelY) < 0.1) {
                followVelX = 0;
                followVelY = 0;
                return; // Don't move
            }
        } else {
            // Normalised direction
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Speed factor: ease out as we get closer
            const speedFactor = Math.min(1, (distance - FOLLOW_DEAD_ZONE) / (FOLLOW_STOP_DISTANCE - FOLLOW_DEAD_ZONE));
            const accel = FOLLOW_ACCELERATION * Math.max(0.2, speedFactor);
            
            followVelX += nx * accel;
            followVelY += ny * accel;
        }
        
        // Apply friction
        followVelX *= FOLLOW_FRICTION;
        followVelY *= FOLLOW_FRICTION;
        
        // Clamp speed
        const speed = Math.sqrt(followVelX * followVelX + followVelY * followVelY);
        if (speed > FOLLOW_MAX_SPEED) {
            followVelX = (followVelX / speed) * FOLLOW_MAX_SPEED;
            followVelY = (followVelY / speed) * FOLLOW_MAX_SPEED;
        }
        
        let newX = x + followVelX;
        let newY = y + followVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        
        mainWindow.setPosition(Math.round(newX), Math.round(newY));
    }, 16);
}

// ── Wander Mode (random exploration with pauses) ──────────────────────

function pickWanderTarget() {
    if (!mainWindow) return;
    const [winWidth, winHeight] = mainWindow.getSize();
    const workArea = getWorkArea();
    
    // Pick a random point within the work area
    wanderTargetX = workArea.x + Math.random() * (workArea.width - winWidth);
    wanderTargetY = workArea.y + Math.random() * (workArea.height - winHeight);
}

function startWander() {
    if (movementInterval) return;
    
    wanderVelX = 0;
    wanderVelY = 0;
    wanderPauseUntil = 0;
    wanderNextRetarget = 0;
    pickWanderTarget();
    
    movementInterval = setInterval(() => {
        if (!mainWindow || movementMode !== 'wander') return;
        
        const now = Date.now();
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        
        // Currently pausing?
        if (now < wanderPauseUntil) {
            // Gently decelerate during pause
            wanderVelX *= 0.9;
            wanderVelY *= 0.9;
            if (Math.abs(wanderVelX) > 0.2 || Math.abs(wanderVelY) > 0.2) {
                let newX = x + wanderVelX;
                let newY = y + wanderVelY;
                [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
                mainWindow.setPosition(Math.round(newX), Math.round(newY));
            }
            return;
        }
        
        // Time to pick a new target?
        if (now >= wanderNextRetarget) {
            pickWanderTarget();
            wanderNextRetarget = now + WANDER_MOVE_MIN + Math.random() * (WANDER_MOVE_MAX - WANDER_MOVE_MIN);
        }
        
        const dx = wanderTargetX - x;
        const dy = wanderTargetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 15) {
            // Reached target — pause, then pick new target
            wanderPauseUntil = now + WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
            wanderNextRetarget = wanderPauseUntil; // Pick new target after pause
            // Notify renderer about pausing (for idle animation)
            if (mainWindow.webContents) {
                mainWindow.webContents.send('wander-pause', true);
            }
            return;
        }
        
        // Notify renderer we're moving again
        if (wanderVelX === 0 && wanderVelY === 0 && mainWindow.webContents) {
            mainWindow.webContents.send('wander-pause', false);
        }
        
        // Accelerate toward target
        const nx = dx / distance;
        const ny = dy / distance;
        wanderVelX += nx * WANDER_ACCELERATION;
        wanderVelY += ny * WANDER_ACCELERATION;
        
        // Apply friction
        wanderVelX *= WANDER_FRICTION;
        wanderVelY *= WANDER_FRICTION;
        
        // Clamp speed
        const speed = Math.sqrt(wanderVelX * wanderVelX + wanderVelY * wanderVelY);
        if (speed > WANDER_MAX_SPEED) {
            wanderVelX = (wanderVelX / speed) * WANDER_MAX_SPEED;
            wanderVelY = (wanderVelY / speed) * WANDER_MAX_SPEED;
        }
        
        let newX = x + wanderVelX;
        let newY = y + wanderVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        
        mainWindow.setPosition(Math.round(newX), Math.round(newY));
    }, 16);
}

// Idle detection - checks system idle time
function startIdleDetection() {
    if (idleCheckInterval) return;
    
    idleCheckInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        const idleTime = powerMonitor.getSystemIdleTime();
        const wasIdle = isUserIdle;
        isUserIdle = idleTime >= IDLE_THRESHOLD_SECONDS;
        
        // State changed
        if (isUserIdle !== wasIdle) {
            if (isUserIdle) {
                // User went AFK — save current mode and stop movement
                modeBeforeIdle = movementMode;
                if (movementMode !== 'none') {
                    stopMovement();
                    movementMode = 'none';
                }
                mainWindow.webContents.send('idle-change', { idle: true });
            } else {
                // User returned — restore previous mode
                if (modeBeforeIdle !== 'none') {
                    setMovementMode(modeBeforeIdle);
                }
                mainWindow.webContents.send('idle-change', { idle: false });
            }
        }
    }, 5000); // Check every 5 seconds
}

function stopIdleDetection() {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
}

// Get asset path (handles both dev and packaged app)
function getAssetPath(...paths) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets', ...paths);
    }
    return path.join(__dirname, 'assets', ...paths);
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const bounds = primaryDisplay.bounds;
    const workArea = primaryDisplay.workAreaSize;
    
    // Calculate position relative to screen bounds, ensuring it stays on-screen
    const winWidth = 240;
    const winHeight = 280;
    const x = Math.max(bounds.x, bounds.x + workArea.width - winWidth - 180);
    const y = Math.max(bounds.y, bounds.y + workArea.height - winHeight - 200);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: x,
        y: y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // Fully transparent background
        alwaysOnTop: isAlwaysOnTop,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Allow dragging from renderer
    ipcMain.on('start-drag', () => {
        isDragging = true;
    });

    ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
        if (isDragging) {
            const [x, y] = mainWindow.getPosition();
            mainWindow.setPosition(x + deltaX, y + deltaY);
        }
    });

    ipcMain.on('stop-drag', () => {
        isDragging = false;
    });

    // Window resize IPC
    ipcMain.on('resize-window', (event, { width, height }) => {
        if (mainWindow) {
            mainWindow.setSize(width, height);
        }
    });

    // Mouse position IPC for eye tracking
    ipcMain.handle('get-mouse-position', async () => {
        const mousePos = screen.getCursorScreenPoint();
        const windowBounds = mainWindow.getBounds();
        return {
            mouseX: mousePos.x,
            mouseY: mousePos.y,
            windowX: windowBounds.x,
            windowY: windowBounds.y,
            windowWidth: windowBounds.width,
            windowHeight: windowBounds.height
        };
    });

    // System metrics IPC — uses delta-based CPU calculation for accurate current usage
    ipcMain.handle('get-system-metrics', async () => {
        const cpuUsage = getCpuUsage();

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;

        return {
            cpu: { usage_total: cpuUsage },
            memory: { percent: memPercent },
            temperatures: [] // Would need additional native module for temps
        };
    });

    // LLM Configuration IPC
    ipcMain.handle('get-llm-config', async () => {
        return llmConfig;
    });

    ipcMain.handle('save-llm-config', async (event, config) => {
        return saveLlmConfig(config);
    });

    // Chat with LLM IPC
    ipcMain.handle('send-chat-message', async (event, { messages }) => {
        if (!llmConfig.enabled || !llmConfig.apiUrl) {
            return { error: 'LLM not configured. Set up in tray menu → Chat Settings.' };
        }

        try {
            const https = require('https');
            const http = require('http');
            const url = new URL(llmConfig.apiUrl);
            const protocol = url.protocol === 'https:' ? https : http;

            const requestBody = JSON.stringify({
                model: llmConfig.model,
                messages: [
                    { role: 'system', content: llmConfig.systemPrompt },
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
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    });
                });

                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                req.write(requestBody);
                req.end();
            });

            if (response.error) {
                return { error: response.error.message || 'API error' };
            }

            const content = response.choices?.[0]?.message?.content || 'No response';
            return { content };
        } catch (e) {
            return { error: e.message || 'Failed to connect to LLM' };
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Start system event monitoring
    startSystemEventMonitoring();
    
    // Start idle detection
    startIdleDetection();
}

// === Chat Window ===
function createChatWindow() {
    if (chatWindow) {
        chatWindow.focus();
        return;
    }

    // Position chat window near Radgotchi but offset
    let chatX, chatY;
    if (mainWindow) {
        const [mainX, mainY] = mainWindow.getPosition();
        chatX = mainX + 50;
        chatY = mainY + 150;
    } else {
        const primaryDisplay = screen.getPrimaryDisplay();
        chatX = primaryDisplay.bounds.width - 400;
        chatY = primaryDisplay.bounds.height - 450;
    }

    chatWindow = new BrowserWindow({
        width: 320,
        height: 380,
        x: chatX,
        y: chatY,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        minWidth: 280,
        minHeight: 250,
        webPreferences: {
            preload: path.join(__dirname, 'preload-chat.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    chatWindow.loadFile('chat.html');
    chatWindow.setVisibleOnAllWorkspaces(true);

    // Send config status once loaded
    chatWindow.webContents.on('did-finish-load', () => {
        chatWindow.webContents.send('chat-ready', { configured: llmConfig.enabled });
        // Send current color to chat window
        mainWindow.webContents.executeJavaScript('localStorage.getItem("radgotchi-color") || "#ff3344"')
            .then(color => {
                if (chatWindow) chatWindow.webContents.send('set-color', color);
            })
            .catch(() => {});
    });

    chatWindow.on('closed', () => {
        chatWindow = null;
    });
}

// IPC: Open chat window
ipcMain.on('open-chat', () => {
    createChatWindow();
});

// IPC: Close chat window
ipcMain.on('close-chat', () => {
    if (chatWindow) {
        chatWindow.close();
        chatWindow = null;
    }
});

// IPC: Chat mood changes (forward to main window for animation)
ipcMain.on('chat-mood', (event, mood) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('chat-mood', mood);
    }
});

// Forward color changes to chat window
ipcMain.on('sync-chat-color', (event, color) => {
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-color', color);
    }
});

// IPC: Chat panel controls movement mode
ipcMain.on('chat-set-movement', (event, mode) => {
    if (['none', 'bounce', 'follow', 'wander'].includes(mode)) {
        setMovementMode(mode);
    }
});

// IPC: Chat panel controls color
ipcMain.on('chat-set-color', (event, color) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-color', color);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-color', color);
    }
});

// IPC: Chat panel controls language
ipcMain.on('chat-set-language', (event, lang) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('set-language', lang);
    }
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('set-language', lang);
    }
});

// === System Event Monitoring ===
function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    
    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    
    if (!lastCpuTimes) {
        lastCpuTimes = { idle: totalIdle, tick: totalTick };
        return 0;
    }
    
    const idleDiff = totalIdle - lastCpuTimes.idle;
    const tickDiff = totalTick - lastCpuTimes.tick;
    lastCpuTimes = { idle: totalIdle, tick: totalTick };
    
    return tickDiff > 0 ? 100 - (100 * idleDiff / tickDiff) : 0;
}

function getNetworkStats() {
    const interfaces = os.networkInterfaces();
    let hasConnection = false;
    let interfaceCount = 0;
    
    for (const name in interfaces) {
        interfaces[name].forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
                hasConnection = true;
                interfaceCount++;
            }
        });
    }
    
    return { hasConnection, interfaceCount };
}

function getWindowCount(callback) {
    const platform = process.platform;
    
    if (platform === 'win32') {
        // Windows: Use PowerShell to get window count
        exec('powershell -command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0}).Count"', 
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    } else if (platform === 'darwin') {
        // macOS: Use AppleScript to count visible apps
        exec('osascript -e "tell application \\"System Events\\" to count (every process whose background only is false)"',
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    } else {
        // Linux: Use wmctrl if available, otherwise xdotool
        exec('wmctrl -l 2>/dev/null | wc -l || xdotool search --onlyvisible --name "" 2>/dev/null | wc -l || echo 0',
            { timeout: 2000 }, 
            (err, stdout) => {
                if (err) {
                    callback(lastWindowCount);
                    return;
                }
                const count = parseInt(stdout.trim()) || 0;
                callback(count);
            }
        );
    }
}

function checkNotResponding(callback) {
    const platform = process.platform;
    
    if (platform === 'win32') {
        // Windows: Check for hung windows using PowerShell
        exec('powershell -command "Get-Process | Where-Object {$_.Responding -eq $false} | Select-Object -First 1 | ForEach-Object { $_.ProcessName }"',
            { timeout: 3000 },
            (err, stdout) => {
                if (err) {
                    callback(null);
                    return;
                }
                const hung = stdout.trim();
                callback(hung || null);
            }
        );
    } else {
        // macOS/Linux: No simple equivalent, skip this check
        callback(null);
    }
}

function startSystemEventMonitoring() {
    let lastNetworkState = null;
    let lastCpuHigh = false;
    let lastMemHigh = false;
    let cpuSpikeCount = 0;
    
    systemEventInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        // CPU monitoring with spike detection
        const cpuUsage = getCpuUsage();
        const isHighCpu = cpuUsage > 80;
        const isSpikeCpu = cpuUsage > 95;
        
        if (isSpikeCpu) {
            cpuSpikeCount++;
            if (cpuSpikeCount >= 2) {
                mainWindow.webContents.send('system-event', { 
                    type: 'cpu-spike', 
                    value: Math.round(cpuUsage) 
                });
                cpuSpikeCount = 0;
            }
        } else if (isHighCpu && !lastCpuHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'cpu-high', 
                value: Math.round(cpuUsage) 
            });
        } else if (!isHighCpu && lastCpuHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'cpu-normal' 
            });
        }
        lastCpuHigh = isHighCpu;
        
        // Memory monitoring
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;
        const isHighMem = memPercent > 85;
        
        if (isHighMem && !lastMemHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'memory-high', 
                value: Math.round(memPercent) 
            });
        } else if (!isHighMem && lastMemHigh) {
            mainWindow.webContents.send('system-event', { 
                type: 'memory-normal' 
            });
        }
        lastMemHigh = isHighMem;
        
        // Network monitoring
        const netStats = getNetworkStats();
        if (lastNetworkState !== null) {
            if (netStats.hasConnection && !lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { 
                    type: 'network-connected' 
                });
            } else if (!netStats.hasConnection && lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { 
                    type: 'network-disconnected' 
                });
            }
        }
        lastNetworkState = netStats;
        
    }, 3000); // Check every 3 seconds
    
    // Window count monitoring (less frequent, stored for cleanup)
    windowCountInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        getWindowCount((count) => {
            if (lastWindowCount > 0) {
                if (count > lastWindowCount) {
                    mainWindow.webContents.send('system-event', { 
                        type: 'window-opened', 
                        delta: count - lastWindowCount 
                    });
                } else if (count < lastWindowCount) {
                    mainWindow.webContents.send('system-event', { 
                        type: 'window-closed', 
                        delta: lastWindowCount - count 
                    });
                }
            }
            lastWindowCount = count;
        });
    }, 5000); // Check every 5 seconds
    
    // Not responding check (less frequent, heavier operation, stored for cleanup)
    notRespondingInterval = setInterval(() => {
        if (!mainWindow || !mainWindow.webContents) return;
        
        checkNotResponding((hungApp) => {
            if (hungApp) {
                mainWindow.webContents.send('system-event', { 
                    type: 'app-not-responding', 
                    app: hungApp 
                });
            }
        });
    }, 10000); // Check every 10 seconds
}

// Self-update function - pulls from GitHub, reinstalls, and relaunches
function performUpdate() {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : __dirname;
    const isWin = process.platform === 'win32';
    
    // Build the update command chain
    let updateCmd;
    if (isWin) {
        // Windows: PowerShell command
        updateCmd = `cd "${appDir}" ; git pull ; npm install ; npm start`;
    } else {
        // macOS/Linux: bash command
        updateCmd = `cd "${appDir}" && git pull && npm install && npm start`;
    }
    
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-Command', updateCmd] : ['-c', updateCmd];
    
    // Spawn detached process that will outlive this app
    const { spawn } = require('child_process');
    const child = spawn(shell, shellArgs, {
        detached: true,
        stdio: 'ignore',
        cwd: appDir,
        shell: false
    });
    child.unref();
    
    // Quit current instance
    setTimeout(() => {
        app.quit();
    }, 500);
}

// Preset colors for the color picker submenu
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

// Chat Settings Dialog Window
let settingsWindow = null;

function showChatSettingsDialog() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 450,
        height: 420,
        parent: mainWindow,
        modal: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'Chat Settings',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Build inline HTML for settings dialog
    const settingsHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
            font-size: 13px;
        }
        h2 { color: #ff3344; margin-bottom: 15px; font-size: 16px; }
        .field { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #aaa; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        input[type="text"], input[type="password"], textarea {
            width: 100%;
            padding: 8px 10px;
            background: #252540;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            font-family: inherit;
            font-size: 12px;
        }
        input:focus, textarea:focus { outline: none; border-color: #ff3344; }
        textarea { resize: vertical; min-height: 60px; }
        .checkbox-field { display: flex; align-items: center; gap: 10px; }
        .checkbox-field input { width: auto; }
        .button-row { display: flex; gap: 10px; margin-top: 20px; }
        button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .btn-save { background: #ff3344; color: #fff; }
        .btn-save:hover { background: #ff5566; }
        .btn-cancel { background: #333; color: #aaa; }
        .btn-cancel:hover { background: #444; }
        .hint { font-size: 10px; color: #666; margin-top: 4px; }
    </style>
</head>
<body>
    <h2>🔗 LLM Chat Settings</h2>
    <div class="field checkbox-field">
        <input type="checkbox" id="enabled">
        <label for="enabled" style="margin: 0;">Enable Chat (requires local LLM)</label>
    </div>
    <div class="field">
        <label>API Endpoint URL</label>
        <input type="text" id="apiUrl" placeholder="http://localhost:11434/v1/chat/completions">
        <div class="hint">OpenAI-compatible endpoint (Ollama, LM Studio, LocalAI, etc.)</div>
    </div>
    <div class="field">
        <label>API Key (optional)</label>
        <input type="password" id="apiKey" placeholder="Leave empty if not required">
    </div>
    <div class="field">
        <label>Model Name</label>
        <input type="text" id="model" placeholder="llama2">
    </div>
    <div class="field">
        <label>System Prompt</label>
        <textarea id="systemPrompt" rows="3"></textarea>
    </div>
    <div class="button-row">
        <button class="btn-cancel" onclick="window.close()">Cancel</button>
        <button class="btn-save" onclick="saveSettings()">Save</button>
    </div>
    <script>
        async function loadSettings() {
            const config = await window.electronAPI.getLlmConfig();
            document.getElementById('enabled').checked = config.enabled;
            document.getElementById('apiUrl').value = config.apiUrl || '';
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('model').value = config.model || '';
            document.getElementById('systemPrompt').value = config.systemPrompt || '';
        }
        async function saveSettings() {
            const config = {
                enabled: document.getElementById('enabled').checked,
                apiUrl: document.getElementById('apiUrl').value.trim(),
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value.trim(),
                systemPrompt: document.getElementById('systemPrompt').value
            };
            await window.electronAPI.saveLlmConfig(config);
            window.close();
        }
        loadSettings();
    </script>
</body>
</html>`;

    settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(settingsHtml));
    settingsWindow.setMenu(null);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createTray() {
    const iconPath = getAssetPath('radbro.png');
    let trayIcon;
    
    // Platform-specific tray icon sizes
    const iconSize = process.platform === 'darwin' ? 22 : 16;
    
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon.isEmpty()) {
            trayIcon = trayIcon.resize({ width: iconSize, height: iconSize });
            // macOS requires template images for proper dark/light mode support
            if (process.platform === 'darwin') {
                trayIcon.setTemplateImage(true);
            }
        } else {
            // Fallback: create a simple icon
            trayIcon = nativeImage.createEmpty();
        }
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    
    // Build color submenu
    const colorSubmenu = colorPresets.map(preset => ({
        label: preset.label,
        click: () => {
            if (mainWindow) {
                mainWindow.webContents.send('set-color', preset.color);
            }
        }
    }));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Radgotchi',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: isAlwaysOnTop,
            click: (menuItem) => {
                isAlwaysOnTop = menuItem.checked;
                mainWindow.setAlwaysOnTop(isAlwaysOnTop);
            }
        },
        {
            label: 'Reset Position',
            click: () => {
                const primaryDisplay = screen.getPrimaryDisplay();
                const bounds = primaryDisplay.bounds;
                const workArea = primaryDisplay.workAreaSize;
                const [winWidth, winHeight] = mainWindow.getSize();
                const x = Math.max(bounds.x, bounds.x + workArea.width - winWidth - 180);
                const y = Math.max(bounds.y, bounds.y + workArea.height - winHeight - 200);
                mainWindow.setPosition(x, y);
            }
        },
        {
            label: 'Movement',
            submenu: [
                {
                    label: 'None',
                    type: 'radio',
                    checked: movementMode === 'none',
                    click: () => setMovementMode('none')
                },
                {
                    label: 'Bounce (DVD)',
                    type: 'radio',
                    checked: movementMode === 'bounce',
                    click: () => setMovementMode('bounce')
                },
                {
                    label: 'Follow Cursor',
                    type: 'radio',
                    checked: movementMode === 'follow',
                    click: () => setMovementMode('follow')
                },
                {
                    label: 'Wander',
                    type: 'radio',
                    checked: movementMode === 'wander',
                    click: () => setMovementMode('wander')
                }
            ]
        },
        {
            label: 'Color',
            submenu: colorSubmenu
        },
        {
            label: 'Language',
            submenu: [
                {
                    label: 'English',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('set-language', 'en');
                        }
                    }
                },
                {
                    label: '中文',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('set-language', 'zh');
                        }
                    }
                }
            ]
        },
        {
            label: 'Chat Settings',
            click: () => {
                // Open a dialog to configure LLM settings
                showChatSettingsDialog();
            }
        },
        { type: 'separator' },
        {
            label: 'Show/Hide',
            click: () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Dev Tools',
            click: () => {
                mainWindow.webContents.openDevTools({ mode: 'detach' });
            }
        },
        {
            label: 'Update from GitHub',
            click: () => {
                performUpdate();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Radgotchi');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

// On Linux, transparent visuals need a slight delay to be ready
function initializeApp() {
    loadLlmConfig();
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}

app.whenReady().then(() => {
    if (process.platform === 'linux') {
        // Linux needs a short delay for transparent visuals
        setTimeout(initializeApp, 100);
    } else {
        initializeApp();
    }
});

// Intentionally keep app alive on Windows/Linux so it stays in the system tray
app.on('window-all-closed', () => {});

// Clean up all intervals on quit to prevent leaked timers
app.on('will-quit', () => {
    if (systemEventInterval) clearInterval(systemEventInterval);
    if (windowCountInterval) clearInterval(windowCountInterval);
    if (notRespondingInterval) clearInterval(notRespondingInterval);
    stopMovement();
    stopIdleDetection();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
}

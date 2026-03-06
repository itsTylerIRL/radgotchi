const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Disable GPU for compatibility (remote sessions, VMs, etc.)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// System event tracking state
let lastCpuTimes = null;
let lastNetworkStats = null;
let lastWindowCount = 0;
let systemEventInterval = null;

let mainWindow;
let tray;
let isAlwaysOnTop = true;
let isDragging = false;

// Bounce mode (DVD logo style)
let isBouncing = false;
let bounceInterval = null;
let velocityX = 3;
let velocityY = 2; // Slightly different for diagonal movement
let lastBounceTime = 0;

// Idle detection
let isUserIdle = false;
let wasBouncingBeforeIdle = false;
const IDLE_THRESHOLD_SECONDS = 120; // 2 minutes
let idleCheckInterval = null;

function startBounce() {
    if (bounceInterval) return;
    
    const primaryDisplay = screen.getPrimaryDisplay();
    // Use full screen bounds for tighter edge detection
    const screenBounds = primaryDisplay.bounds;
    const screenWidth = screenBounds.width;
    const screenHeight = screenBounds.height;
    
    // Reset velocities to ensure diagonal movement
    velocityX = 3;
    velocityY = 2;
    
    bounceInterval = setInterval(() => {
        if (!mainWindow || !isBouncing) return;
        
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        
        // Calculate margins based on transparent padding around sprite
        const hPadding = Math.round(winWidth * 0.15);
        const vPadding = Math.round(winHeight * 0.15);
        
        let newX = x + velocityX;
        let newY = y + velocityY;
        let bounced = false;
        const now = Date.now();
        
        // Bounce off left/right edges
        if (newX <= -hPadding) {
            velocityX = Math.abs(velocityX); // Force positive (go right)
            newX = -hPadding + 1;
            bounced = true;
        } else if (newX + winWidth >= screenWidth + hPadding) {
            velocityX = -Math.abs(velocityX); // Force negative (go left)
            newX = screenWidth + hPadding - winWidth - 1;
            bounced = true;
        }
        
        // Bounce off top/bottom edges
        if (newY <= -vPadding) {
            velocityY = Math.abs(velocityY); // Force positive (go down)
            newY = -vPadding + 1;
            bounced = true;
        } else if (newY + winHeight >= screenHeight + vPadding) {
            velocityY = -Math.abs(velocityY); // Force negative (go up)
            newY = screenHeight + vPadding - winHeight - 1;
            bounced = true;
        }
        
        // Only send color change if bounced and enough time passed (500ms cooldown)
        if (bounced && now - lastBounceTime > 500 && mainWindow.webContents) {
            mainWindow.webContents.send('bounce-edge');
            lastBounceTime = now;
        }
        
        mainWindow.setPosition(Math.round(newX), Math.round(newY));
    }, 16); // ~60fps
}

function stopBounce() {
    if (bounceInterval) {
        clearInterval(bounceInterval);
        bounceInterval = null;
    }
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
                // User went AFK
                wasBouncingBeforeIdle = isBouncing;
                if (isBouncing) {
                    stopBounce();
                }
                mainWindow.webContents.send('idle-change', { idle: true });
            } else {
                // User returned
                if (wasBouncingBeforeIdle) {
                    isBouncing = true;
                    startBounce();
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
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: 240,
        height: 280,
        x: width - 420,
        y: height - 480,
        frame: false,
        transparent: true,
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

    // System metrics IPC
    ipcMain.handle('get-system-metrics', async () => {
        const cpus = os.cpus();
        const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
        const totalTick = cpus.reduce((acc, cpu) => 
            acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
        const cpuUsage = 100 - (100 * totalIdle / totalTick);

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;

        return {
            cpu: { usage_total: cpuUsage },
            memory: { percent: memPercent },
            temperatures: [] // Would need additional native module for temps
        };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Start system event monitoring
    startSystemEventMonitoring();
    
    // Start idle detection
    startIdleDetection();
}

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
    // Use PowerShell to get window count
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
}

function checkNotResponding(callback) {
    // Check for hung windows using PowerShell
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
    
    // Window count monitoring (less frequent)
    setInterval(() => {
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
    
    // Not responding check (less frequent, heavier operation)
    setInterval(() => {
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

function createTray() {
    const iconPath = getAssetPath('radbro.png');
    let trayIcon;
    
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        // Resize for tray (16x16 on Windows)
        if (!trayIcon.isEmpty()) {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
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
            click: () => {
                isAlwaysOnTop = !isAlwaysOnTop;
                mainWindow.setAlwaysOnTop(isAlwaysOnTop);
            }
        },
        {
            label: 'Reset Position',
            click: () => {
                const primaryDisplay = screen.getPrimaryDisplay();
                const { width, height } = primaryDisplay.workAreaSize;
                mainWindow.setPosition(width - 400, height - 450);
            }
        },
        {
            label: 'Bounce Mode',
            type: 'checkbox',
            checked: isBouncing,
            click: (menuItem) => {
                isBouncing = menuItem.checked;
                if (isBouncing) {
                    startBounce();
                } else {
                    stopBounce();
                }
            }
        },
        {
            label: 'Color',
            submenu: colorSubmenu
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

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Keep app running in tray on Windows
    if (process.platform !== 'darwin') {
        // Don't quit, just hide
    }
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

'use strict';

const os = require('os');
const { execFile } = require('child_process');

let lastCpuTimes = null;
let lastWindowCount = 0;
let systemEventInterval = null;
let windowAndHungInterval = null;

let _getMainWindow = null;

function init({ getMainWindow }) {
    _getMainWindow = getMainWindow;
}

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

// Batched window count + hung app check (single process spawn on Windows)
function getWindowAndHungInfo(callback) {
    const platform = process.platform;

    if (platform === 'win32') {
        // Single PowerShell invocation for both checks
        const script = '$p = Get-Process; $wc = ($p | Where-Object {$_.MainWindowHandle -ne 0}).Count; $hung = ($p | Where-Object {$_.Responding -eq $false} | Select-Object -First 1).ProcessName; "$wc|$hung"';
        execFile('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', script],
            { timeout: 4000, windowsHide: true },
            (err, stdout) => {
                if (err) { callback(lastWindowCount, null); return; }
                const parts = stdout.trim().split('|');
                const count = parseInt(parts[0]) || 0;
                const hungApp = (parts[1] && parts[1].trim()) || null;
                callback(count, hungApp);
            }
        );
    } else if (platform === 'darwin') {
        execFile('osascript', ['-e', 'tell application "System Events" to count (every process whose background only is false)'],
            { timeout: 2000 },
            (err, stdout) => {
                if (err) { callback(lastWindowCount, null); return; }
                callback(parseInt(stdout.trim()) || 0, null);
            }
        );
    } else {
        execFile('sh', ['-c', 'wmctrl -l 2>/dev/null | wc -l || xdotool search --onlyvisible --name "" 2>/dev/null | wc -l || echo 0'],
            { timeout: 2000 },
            (err, stdout) => {
                if (err) { callback(lastWindowCount, null); return; }
                callback(parseInt(stdout.trim()) || 0, null);
            }
        );
    }
}

function startSystemEventMonitoring() {
    let lastNetworkState = null;
    let lastCpuHigh = false;
    let lastMemHigh = false;
    let cpuSpikeCount = 0;

    systemEventInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || !mainWindow.webContents) return;

        const cpuUsage = getCpuUsage();
        const isHighCpu = cpuUsage > 80;
        const isSpikeCpu = cpuUsage > 95;

        if (isSpikeCpu) {
            cpuSpikeCount++;
            if (cpuSpikeCount >= 2) {
                mainWindow.webContents.send('system-event', { type: 'cpu-spike', value: Math.round(cpuUsage) });
                cpuSpikeCount = 0;
            }
        } else if (isHighCpu && !lastCpuHigh) {
            mainWindow.webContents.send('system-event', { type: 'cpu-high', value: Math.round(cpuUsage) });
        } else if (!isHighCpu && lastCpuHigh) {
            mainWindow.webContents.send('system-event', { type: 'cpu-normal' });
        }
        lastCpuHigh = isHighCpu;

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = ((totalMem - freeMem) / totalMem) * 100;
        const isHighMem = memPercent > 85;

        if (isHighMem && !lastMemHigh) {
            mainWindow.webContents.send('system-event', { type: 'memory-high', value: Math.round(memPercent) });
        } else if (!isHighMem && lastMemHigh) {
            mainWindow.webContents.send('system-event', { type: 'memory-normal' });
        }
        lastMemHigh = isHighMem;

        const netStats = getNetworkStats();
        if (lastNetworkState !== null) {
            if (netStats.hasConnection && !lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { type: 'network-connected' });
            } else if (!netStats.hasConnection && lastNetworkState.hasConnection) {
                mainWindow.webContents.send('system-event', { type: 'network-disconnected' });
            }
        }
        lastNetworkState = netStats;
    }, 3000);

    // Combined window count + hung app detection (single spawn, every 10s)
    windowAndHungInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || !mainWindow.webContents) return;

        getWindowAndHungInfo((count, hungApp) => {
            if (lastWindowCount > 0) {
                if (count > lastWindowCount) {
                    mainWindow.webContents.send('system-event', { type: 'window-opened', delta: count - lastWindowCount });
                } else if (count < lastWindowCount) {
                    mainWindow.webContents.send('system-event', { type: 'window-closed', delta: lastWindowCount - count });
                }
            }
            lastWindowCount = count;

            if (hungApp) {
                mainWindow.webContents.send('system-event', { type: 'app-not-responding', app: hungApp });
            }
        });
    }, 10000);
}

function stopSystemEventMonitoring() {
    if (systemEventInterval) { clearInterval(systemEventInterval); systemEventInterval = null; }
    if (windowAndHungInterval) { clearInterval(windowAndHungInterval); windowAndHungInterval = null; }
}

module.exports = {
    init,
    getCpuUsage,
    getNetworkStats,
    startSystemEventMonitoring,
    stopSystemEventMonitoring,
};

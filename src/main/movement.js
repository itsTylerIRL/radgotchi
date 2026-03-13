'use strict';

const { powerMonitor } = require('electron');

// Movement modes: 'none', 'bounce', 'follow', 'wander'
let movementMode = 'none';
let movementInterval = null;

// Bounce mode
let velocityX = 3;
let velocityY = 2;
let lastBounceTime = 0;

// Follow mode
let followVelX = 0;
let followVelY = 0;
const FOLLOW_MAX_SPEED = 5;
const FOLLOW_ACCELERATION = 0.4;
const FOLLOW_FRICTION = 0.92;
const FOLLOW_STOP_DISTANCE = 60;
const FOLLOW_DEAD_ZONE = 20;

// Wander mode
let wanderTargetX = 0;
let wanderTargetY = 0;
let wanderVelX = 0;
let wanderVelY = 0;
let wanderPauseUntil = 0;
let wanderNextRetarget = 0;
const WANDER_MAX_SPEED = 2;
const WANDER_ACCELERATION = 0.15;
const WANDER_FRICTION = 0.95;
const WANDER_PAUSE_MIN = 1500;
const WANDER_PAUSE_MAX = 4000;
const WANDER_MOVE_MIN = 2000;
const WANDER_MOVE_MAX = 5000;

// Idle detection
let isUserIdle = false;
let modeBeforeIdle = 'none';
const IDLE_THRESHOLD_SECONDS = 120;
let idleCheckInterval = null;

let _getMainWindow = null;
let _getChatWindow = null;
let _screen = null;
let _isLinux = false;
let _startIdleDecay = null;
let _stopIdleDecay = null;
let _cancelAttentionEvent = null;

function init({ getMainWindow, getChatWindow, screen, isLinux, startIdleDecay, stopIdleDecay, cancelAttentionEvent }) {
    _getMainWindow = getMainWindow;
    _getChatWindow = getChatWindow;
    _screen = screen;
    _isLinux = isLinux;
    _startIdleDecay = startIdleDecay;
    _stopIdleDecay = stopIdleDecay;
    _cancelAttentionEvent = cancelAttentionEvent;
}

function getMovementMode() {
    return movementMode;
}

function getIsUserIdle() {
    return isUserIdle;
}

function setMovementMode(mode) {
    stopMovement();
    movementMode = mode;

    if (mode === 'bounce') startBounce();
    else if (mode === 'follow') startFollow();
    else if (mode === 'wander') startWander();

    const mainWindow = _getMainWindow();
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('movement-mode-change', mode);
    }
    const chatWindow = _getChatWindow();
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
    // Sprite position stays where it was - no reset needed
}

function getWorkArea() {
    const mainWindow = _getMainWindow();
    if (_isLinux) {
        return _screen.getPrimaryDisplay().workArea;
    }
    const [x, y] = mainWindow.getPosition();
    const currentDisplay = _screen.getDisplayNearestPoint({ x, y });
    return currentDisplay.workArea;
}

function safeSetPosition(x, y) {
    const mainWindow = _getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const roundX = Math.round(x);
    const roundY = Math.round(y);
    if (!Number.isFinite(roundX) || !Number.isFinite(roundY)) return false;

    const [winWidth, winHeight] = mainWindow.getSize();
    const b = getMovementBounds(winWidth, winHeight);
    const clampedX = Math.max(b.minX, Math.min(roundX, b.maxX));
    const clampedY = Math.max(b.minY, Math.min(roundY, b.maxY));

    try {
        mainWindow.setPosition(clampedX, clampedY);
        return true;
    } catch (e) {
        console.error('Failed to set position:', e);
        return false;
    }
}

function getMovementBounds(winWidth, winHeight) {
    const mainWindow = _getMainWindow();
    let currentDisplay;
    if (_isLinux) {
        currentDisplay = _screen.getPrimaryDisplay();
    } else {
        const [wx, wy] = mainWindow.getPosition();
        currentDisplay = _screen.getDisplayNearestPoint({ x: wx, y: wy });
    }
    const bounds = _isLinux ? currentDisplay.workArea : currentDisplay.bounds;
    const overflowX = Math.round((winWidth - winWidth * 0.55) / 2);
    const overflowTop = Math.round(winHeight * 0.05);
    const overflowBottom = Math.round(winHeight - winHeight * 0.45) - overflowTop;
    return {
        minX: bounds.x - overflowX,
        minY: bounds.y - overflowTop,
        maxX: bounds.x + bounds.width - winWidth + overflowX,
        maxY: bounds.y + bounds.height - winHeight + overflowBottom,
    };
}

function clampToWorkArea(newX, newY, winWidth, winHeight) {
    const b = getMovementBounds(winWidth, winHeight);
    newX = Math.max(b.minX, Math.min(newX, b.maxX));
    newY = Math.max(b.minY, Math.min(newY, b.maxY));
    return [newX, newY];
}

// ── Bounce Mode ──
function startBounce() {
    if (movementInterval) return;
    velocityX = 3;
    velocityY = 2;

    movementInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || movementMode !== 'bounce') return;

        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const b = getMovementBounds(winWidth, winHeight);

        let newX = x + velocityX;
        let newY = y + velocityY;
        let bounced = false;
        const now = Date.now();

        if (newX <= b.minX) { velocityX = Math.abs(velocityX); newX = b.minX; bounced = true; }
        else if (newX >= b.maxX) { velocityX = -Math.abs(velocityX); newX = b.maxX; bounced = true; }
        if (newY <= b.minY) { velocityY = Math.abs(velocityY); newY = b.minY; bounced = true; }
        else if (newY >= b.maxY) { velocityY = -Math.abs(velocityY); newY = b.maxY; bounced = true; }

        if (!safeSetPosition(newX, newY)) return;

        if (!bounced) {
            const [actualX, actualY] = mainWindow.getPosition();
            const margin = 10;
            const nearBoundsX = (Math.round(newX) <= b.minX + margin) || (Math.round(newX) >= b.maxX - margin);
            const nearBoundsY = (Math.round(newY) <= b.minY + margin) || (Math.round(newY) >= b.maxY - margin);
            if (!nearBoundsX && Math.abs(actualX - Math.round(newX)) > 1) { velocityX = -velocityX; bounced = true; }
            if (!nearBoundsY && Math.abs(actualY - Math.round(newY)) > 1) { velocityY = -velocityY; bounced = true; }
        }

        // Send movement direction to renderer for sprite offset
        sendSpritePosition();

        if (bounced && now - lastBounceTime > 500 && mainWindow.webContents) {
            mainWindow.webContents.send('bounce-edge');
            lastBounceTime = now;
        }
    }, 16);
}

// ── Follow Mode ──
function startFollow() {
    if (movementInterval) return;
    followVelX = 0;
    followVelY = 0;

    movementInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || movementMode !== 'follow') return;

        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();
        const mousePos = _screen.getCursorScreenPoint();

        const petCenterX = x + winWidth / 2;
        const side = petCenterX < mousePos.x ? -1 : 1;
        const offsetX = side * (winWidth / 2 + 10);
        const targetX = mousePos.x + offsetX - winWidth / 2;
        const targetY = mousePos.y - winHeight / 2;

        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < FOLLOW_DEAD_ZONE) {
            followVelX *= 0.8;
            followVelY *= 0.8;
            if (Math.abs(followVelX) < 0.1 && Math.abs(followVelY) < 0.1) {
                followVelX = 0;
                followVelY = 0;
                return;
            }
        } else {
            const nx = dx / distance;
            const ny = dy / distance;
            const speedFactor = Math.min(1, (distance - FOLLOW_DEAD_ZONE) / (FOLLOW_STOP_DISTANCE - FOLLOW_DEAD_ZONE));
            const accel = FOLLOW_ACCELERATION * Math.max(0.2, speedFactor);
            followVelX += nx * accel;
            followVelY += ny * accel;
        }

        followVelX *= FOLLOW_FRICTION;
        followVelY *= FOLLOW_FRICTION;

        const speed = Math.sqrt(followVelX * followVelX + followVelY * followVelY);
        if (speed > FOLLOW_MAX_SPEED) {
            followVelX = (followVelX / speed) * FOLLOW_MAX_SPEED;
            followVelY = (followVelY / speed) * FOLLOW_MAX_SPEED;
        }

        // Send movement direction to renderer for sprite offset
        sendSpritePosition();

        let newX = x + followVelX;
        let newY = y + followVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        safeSetPosition(newX, newY);
    }, 16);
}

// ── Wander Mode ──
function pickWanderTarget() {
    const mainWindow = _getMainWindow();
    if (!mainWindow) return;
    const [winWidth, winHeight] = mainWindow.getSize();
    const b = getMovementBounds(winWidth, winHeight);
    wanderTargetX = b.minX + Math.random() * (b.maxX - b.minX);
    wanderTargetY = b.minY + Math.random() * (b.maxY - b.minY);
}

function startWander() {
    if (movementInterval) return;
    wanderVelX = 0;
    wanderVelY = 0;
    wanderPauseUntil = 0;
    wanderNextRetarget = 0;
    pickWanderTarget();

    movementInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || movementMode !== 'wander') return;

        const now = Date.now();
        const [x, y] = mainWindow.getPosition();
        const [winWidth, winHeight] = mainWindow.getSize();

        if (now < wanderPauseUntil) {
            wanderVelX *= 0.9;
            wanderVelY *= 0.9;
            if (Math.abs(wanderVelX) > 0.2 || Math.abs(wanderVelY) > 0.2) {
                let newX = x + wanderVelX;
                let newY = y + wanderVelY;
                [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
                safeSetPosition(newX, newY);
            }
            return;
        }

        if (now >= wanderNextRetarget) {
            pickWanderTarget();
            wanderNextRetarget = now + WANDER_MOVE_MIN + Math.random() * (WANDER_MOVE_MAX - WANDER_MOVE_MIN);
        }

        const dx = wanderTargetX - x;
        const dy = wanderTargetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0 || !Number.isFinite(distance) || distance < 15) {
            wanderPauseUntil = now + WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
            wanderNextRetarget = wanderPauseUntil;
            if (mainWindow.webContents) {
                mainWindow.webContents.send('wander-pause', true);
            }
            return;
        }

        if (wanderVelX === 0 && wanderVelY === 0 && mainWindow.webContents) {
            mainWindow.webContents.send('wander-pause', false);
        }

        const nx = dx / distance;
        const ny = dy / distance;
        wanderVelX += nx * WANDER_ACCELERATION;
        wanderVelY += ny * WANDER_ACCELERATION;

        wanderVelX *= WANDER_FRICTION;
        wanderVelY *= WANDER_FRICTION;

        const speed = Math.sqrt(wanderVelX * wanderVelX + wanderVelY * wanderVelY);
        if (speed > WANDER_MAX_SPEED) {
            wanderVelX = (wanderVelX / speed) * WANDER_MAX_SPEED;
            wanderVelY = (wanderVelY / speed) * WANDER_MAX_SPEED;
        }

        // Send movement direction to renderer for sprite offset
        sendSpritePosition();

        let newX = x + wanderVelX;
        let newY = y + wanderVelY;
        [newX, newY] = clampToWorkArea(newX, newY, winWidth, winHeight);
        safeSetPosition(newX, newY);
    }, 16);
}

// ── Send Sprite Position to Renderer ──
// Sends window position as a ratio (0-1) within movement bounds
function sendSpritePosition() {
    const mainWindow = _getMainWindow();
    if (!mainWindow || !mainWindow.webContents) return;
    
    const [x, y] = mainWindow.getPosition();
    const [winWidth, winHeight] = mainWindow.getSize();
    const b = getMovementBounds(winWidth, winHeight);
    
    // Calculate position as ratio 0-1 within bounds
    const rangeX = b.maxX - b.minX;
    const rangeY = b.maxY - b.minY;
    
    // px/py: 0 = at minX/minY, 1 = at maxX/maxY
    const px = rangeX > 0 ? (x - b.minX) / rangeX : 0.5;
    const py = rangeY > 0 ? (y - b.minY) / rangeY : 0.5;
    
    mainWindow.webContents.send('sprite-position', { px, py });
}

// ── Idle Detection ──
function startIdleDetection() {
    if (idleCheckInterval) return;

    idleCheckInterval = setInterval(() => {
        const mainWindow = _getMainWindow();
        if (!mainWindow || !mainWindow.webContents) return;

        const idleTime = powerMonitor.getSystemIdleTime();
        const wasIdle = isUserIdle;
        isUserIdle = idleTime >= IDLE_THRESHOLD_SECONDS;

        if (isUserIdle !== wasIdle) {
            if (isUserIdle) {
                modeBeforeIdle = movementMode;
                if (movementMode !== 'none') {
                    stopMovement();
                    movementMode = 'none';
                }
                mainWindow.webContents.send('idle-change', { idle: true });
                _startIdleDecay();
                _cancelAttentionEvent();
                mainWindow.webContents.send('attention-event', { active: false, cancelled: true });
            } else {
                if (modeBeforeIdle !== 'none') {
                    setMovementMode(modeBeforeIdle);
                }
                mainWindow.webContents.send('idle-change', { idle: false });
                _stopIdleDecay();
            }
        }
    }, 5000);
}

function stopIdleDetection() {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
}

module.exports = {
    init,
    getMovementMode,
    getIsUserIdle,
    setMovementMode,
    stopMovement,
    safeSetPosition,
    getWorkArea,
    startIdleDetection,
    stopIdleDetection,
};

// Interaction — drag detection, mouse tracking / eye follow, resize

const container = document.getElementById('radgotchi-container');
const faceImg = document.getElementById('radgotchi-face');
const faceFlipWrapper = document.getElementById('face-flip-wrapper');
const colorBtn = document.getElementById('color-picker-btn');
const colorInput = document.getElementById('color-picker-input');

// === DRAG / CLICK DETECTION ===
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
const DRAG_THRESHOLD = 5;

container.addEventListener('mousedown', (e) => {
    if (e.target === colorBtn || e.target === colorInput) return;
    isDragging = false;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
    container.style.cursor = 'grabbing';
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (dragStartX === 0 && dragStartY === 0) return;
    const deltaFromStart = Math.sqrt(Math.pow(e.screenX - dragStartX, 2) + Math.pow(e.screenY - dragStartY, 2));
    if (!isDragging && deltaFromStart > DRAG_THRESHOLD) {
        isDragging = true;
        if (window.electronAPI && window.electronAPI.startDrag) window.electronAPI.startDrag();
    }
    if (isDragging && window.electronAPI && window.electronAPI.windowDrag) {
        window.electronAPI.windowDrag({ deltaX: e.screenX - lastMouseX, deltaY: e.screenY - lastMouseY });
    }
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
});

window.addEventListener('mouseup', (e) => {
    if (dragStartX === 0 && dragStartY === 0) return;
    container.style.cursor = 'grab';
    if (isDragging) {
        if (window.electronAPI && window.electronAPI.stopDrag) window.electronAPI.stopDrag();
    } else {
        if (window.electronAPI && window.electronAPI.addXp) window.electronAPI.addXp(2, 'click');
    }
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
});

// === MOUSE TRACKING / EYE FOLLOW ===
let isLookingLeft = false;
let currentLookDirection = 1;

function applyLookDirection() {
    faceFlipWrapper.style.setProperty('--flip-dir', currentLookDirection);
    if (!faceFlipWrapper.classList.contains('rg-breathing') &&
        !faceFlipWrapper.classList.contains('rg-breathing-slow')) {
        faceFlipWrapper.style.transform = `scaleX(${currentLookDirection})`;
    }
}

// Enable breathing by default
document.addEventListener('DOMContentLoaded', () => {
    faceFlipWrapper.classList.add('rg-breathing');
    faceFlipWrapper.style.setProperty('--flip-dir', 1);
});

async function updateEyeDirection() {
    if (!window.electronAPI || !window.electronAPI.getMousePosition) return;
    if (faceImg && faceImg.classList.contains('rg-audio-music')) return;
    try {
        const pos = await window.electronAPI.getMousePosition();
        const petCenterX = pos.windowX + (pos.windowWidth / 2);
        const shouldLookLeft = pos.mouseX < petCenterX;
        if (shouldLookLeft !== isLookingLeft) {
            isLookingLeft = shouldLookLeft;
            currentLookDirection = isLookingLeft ? -1 : 1;
            applyLookDirection();
        }
    } catch (e) {}
}

setInterval(updateEyeDirection, 50);
setTimeout(updateEyeDirection, 100);

// === RESIZE (Mouse Wheel) ===
let currentScale = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.1;
const BASE_WIDTH = 240;
const BASE_HEIGHT = 280;

function applyScale(scale) {
    currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    faceImg.style.width = Math.round(120 * currentScale) + 'px';
    faceImg.style.maxWidth = Math.round(120 * currentScale) + 'px';
    container.style.width = Math.round(160 * currentScale) + 'px';
    const statusEl = document.getElementById('radgotchi-status');
    statusEl.style.fontSize = Math.round(9 * currentScale) + 'px';
    localStorage.setItem('radgotchi-scale', currentScale);
    const newWidth = Math.round(BASE_WIDTH * currentScale);
    const newHeight = Math.round(BASE_HEIGHT * currentScale);
    if (window.electronAPI && window.electronAPI.resizeWindow) window.electronAPI.resizeWindow(newWidth, newHeight);
}

const savedScale = localStorage.getItem('radgotchi-scale');
if (savedScale) {
    currentScale = parseFloat(savedScale);
    setTimeout(() => applyScale(currentScale), 100);
}

window.addEventListener('wheel', (e) => {
    e.preventDefault();
    applyScale(currentScale + (e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP));
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') applyScale(currentScale + SCALE_STEP);
    else if (e.key === '-' || e.key === '_') applyScale(currentScale - SCALE_STEP);
});

// Right-click opens chat
container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.electronAPI && window.electronAPI.openChat) window.electronAPI.openChat();
});

// === CLICK-THROUGH FOR TRANSPARENT AREAS ===
// Allow clicks to pass through to windows behind when not over the pet
// NOTE: This feature is disabled on Wayland where setIgnoreMouseEvents doesn't work properly
const statusEl = document.getElementById('radgotchi-status');
let isOverInteractive = false;
let clickThroughEnabled = true; // Will be disabled on Wayland

function setClickThrough(ignore) {
    if (!clickThroughEnabled) return; // Skip on Wayland
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
        if (ignore) {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        } else {
            window.electronAPI.setIgnoreMouseEvents(false);
        }
    }
}

// Check platform and disable click-through on Wayland
(async function checkPlatform() {
    if (window.electronAPI && window.electronAPI.getPlatformInfo) {
        try {
            const info = await window.electronAPI.getPlatformInfo();
            if (info.isWayland) {
                clickThroughEnabled = false;
                console.log('Wayland detected: click-through disabled for compatibility');
                // Ensure mouse events are not ignored
                if (window.electronAPI.setIgnoreMouseEvents) {
                    window.electronAPI.setIgnoreMouseEvents(false);
                }
            }
        } catch (e) {
            console.warn('Could not get platform info:', e);
        }
    }
})();

// Detect when mouse enters/leaves interactive elements
[faceImg, statusEl, colorBtn].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', () => {
        isOverInteractive = true;
        setClickThrough(false);
    });
    el.addEventListener('mouseleave', () => {
        isOverInteractive = false;
        setClickThrough(true);
    });
});

// Also handle mouse leaving the window entirely
document.addEventListener('mouseleave', () => {
    setClickThrough(true);
});

// Start with click-through enabled (transparent areas pass clicks)
// Delayed to allow platform check to complete first
setTimeout(() => setClickThrough(true), 500);

// === SPRITE POSITION BASED ON WINDOW SCREEN POSITION ===
// Sprite shifts inside container based on where window is on screen
// When window is at left edge of screen → sprite at left edge of container
// When window is at center of screen → sprite at center of container
// This way sprite visually reaches edge right as window bounces
const spritePositionWrapper = document.getElementById('sprite-position-wrapper');
let spriteX = 0, spriteY = 0;           // Current position (pixels)
let targetX = 0, targetY = 0;           // Target position (pixels)
const SPRITE_LERP_SPEED = 0.15;         // Smooth easing factor

let spriteAnimationRunning = false;

// Calculate max offsets dynamically based on window/sprite dimensions
// Returns asymmetric vertical limits since sprite can move more down than up
function getMaxOffsets() {
    // Window dimensions (base * scale)
    const windowWidth = BASE_WIDTH * currentScale;
    const windowHeight = BASE_HEIGHT * currentScale;
    
    // Sprite dimensions (approximate)
    const spriteWidth = 120 * currentScale;
    const spriteHeight = 140 * currentScale; // include status text
    
    // Container top padding where sprite starts
    const containerPaddingTop = 24 * currentScale;
    
    // Max horizontal offset - symmetric left/right
    const maxX = (windowWidth - spriteWidth) / 2;
    
    // Vertical offsets - asymmetric: less room to go up, more room to go down
    // Up: sprite starts below padding, limit upward movement to not exit top
    const maxUp = Math.min(20 * currentScale, containerPaddingTop);
    // Down: sprite can move toward bottom of window
    const maxDown = (windowHeight - spriteHeight - containerPaddingTop) / 2;
    
    return { 
        maxX: Math.max(0, maxX), 
        maxUp: Math.max(0, maxUp),
        maxDown: Math.max(0, maxDown)
    };
}

function updateSpritePosition() {
    // Smooth interpolation toward target
    spriteX += (targetX - spriteX) * SPRITE_LERP_SPEED;
    spriteY += (targetY - spriteY) * SPRITE_LERP_SPEED;
    
    // Apply transform to position wrapper (includes sprite + status text)
    if (spritePositionWrapper) {
        spritePositionWrapper.style.transform = `translate(${spriteX.toFixed(1)}px, ${spriteY.toFixed(1)}px)`;
    }
    
    // Continue animation if not at rest
    const atRest = Math.abs(spriteX - targetX) < 0.3 && Math.abs(spriteY - targetY) < 0.3;
    if (!atRest) {
        requestAnimationFrame(updateSpritePosition);
    } else {
        spriteAnimationRunning = false;
    }
}

function startSpriteAnimation() {
    if (!spriteAnimationRunning) {
        spriteAnimationRunning = true;
        requestAnimationFrame(updateSpritePosition);
    }
}

// Listen for sprite position from main process (based on window screen position)
if (window.electronAPI && window.electronAPI.onSpritePosition) {
    window.electronAPI.onSpritePosition(({ px, py }) => {
        const { maxX, maxUp, maxDown } = getMaxOffsets();
        // px/py are 0-1 ratios: 0 = left/top edge, 0.5 = center, 1 = right/bottom edge
        // Map to pixel offset: -maxX to +maxX for horizontal
        targetX = (px - 0.5) * 2 * maxX;
        // Vertical is asymmetric: less upward range, more downward range
        // py < 0.5 → moving up (negative offset, limited by maxUp)
        // py > 0.5 → moving down (positive offset, limited by maxDown)
        if (py < 0.5) {
            // Map 0-0.5 to -maxUp to 0
            targetY = (py - 0.5) * 2 * maxUp;
        } else {
            // Map 0.5-1 to 0 to maxDown
            targetY = (py - 0.5) * 2 * maxDown;
        }
        startSpriteAnimation();
    });
}

export { applyLookDirection, faceFlipWrapper };

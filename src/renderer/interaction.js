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

export { applyLookDirection, faceFlipWrapper };

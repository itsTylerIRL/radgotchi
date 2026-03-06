// Native Electron dragging is handled via CSS -webkit-app-region: drag
// The face has no-drag so clicks work for pet interactions

const container = document.getElementById('radgotchi-container');
const faceImg = document.getElementById('radgotchi-face');
const faceFlipWrapper = document.getElementById('face-flip-wrapper');
const colorBtn = document.getElementById('color-picker-btn');
const colorInput = document.getElementById('color-picker-input');

// === MOUSE TRACKING / EYE FOLLOW ===
let isLookingLeft = false;
let currentLookDirection = 1; // 1 = right, -1 = left

function applyLookDirection() {
    // Use CSS variable so breathing animation can incorporate direction
    faceFlipWrapper.style.setProperty('--flip-dir', currentLookDirection);
    // Also apply direct transform for non-animated state
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
    
    try {
        const pos = await window.electronAPI.getMousePosition();
        // Calculate center of the pet window
        const petCenterX = pos.windowX + (pos.windowWidth / 2);
        
        // Determine if mouse is left or right of pet center
        const shouldLookLeft = pos.mouseX < petCenterX;
        
        if (shouldLookLeft !== isLookingLeft) {
            isLookingLeft = shouldLookLeft;
            currentLookDirection = isLookingLeft ? -1 : 1;
            applyLookDirection();
        }
    } catch (e) {
        // Ignore errors
    }
}

// Poll mouse position every 50ms for more responsive tracking
setInterval(updateEyeDirection, 50);
// Initial check
setTimeout(updateEyeDirection, 100);

// === RESIZE FUNCTIONALITY (Mouse Wheel) ===
let currentScale = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.1;
const BASE_WIDTH = 240;
const BASE_HEIGHT = 280;

function applyScale(scale) {
    currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    // Scale the face image directly
    faceImg.style.width = Math.round(120 * currentScale) + 'px';
    faceImg.style.maxWidth = Math.round(120 * currentScale) + 'px';
    // Scale container width
    container.style.width = Math.round(160 * currentScale) + 'px';
    // Scale font size
    const statusEl = document.getElementById('radgotchi-status');
    statusEl.style.fontSize = Math.round(9 * currentScale) + 'px';
    
    localStorage.setItem('radgotchi-scale', currentScale);
    // Notify main process to resize window
    const newWidth = Math.round(BASE_WIDTH * currentScale);
    const newHeight = Math.round(BASE_HEIGHT * currentScale);
    if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(newWidth, newHeight);
    }
}

// Load saved scale
const savedScale = localStorage.getItem('radgotchi-scale');
if (savedScale) {
    currentScale = parseFloat(savedScale);
    // Apply scale on load
    setTimeout(() => applyScale(currentScale), 100);
}

// Mouse wheel to resize - use window level
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP; // Scroll up = bigger
    console.log('Wheel event! delta:', delta, 'new scale:', currentScale + delta);
    applyScale(currentScale + delta);
}, { passive: false });

// Keyboard shortcuts as fallback: + and - keys
window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
        applyScale(currentScale + SCALE_STEP);
    } else if (e.key === '-' || e.key === '_') {
        applyScale(currentScale - SCALE_STEP);
    }
});

// === COLOR PICKER ===
colorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    colorInput.click();
});

colorInput.addEventListener('input', (e) => {
    const color = e.target.value;
    updateThemeColor(color);
});

function updateThemeColor(color, smooth = false) {
    // Convert hex to HSL for hue-rotate calculation
    const r = parseInt(color.slice(1,3), 16) / 255;
    const g = parseInt(color.slice(3,5), 16) / 255;
    const b = parseInt(color.slice(5,7), 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    
    if (max !== min) {
        const d = max - min;
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    // Base red is at ~0deg, calculate rotation needed
    const targetHue = h * 360;
    const hueRotate = targetHue;
    
    document.documentElement.style.setProperty('--rg-color', color);
    document.documentElement.style.setProperty('--rg-glow', color + '88');
    document.documentElement.style.setProperty('--rg-status-color', color);
    colorBtn.style.background = color;
    
    // Apply smooth transition for bounce mode
    if (smooth) {
        faceImg.style.transition = 'filter 0.3s ease-out';
    } else {
        faceImg.style.transition = 'none';
    }
    
    // Colorize with soft glow that fades before window edge
    faceImg.style.filter = `
        brightness(0) saturate(100%)
        invert(1) sepia(1) saturate(5) hue-rotate(${hueRotate}deg)
        brightness(1.1)
        drop-shadow(0 0 6px ${color}99)
        drop-shadow(0 0 12px ${color}44)
    `;
    
    // Save preference
    localStorage.setItem('radgotchi-color', color);
}

// Listen for color changes from tray menu
if (window.electronAPI && window.electronAPI.onSetColor) {
    window.electronAPI.onSetColor((color) => {
        colorInput.value = color;
        updateThemeColor(color);
    });
}

// DVD-style color change on bounce
const bounceColors = ['#ff3344', '#00ffff', '#39ff14', '#bf00ff', '#ff1493', '#ff6600', '#ffd700', '#00bfff', '#00ff00'];
let bounceColorIndex = 0;

if (window.electronAPI && window.electronAPI.onBounceEdge) {
    window.electronAPI.onBounceEdge(() => {
        bounceColorIndex = (bounceColorIndex + 1) % bounceColors.length;
        const newColor = bounceColors[bounceColorIndex];
        colorInput.value = newColor;
        updateThemeColor(newColor, true); // Use smooth transition for bounce
    });
}

// Load saved color
const savedColor = localStorage.getItem('radgotchi-color');
if (savedColor) {
    colorInput.value = savedColor;
    updateThemeColor(savedColor);
}

// System metrics polling
async function pollMetrics() {
    try {
        const metrics = await window.electronAPI.getSystemMetrics();
        if (window.RG && typeof window.RG.assessHealth === 'function') {
            window.RG.assessHealth(metrics);
        }
    } catch (e) {
        console.error('Failed to get system metrics:', e);
    }
}

// Poll every 5 seconds
setInterval(pollMetrics, 5000);
// Initial poll after a short delay
setTimeout(pollMetrics, 1000);

// System event listener
if (window.electronAPI && window.electronAPI.onSystemEvent) {
    window.electronAPI.onSystemEvent((event) => {
        if (window.RG && typeof window.RG.handleSystemEvent === 'function') {
            window.RG.handleSystemEvent(event);
        }
    });
}

// Idle state change listener
if (window.electronAPI && window.electronAPI.onIdleChange) {
    window.electronAPI.onIdleChange((data) => {
        if (!window.RG) return;
        
        if (data.idle) {
            // User went AFK - go to sleep
            faceFlipWrapper.classList.add('rg-breathing-slow');
            faceFlipWrapper.classList.remove('rg-breathing');
            window.RG.setMood('sleep', { 
                priority: true, 
                status: 'zzZZ.. waiting for you...',
                duration: 0 // Stay asleep until user returns
            });
        } else {
            // User returned - wake up
            faceFlipWrapper.classList.add('rg-breathing');
            faceFlipWrapper.classList.remove('rg-breathing-slow');
            window.RG.setMood('excited', { 
                priority: true, 
                status: 'You\'re back!',
                anim: 'bounce',
                duration: 3000
            });
        }
    });
}

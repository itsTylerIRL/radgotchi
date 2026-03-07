// Manual drag/click detection - drag anywhere to move, click to emote

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
const DRAG_THRESHOLD = 5; // pixels to move before considered a drag

// Click emotes — English
const clickEmotesEN = [
    // Acknowledgment
    { mood: 'happy', status: 'CONTACT LOGGED', anim: 'rg-bounce' },
    { mood: 'excited', status: 'SIGNAL ACQUIRED', anim: 'rg-wiggle' },
    { mood: 'cool', status: 'ACKNOWLEDGED', anim: 'rg-nod' },
    { mood: 'grateful', status: 'TRUST SCORE: HIGH', anim: 'rg-bounce' },
    { mood: 'friend', status: 'NODE VERIFIED', anim: 'rg-wiggle' },
    { mood: 'happy', status: 'PING ACCEPTED', anim: 'rg-pulse' },
    { mood: 'excited', status: 'LINK ESTABLISHED', anim: 'rg-shake' },
    { mood: 'motivated', status: 'MONITORING...', anim: 'rg-bounce' },
    { mood: 'cool', status: 'COPY THAT', anim: 'rg-nod' },
    { mood: 'excited', status: 'FEED ACTIVE', anim: 'rg-wiggle' },
    { mood: 'happy', status: 'ASSET TRACKED', anim: 'rg-pulse' },
    { mood: 'friend', status: 'CHANNEL SECURE', anim: 'rg-bounce' },
    // Analysis emotes
    { mood: 'excited', status: 'EVASIVE MANEUVERS', anim: 'rg-spin' },
    { mood: 'cool', status: 'PATTERN DETECTED', anim: 'rg-pulse' },
    { mood: 'intense', status: 'ANOMALY FLAGGED', anim: 'rg-shake' },
    { mood: 'motivated', status: 'CROSS-REFERENCING', anim: 'rg-wiggle' },
    { mood: 'smart', status: 'DECRYPTING...', anim: 'rg-pulse' },
    { mood: 'cool', status: 'DARK MODE', anim: 'rg-nod' },
    { mood: 'excited', status: 'ENTITY RESOLVED', anim: 'rg-bounce' },
    { mood: 'intense', status: 'CORRELATION FOUND', anim: 'rg-spin' },
    { mood: 'happy', status: 'QUERY COMPLETE', anim: 'rg-bounce' },
    { mood: 'smart', status: 'INDEXING DATA', anim: 'rg-nod' },
    { mood: 'motivated', status: 'GRAPH UPDATED', anim: 'rg-wiggle' },
    { mood: 'cool', status: 'WATCHING...', anim: 'rg-pulse' },
    { mood: 'smart', status: 'METADATA PARSED', anim: 'rg-nod' },
    { mood: 'excited', status: 'CONNECTION MAPPED', anim: 'rg-bounce' },
    { mood: 'intense', status: 'SIGNATURE MATCH', anim: 'rg-shake' },
    { mood: 'happy', status: 'FLAGGED FOR REVIEW', anim: 'rg-wiggle' },
];

// Click emotes — Chinese (中文)
const clickEmotesZH = [
    // 确认类
    { mood: 'happy', status: '接触已记录', anim: 'rg-bounce' },
    { mood: 'excited', status: '信号已获取', anim: 'rg-wiggle' },
    { mood: 'cool', status: '已确认', anim: 'rg-nod' },
    { mood: 'grateful', status: '信任度：高', anim: 'rg-bounce' },
    { mood: 'friend', status: '节点已验证', anim: 'rg-wiggle' },
    { mood: 'happy', status: '响应已接受', anim: 'rg-pulse' },
    { mood: 'excited', status: '连接已建立', anim: 'rg-shake' },
    { mood: 'motivated', status: '监控中...', anim: 'rg-bounce' },
    { mood: 'cool', status: '收到', anim: 'rg-nod' },
    { mood: 'excited', status: '通道活跃', anim: 'rg-wiggle' },
    { mood: 'happy', status: '资产追踪中', anim: 'rg-pulse' },
    { mood: 'friend', status: '频道安全', anim: 'rg-bounce' },
    // 分析类
    { mood: 'excited', status: '规避机动', anim: 'rg-spin' },
    { mood: 'cool', status: '模式检测', anim: 'rg-pulse' },
    { mood: 'intense', status: '异常标记', anim: 'rg-shake' },
    { mood: 'motivated', status: '交叉引用中', anim: 'rg-wiggle' },
    { mood: 'smart', status: '解密中...', anim: 'rg-pulse' },
    { mood: 'cool', status: '暗中运行', anim: 'rg-nod' },
    { mood: 'excited', status: '实体已解析', anim: 'rg-bounce' },
    { mood: 'intense', status: '关联已发现', anim: 'rg-spin' },
    { mood: 'happy', status: '查询完成', anim: 'rg-bounce' },
    { mood: 'smart', status: '数据索引中', anim: 'rg-nod' },
    { mood: 'motivated', status: '图谱已更新', anim: 'rg-wiggle' },
    { mood: 'cool', status: '监视中...', anim: 'rg-pulse' },
    { mood: 'smart', status: '元数据已解析', anim: 'rg-nod' },
    { mood: 'excited', status: '连接已映射', anim: 'rg-bounce' },
    { mood: 'intense', status: '特征匹配', anim: 'rg-shake' },
    { mood: 'happy', status: '已标记待审', anim: 'rg-wiggle' },
];

function getClickEmotes() {
    return (window.RG && window.RG.language === 'zh') ? clickEmotesZH : clickEmotesEN;
}

function triggerClickEmote() {
    if (!window.RG || typeof window.RG.setMood !== 'function') return;
    const emotes = getClickEmotes();
    const emote = emotes[Math.floor(Math.random() * emotes.length)];
    window.RG.setMood(emote.mood, {
        duration: 1500,
        anim: emote.anim,
        status: emote.status,
        priority: true
    });
}

container.addEventListener('mousedown', (e) => {
    // Ignore if clicking on color picker
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
    if (dragStartX === 0 && dragStartY === 0) return; // Not tracking
    
    const deltaFromStart = Math.sqrt(
        Math.pow(e.screenX - dragStartX, 2) + 
        Math.pow(e.screenY - dragStartY, 2)
    );
    
    // Start dragging if moved past threshold
    if (!isDragging && deltaFromStart > DRAG_THRESHOLD) {
        isDragging = true;
        if (window.electronAPI && window.electronAPI.startDrag) {
            window.electronAPI.startDrag();
        }
    }
    
    // Send drag delta
    if (isDragging && window.electronAPI && window.electronAPI.windowDrag) {
        const deltaX = e.screenX - lastMouseX;
        const deltaY = e.screenY - lastMouseY;
        window.electronAPI.windowDrag({ deltaX, deltaY });
    }
    
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
});

window.addEventListener('mouseup', (e) => {
    if (dragStartX === 0 && dragStartY === 0) return; // Wasn't tracking
    
    container.style.cursor = 'grab';
    
    if (isDragging) {
        // Was dragging - stop drag
        if (window.electronAPI && window.electronAPI.stopDrag) {
            window.electronAPI.stopDrag();
        }
    } else {
        // Was a click - trigger emote
        triggerClickEmote();
    }
    
    // Reset tracking
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
});

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

// Movement mode change listener
let currentMovementMode = 'none';
if (window.electronAPI && window.electronAPI.onMovementModeChange) {
    window.electronAPI.onMovementModeChange((mode) => {
        currentMovementMode = mode;
        // Restore user's saved color when leaving bounce mode
        if (mode !== 'bounce') {
            const saved = localStorage.getItem('radgotchi-color');
            if (saved) {
                colorInput.value = saved;
                updateThemeColor(saved, true);
            }
        }
    });
}

// Wander pause/resume listener
if (window.electronAPI && window.electronAPI.onWanderPause) {
    window.electronAPI.onWanderPause((paused) => {
        if (currentMovementMode !== 'wander') return;
        if (paused) {
            // Slow breathing while paused
            faceFlipWrapper.classList.add('rg-breathing-slow');
            faceFlipWrapper.classList.remove('rg-breathing');
        } else {
            faceFlipWrapper.classList.add('rg-breathing');
            faceFlipWrapper.classList.remove('rg-breathing-slow');
        }
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

// Language change listener (tray menu → renderer → RG module)
if (window.electronAPI && window.electronAPI.onSetLanguage) {
    window.electronAPI.onSetLanguage((lang) => {
        if (window.RG && typeof window.RG.setLanguage === 'function') {
            window.RG.setLanguage(lang);
        }
    });
}

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

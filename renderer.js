// Manual drag/click detection - drag anywhere to move, click triggers mood in radgotchi.js

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

// NOTE: Click emotes are handled in radgotchi.js faceEl click listener.
// This file only handles drag detection and XP award on click.

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
        // Was a click - radgotchi.js handles the emote/mood, we just award XP
        // Award XP for click (with cooldown handled in main process)
        if (window.electronAPI && window.electronAPI.addXp) {
            window.electronAPI.addXp(2, 'click');
        }
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
    
    // Skip mouse tracking while vibing to audio (let the vibe control direction)
    const faceEl = document.getElementById('radgotchi-face');
    if (faceEl && faceEl.classList.contains('rg-audio-music')) {
        return; // Let audio reactive mode control the face direction
    }
    
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

// Helper: convert HSL to hex color
function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function updateThemeColor(color, smooth = false) {
    // Convert hex to HSL for hue-rotate calculation
    const r = parseInt(color.slice(1,3), 16) / 255;
    const g = parseInt(color.slice(3,5), 16) / 255;
    const b = parseInt(color.slice(5,7), 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
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
    
    // Calculate inverted/complementary color for vibe glow (rotate hue 180 degrees)
    const invertedHue = (h + 0.5) % 1.0; // Add 180 degrees (0.5 in 0-1 scale)
    // Convert back to RGB with same saturation and lightness
    const invertedColor = hslToHex(invertedHue, s, l);
    document.documentElement.style.setProperty('--rg-vibe-color', invertedColor);
    document.documentElement.style.setProperty('--rg-vibe-glow', invertedColor + '88');
    
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
    
    // Sync color to chat window
    if (window.electronAPI && window.electronAPI.syncChatColor) {
        window.electronAPI.syncChatColor(color);
    }
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
            // Play language-specific sound
            if (typeof SoundSystem !== 'undefined') {
                SoundSystem.play(lang === 'zh' ? 'gong' : 'starSpangledBanner');
            }
        }
    });
}

// Sleep mode listener (chat panel → renderer → RG module)
if (window.electronAPI && window.electronAPI.onSetSleep) {
    window.electronAPI.onSetSleep((sleeping) => {
        if (window.RG && typeof window.RG.setSleep === 'function') {
            window.RG.setSleep(sleeping);
        }
    });
}

// Sleep animation listener
if (window.electronAPI && window.electronAPI.onSleepAnimation) {
    window.electronAPI.onSleepAnimation((animation) => {
        if (window.RG && typeof window.RG.setSleepAnimation === 'function') {
            window.RG.setSleepAnimation(animation);
        }
    });
}

// Work mode listener (pomodoro focus)
if (window.electronAPI && window.electronAPI.onSetWork) {
    window.electronAPI.onSetWork((working) => {
        if (window.RG && typeof window.RG.setWork === 'function') {
            window.RG.setWork(working);
        }
    });
}

// Work animation listener
if (window.electronAPI && window.electronAPI.onWorkAnimation) {
    window.electronAPI.onWorkAnimation((animation) => {
        if (window.RG && typeof window.RG.setWorkAnimation === 'function') {
            window.RG.setWorkAnimation(animation);
        }
    });
}

// Audio reactive mode listener (dance to music, notes for voice)
if (window.electronAPI && window.electronAPI.onSetAudioListening) {
    window.electronAPI.onSetAudioListening((enabled) => {
        if (window.RG && typeof window.RG.setAudioListening === 'function') {
            window.RG.setAudioListening(enabled);
        }
    });
}

// Auto-start audio listening (enabled by default, respects saved preference)
(function autoStartAudioListening() {
    // Check saved preference
    let vibeDisabled = false;
    try {
        vibeDisabled = localStorage.getItem('radgotchi-vibe-disabled') === 'true';
    } catch(e) {}
    
    if (!vibeDisabled && window.RG && typeof window.RG.setAudioListening === 'function') {
        // Small delay to ensure everything is initialized
        setTimeout(() => {
            window.RG.setAudioListening(true);
        }, 1000);
    }
})();

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

// Attention event listener - pet needs attention or loses XP
let attentionActive = false;
if (window.electronAPI && window.electronAPI.onAttentionEvent) {
    window.electronAPI.onAttentionEvent((data) => {
        attentionActive = data.active;
        
        if (data.active) {
            // Start vibrating - needs attention!
            container.classList.add('rg-attention-needed');
            faceFlipWrapper.classList.add('rg-vibrate');
            
            // Play attention start sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('attentionStart');
            
            if (window.RG) {
                const lang = (window.RG && window.RG.language === 'zh') ? 'zh' : 'en';
                const statusText = lang === 'zh' ? '连接不稳定！确认信号！' : 'LINK UNSTABLE! CONFIRM SIGNAL!';
                window.RG.setMood('intense', { 
                    priority: true, 
                    status: statusText,
                    duration: 0 // Stay until resolved
                });
            }
        } else {
            // Stop vibrating
            container.classList.remove('rg-attention-needed');
            faceFlipWrapper.classList.remove('rg-vibrate');
            
            if (data.resolved && window.RG) {
                // Play attention resolved sound
                if (typeof SoundSystem !== 'undefined') SoundSystem.play('attentionEnd');
                
                const lang = (window.RG && window.RG.language === 'zh') ? 'zh' : 'en';
                const statusText = lang === 'zh' ? '连接已恢复' : 'HANDSHAKE CONFIRMED';
                window.RG.setMood('grateful', { 
                    priority: true, 
                    status: statusText,
                    anim: 'bounce',
                    duration: 2500
                });
            }
        }
    });
}

// === CHAT FUNCTIONALITY ===

// Right-click on pet opens chat
container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.electronAPI && window.electronAPI.openChat) {
        window.electronAPI.openChat();
    }
});

// Listen for chat mood changes from the chat window
if (window.electronAPI && window.electronAPI.onChatMood) {
    window.electronAPI.onChatMood((mood) => {
        if (!window.RG) return;
        
        switch (mood) {
            case 'thinking':
                window.RG.setMood('smart', { duration: 2000, status: 'PROCESSING...' });
                break;
            case 'success':
                window.RG.setMood('happy', { duration: 2000, status: 'TX COMPLETE' });
                break;
            case 'error':
                window.RG.setMood('sad', { duration: 2000, status: 'COMMS ERROR' });
                break;
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// XP GAIN/LOSS VISUAL EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

function getCurrentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--rg-color').trim() || '#ff3344';
}

function spawnXpParticle(amount) {
    const particle = document.createElement('div');
    particle.className = 'rg-xp-particle';
    particle.textContent = `+${amount}`;
    
    // Position on left side of sprite, slight vertical randomness
    const offsetY = (Math.random() - 0.5) * 20;
    particle.style.left = '5px';
    particle.style.top = `calc(50% + ${offsetY}px)`;
    
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 1000);
}

function spawnXpLossParticle(amount) {
    const particle = document.createElement('div');
    particle.className = 'rg-xp-loss-particle';
    particle.textContent = `-${amount}`;
    
    // Position on right side of sprite, slight vertical randomness
    const offsetY = (Math.random() - 0.5) * 20;
    particle.style.right = '5px';
    particle.style.left = 'auto';
    particle.style.top = `calc(50% + ${offsetY}px)`;
    
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 800);
}

function spawnConfetti(count = 20) {
    const color = getCurrentColor();
    const colors = [color, '#ffffff', '#ffd700', color, '#00ffff'];
    
    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'rg-confetti';
        
        // Random color from palette
        const c = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.background = c;
        confetti.style.boxShadow = `0 0 4px ${c}, 0 0 8px ${c}88`;
        
        // Random trajectory
        const angle = (Math.random() * Math.PI * 2);
        const distance = 40 + Math.random() * 60;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - 20; // Bias upward
        const rot = Math.random() * 720 - 360;
        const duration = 0.8 + Math.random() * 0.7;
        
        confetti.style.setProperty('--confetti-x', x);
        confetti.style.setProperty('--confetti-y', y);
        confetti.style.setProperty('--confetti-rot', rot);
        confetti.style.setProperty('--confetti-duration', `${duration}s`);
        
        // Center origin with slight randomness
        confetti.style.left = `calc(50% + ${(Math.random() - 0.5) * 20}px)`;
        confetti.style.top = '35%';
        
        // Random shapes
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        } else {
            confetti.style.transform = `rotate(${Math.random() * 45}deg)`;
        }
        
        container.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), duration * 1000 + 100);
    }
}

function spawnDebris(count = 10) {
    for (let i = 0; i < count; i++) {
        const debris = document.createElement('div');
        debris.className = 'rg-debris';
        
        // Random falling trajectory
        const x = (Math.random() - 0.5) * 80;
        const y = 40 + Math.random() * 60;
        const rot = Math.random() * 360;
        const duration = 0.6 + Math.random() * 0.5;
        
        debris.style.setProperty('--debris-x', x);
        debris.style.setProperty('--debris-y', y);
        debris.style.setProperty('--debris-rot', rot);
        debris.style.setProperty('--debris-duration', `${duration}s`);
        
        debris.style.left = `calc(50% + ${(Math.random() - 0.5) * 40}px)`;
        debris.style.top = '30%';
        
        container.appendChild(debris);
        
        setTimeout(() => debris.remove(), duration * 1000 + 100);
    }
}

// XP Update listener
if (window.electronAPI && window.electronAPI.onXpUpdate) {
    window.electronAPI.onXpUpdate((data) => {
        // XP Gained
        if (!data.xpLost && !data.leveledDown) {
            // Pulse animation on face
            faceImg.classList.remove('rg-xp-gain');
            void faceImg.offsetWidth; // Force reflow
            faceImg.classList.add('rg-xp-gain');
            setTimeout(() => faceImg.classList.remove('rg-xp-gain'), 400);
            
            // Spawn floating +XP particle (skip for passive gains)
            if (data.leveledUp || data.totalXp % 5 === 0) {
                // Show particle on level up or every 5 XP to avoid spam
                const gained = data.xpIntoLevel > 0 ? Math.min(data.xpIntoLevel, 10) : 1;
                spawnXpParticle(gained);
                
                // Play xpGain sound for non-passive, significant XP gains (not on every passive tick)
                if (!data.leveledUp && typeof SoundSystem !== 'undefined') {
                    SoundSystem.play('xpGain');
                }
            }
        }
        
        // Level Up - CONFETTI TIME!
        if (data.leveledUp) {
            // Play level up sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('levelUp');
            
            faceImg.classList.remove('rg-level-up');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-level-up');
            setTimeout(() => faceImg.classList.remove('rg-level-up'), 800);
            
            // Spawn confetti explosion
            spawnConfetti(25);
            
            // Show happy mood
            if (window.RG) {
                const lang = (window.RG.language === 'zh') ? 'zh' : 'en';
                const statusText = lang === 'zh' ? 
                    `等级提升! LV.${data.level}` : 
                    `LEVEL UP! LV.${data.level}`;
                window.RG.setMood('excited', {
                    priority: true,
                    status: statusText,
                    anim: 'bounce',
                    duration: 3000
                });
            }
        }
        
        // XP Lost
        if (data.xpLost) {
            // Play subtle loss sound (not on every passive loss)
            if (data.xpLost >= 5 && typeof SoundSystem !== 'undefined') {
                SoundSystem.play('xpLoss');
            }
            
            faceImg.classList.remove('rg-xp-loss');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-xp-loss');
            setTimeout(() => faceImg.classList.remove('rg-xp-loss'), 500);
            
            // Spawn sinking -XP particle
            spawnXpLossParticle(data.xpLost);
        }
        
        // Level Down - DRAMATIC CRASH
        if (data.leveledDown) {
            // Play level down sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('xpLoss');
            
            faceImg.classList.remove('rg-level-down');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-level-down');
            setTimeout(() => faceImg.classList.remove('rg-level-down'), 800);
            
            // Spawn falling debris
            spawnDebris(12);
            
            // Show sad mood
            if (window.RG) {
                const lang = (window.RG.language === 'zh') ? 'zh' : 'en';
                const statusText = lang === 'zh' ? 
                    `等级下降... LV.${data.level}` : 
                    `LEVEL DOWN... LV.${data.level}`;
                window.RG.setMood('sad', {
                    priority: true,
                    status: statusText,
                    duration: 3000
                });
            }
        }
    });
}

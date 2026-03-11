// Color theme — hslToHex, updateThemeColor, color picker, bounce colors, movement mode

const faceImg = document.getElementById('radgotchi-face');
const faceFlipWrapper = document.getElementById('face-flip-wrapper');
const colorBtn = document.getElementById('color-picker-btn');
const colorInput = document.getElementById('color-picker-input');

function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
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

export function updateThemeColor(color, smooth = false) {
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
    const targetHue = h * 360;
    document.documentElement.style.setProperty('--rg-color', color);
    document.documentElement.style.setProperty('--rg-glow', color + '88');
    document.documentElement.style.setProperty('--rg-status-color', color);
    colorBtn.style.background = color;
    const invertedHue = (h + 0.5) % 1.0;
    const invertedColor = hslToHex(invertedHue, s, l);
    document.documentElement.style.setProperty('--rg-vibe-color', invertedColor);
    document.documentElement.style.setProperty('--rg-vibe-glow', invertedColor + '88');
    if (smooth) faceImg.style.transition = 'filter 0.3s ease-out';
    else faceImg.style.transition = 'none';
    faceImg.style.filter = `
        brightness(0) saturate(100%)
        invert(1) sepia(1) saturate(5) hue-rotate(${targetHue}deg)
        brightness(1.1)
        drop-shadow(0 0 6px ${color}99)
        drop-shadow(0 0 12px ${color}44)
    `;
    localStorage.setItem('radgotchi-color', color);
    if (window.electronAPI && window.electronAPI.syncChatColor) window.electronAPI.syncChatColor(color);
}

// Color picker
colorBtn.addEventListener('click', (e) => { e.stopPropagation(); colorInput.click(); });
colorInput.addEventListener('input', (e) => updateThemeColor(e.target.value));

// Tray color changes
if (window.electronAPI && window.electronAPI.onSetColor) {
    window.electronAPI.onSetColor((color) => { colorInput.value = color; updateThemeColor(color); });
}

// Bounce colors
const bounceColors = ['#ff3344', '#00ffff', '#39ff14', '#bf00ff', '#ff1493', '#ff6600', '#ffd700', '#00bfff', '#00ff00'];
let bounceColorIndex = 0;
if (window.electronAPI && window.electronAPI.onBounceEdge) {
    window.electronAPI.onBounceEdge(() => {
        bounceColorIndex = (bounceColorIndex + 1) % bounceColors.length;
        colorInput.value = bounceColors[bounceColorIndex];
        updateThemeColor(bounceColors[bounceColorIndex], true);
    });
}

// Movement mode
let currentMovementMode = 'none';
if (window.electronAPI && window.electronAPI.onMovementModeChange) {
    window.electronAPI.onMovementModeChange((mode) => {
        currentMovementMode = mode;
        if (mode !== 'bounce') {
            const saved = localStorage.getItem('radgotchi-color');
            if (saved) { colorInput.value = saved; updateThemeColor(saved, true); }
        }
    });
}

// Wander pause
if (window.electronAPI && window.electronAPI.onWanderPause) {
    window.electronAPI.onWanderPause((paused) => {
        if (currentMovementMode !== 'wander') return;
        if (paused) { faceFlipWrapper.classList.add('rg-breathing-slow'); faceFlipWrapper.classList.remove('rg-breathing'); }
        else { faceFlipWrapper.classList.add('rg-breathing'); faceFlipWrapper.classList.remove('rg-breathing-slow'); }
    });
}

// Load saved color
const savedColor = localStorage.getItem('radgotchi-color');
if (savedColor) { colorInput.value = savedColor; updateThemeColor(savedColor); }

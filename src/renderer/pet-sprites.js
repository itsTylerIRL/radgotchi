// Sprite face map, face/animation helpers, sleep Z particles, click ripple

const faceEl = document.getElementById('radgotchi-face');
const container = document.getElementById('radgotchi-container');

export const faces = {
    awake: 'assets/gotchi/AWAKE.png',
    happy: 'assets/gotchi/HAPPY.png',
    excited: 'assets/gotchi/EXCITED.png',
    cool: 'assets/gotchi/COOL.png',
    grateful: 'assets/gotchi/GRATEFUL.png',
    motivated: 'assets/gotchi/MOTIVATED.png',
    friend: 'assets/gotchi/FRIEND.png',
    look_l: 'assets/gotchi/LOOK_L.png',
    look_r: 'assets/gotchi/LOOK_R.png',
    look_l_happy: 'assets/gotchi/LOOK_L_HAPPY.png',
    look_r_happy: 'assets/gotchi/LOOK_R_HAPPY.png',
    smart: 'assets/gotchi/SMART.png',
    intense: 'assets/gotchi/INTENSE.png',
    debug: 'assets/gotchi/DEBUG.png',
    bored: 'assets/gotchi/BORED.png',
    sad: 'assets/gotchi/SAD.png',
    angry: 'assets/gotchi/ANGRY.png',
    lonely: 'assets/gotchi/LONELY.png',
    demotivated: 'assets/gotchi/DEMOTIVATED.png',
    broken: 'assets/gotchi/BROKEN.png',
    sleep: 'assets/gotchi/SLEEP.png',
    sleep2: 'assets/gotchi/SLEEP2.png',
    upload: 'assets/gotchi/UPLOAD.png',
    upload1: 'assets/gotchi/UPLOAD1.png',
    upload2: 'assets/gotchi/UPLOAD2.png'
};

const negativeMoods = ['sad', 'angry', 'broken', 'lonely', 'demotivated'];
export { negativeMoods };

export function setFace(faceName) {
    if (!faces[faceName]) return;
    faceEl.src = faces[faceName];
    if (window.electronAPI && window.electronAPI.updateSprite) {
        const spriteName = faces[faceName].split('/').pop();
        window.electronAPI.updateSprite(spriteName);
    }
}

export function clearAnimations() {
    faceEl.classList.remove(
        'rg-bounce', 'rg-wiggle', 'rg-shake', 'rg-nod', 'rg-float',
        'rg-spin', 'rg-pulse', 'rg-peek-l', 'rg-peek-r', 'rg-sleep',
        'rg-upload', 'rg-scared', 'rg-sad', 'rg-glitch', 'rg-sad-wobble'
    );
}

export function applyAnimation(anim) {
    if (!anim) return;
    clearAnimations();
    void faceEl.offsetWidth;
    faceEl.classList.add(anim);
}

// === Sleep Z Particles ===
import { pick } from './status-text.js';

let sleepZTimer = null;

function spawnSleepZ() {
    const z = document.createElement('span');
    z.className = 'rg-zzz';
    z.textContent = pick(['z', 'Z', 'zZ', 'Zz']);
    z.style.left = (60 + Math.random() * 30) + 'px';
    z.style.top = (20 + Math.random() * 20) + 'px';
    container.appendChild(z);
    setTimeout(() => z.remove(), 2500);
}

export function startSleepZ() {
    if (sleepZTimer) return;
    spawnSleepZ();
    sleepZTimer = setInterval(spawnSleepZ, 1800);
}

export function stopSleepZ() {
    if (sleepZTimer) {
        clearInterval(sleepZTimer);
        sleepZTimer = null;
    }
}

// === Click Ripple ===
export function spawnClickRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'rg-click-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    container.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

export function getFaceEl() { return faceEl; }
export function getContainer() { return container; }

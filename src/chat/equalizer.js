// Audio equalizer visualizer

import SoundSystem from '../renderer/sounds.js';

const equalizer = document.getElementById('equalizer');
const vibeBtn = document.getElementById('vibe-btn');

let eqBars = [];
let isVibeDisabled = false;
let audioActiveTimeout = null;

const EQ_BAR_WIDTH = 3;
const EQ_BAR_GAP = 2;
const EQ_WAVE_DURATION = 2;

function createEqBars() {
    const containerWidth = equalizer.clientWidth;
    if (containerWidth === 0) return;
    const barSpace = EQ_BAR_WIDTH + EQ_BAR_GAP;
    const numBars = Math.floor((containerWidth + EQ_BAR_GAP) / barSpace);
    if (numBars === eqBars.length) return;

    equalizer.innerHTML = '';
    eqBars = [];
    for (let i = 0; i < numBars; i++) {
        const bar = document.createElement('div');
        bar.className = 'eq-bar';
        bar.style.animationDelay = ((i / numBars) * EQ_WAVE_DURATION).toFixed(2) + 's';
        equalizer.appendChild(bar);
        eqBars.push(bar);
    }
}

createEqBars();
new ResizeObserver(() => createEqBars()).observe(equalizer);

// Load saved vibe state
try {
    if (localStorage.getItem('radgotchi-vibe-disabled') === 'true') {
        isVibeDisabled = true;
        vibeBtn.classList.add('disabled');
    } else {
        equalizer.classList.add('listening');
    }
} catch(e) { equalizer.classList.add('listening'); }

vibeBtn.addEventListener('click', () => {
    isVibeDisabled = !isVibeDisabled;
    vibeBtn.classList.toggle('disabled', isVibeDisabled);
    if (isVibeDisabled) {
        equalizer.classList.remove('active', 'listening');
        eqBars.forEach(bar => bar.style.height = '');
    } else {
        equalizer.classList.add('listening');
    }
    SoundSystem.play('click');
    localStorage.setItem('radgotchi-vibe-disabled', isVibeDisabled);
    if (window.electronAPI && window.electronAPI.setVibeMode) window.electronAPI.setVibeMode(!isVibeDisabled);
});

export function handleAudioLevels(data) {
    if (isVibeDisabled) return;
    const { levels, isActive } = data;
    const numBars = eqBars.length;
    if (numBars === 0) return;

    const maxHeight = 16, minHeight = 2, range = maxHeight - minHeight;
    const srcLen = levels.length;
    for (let i = 0; i < numBars; i++) {
        const srcPos = (i / numBars) * srcLen;
        const srcIdx = Math.floor(srcPos);
        const frac = srcPos - srcIdx;
        const level = (levels[srcIdx] || 0) + ((levels[Math.min(srcIdx + 1, srcLen - 1)] || 0) - (levels[srcIdx] || 0)) * frac;
        eqBars[i].style.height = (minHeight + (level / 255) * range) + 'px';
    }

    if (isActive) {
        equalizer.classList.remove('listening');
        equalizer.classList.add('active');
        if (audioActiveTimeout) clearTimeout(audioActiveTimeout);
        audioActiveTimeout = setTimeout(() => {
            equalizer.classList.remove('active');
            equalizer.classList.add('listening');
            eqBars.forEach(bar => bar.style.height = '');
        }, 2000);
    }
}

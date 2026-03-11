// XP visual effects — particles, confetti, debris, XP/level update listener

import SoundSystem from './sounds.js';
import { setMood } from './mood-engine.js';
import { getLanguage } from './status-text.js';

const container = document.getElementById('radgotchi-container');
const faceImg = document.getElementById('radgotchi-face');

function getCurrentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--rg-color').trim() || '#ff3344';
}

function spawnXpParticle(amount) {
    const particle = document.createElement('div');
    particle.className = 'rg-xp-particle';
    particle.textContent = `+${amount}`;
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
        const c = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.background = c;
        confetti.style.boxShadow = `0 0 4px ${c}, 0 0 8px ${c}88`;
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 60;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - 20;
        const rot = Math.random() * 720 - 360;
        const duration = 0.8 + Math.random() * 0.7;
        confetti.style.setProperty('--confetti-x', x);
        confetti.style.setProperty('--confetti-y', y);
        confetti.style.setProperty('--confetti-rot', rot);
        confetti.style.setProperty('--confetti-duration', `${duration}s`);
        confetti.style.left = `calc(50% + ${(Math.random() - 0.5) * 20}px)`;
        confetti.style.top = '35%';
        if (Math.random() > 0.5) confetti.style.borderRadius = '50%';
        else confetti.style.transform = `rotate(${Math.random() * 45}deg)`;
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), duration * 1000 + 100);
    }
}

function spawnDebris(count = 10) {
    for (let i = 0; i < count; i++) {
        const debris = document.createElement('div');
        debris.className = 'rg-debris';
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

// Register XP update listener
export function registerXpListener() {
    if (!window.electronAPI || !window.electronAPI.onXpUpdate) return;
    window.electronAPI.onXpUpdate((data) => {
        // XP Gained
        if (!data.xpLost && !data.leveledDown) {
            faceImg.classList.remove('rg-xp-gain');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-xp-gain');
            setTimeout(() => faceImg.classList.remove('rg-xp-gain'), 400);
            if (data.leveledUp || data.totalXp % 5 === 0) {
                const gained = data.xpIntoLevel > 0 ? Math.min(data.xpIntoLevel, 10) : 1;
                spawnXpParticle(gained);
                if (!data.leveledUp) SoundSystem.play('xpGain');
            }
        }

        // Level Up
        if (data.leveledUp) {
            SoundSystem.play('levelUp');
            faceImg.classList.remove('rg-level-up');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-level-up');
            setTimeout(() => faceImg.classList.remove('rg-level-up'), 800);
            spawnConfetti(25);
            const lang = getLanguage();
            const statusText = lang === 'zh' ? `等级提升! LV.${data.level}` : `LEVEL UP! LV.${data.level}`;
            setMood('excited', { priority: true, status: statusText, anim: 'bounce', duration: 3000 });
        }

        // XP Lost
        if (data.xpLost) {
            if (data.xpLost >= 5) SoundSystem.play('xpLoss');
            faceImg.classList.remove('rg-xp-loss');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-xp-loss');
            setTimeout(() => faceImg.classList.remove('rg-xp-loss'), 500);
            spawnXpLossParticle(data.xpLost);
        }

        // Level Down
        if (data.leveledDown) {
            SoundSystem.play('xpLoss');
            faceImg.classList.remove('rg-level-down');
            void faceImg.offsetWidth;
            faceImg.classList.add('rg-level-down');
            setTimeout(() => faceImg.classList.remove('rg-level-down'), 800);
            spawnDebris(12);
            const lang = getLanguage();
            const statusText = lang === 'zh' ? `等级下降... LV.${data.level}` : `LEVEL DOWN... LV.${data.level}`;
            setMood('sad', { priority: true, status: statusText, duration: 3000 });
        }
    });
}

export { getCurrentColor, spawnConfetti, spawnDebris };

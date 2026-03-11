// Radgotchi Sound System — Synthetic retro-tech audio

const SoundSystem = (function() {
    let audioCtx = null;
    let masterGain = null;
    let enabled = true;
    let volume = 0.5;

    function getContext() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = audioCtx.createGain();
                masterGain.gain.value = volume;
                masterGain.connect(audioCtx.destination);
            } catch (e) {
                console.warn('SoundSystem: Could not create AudioContext', e);
                return null;
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function createOscillator(type, freq, startTime, duration, gainValue = 0.3) {
        const ctx = getContext();
        if (!ctx) return null;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
        return { osc, gain };
    }

    function createNoise(startTime, duration, gainValue = 0.1) {
        const ctx = getContext();
        if (!ctx) return null;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 1;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(startTime);
        return { noise, gain, filter };
    }

    const sounds = {
        chatOpen: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 400, now, 0.06, 0.2);
            createOscillator('square', 600, now + 0.05, 0.06, 0.2);
            createOscillator('square', 800, now + 0.1, 0.08, 0.25);
            createNoise(now + 0.08, 0.1, 0.08);
        },
        chatClose: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 600, now, 0.05, 0.15);
            createOscillator('square', 400, now + 0.04, 0.06, 0.12);
            createOscillator('square', 250, now + 0.09, 0.08, 0.1);
        },
        messageSend: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now); osc.stop(now + 0.1);
            createNoise(now, 0.05, 0.05);
        },
        messageReceive: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 880, now, 0.08, 0.3);
            createOscillator('sine', 1100, now + 0.06, 0.1, 0.25);
            createNoise(now + 0.05, 0.08, 0.04);
        },
        click: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 220, now, 0.03, 0.25);
            createOscillator('sine', 440, now, 0.05, 0.2);
            createNoise(now, 0.03, 0.1);
        },
        sleepStart: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 600, now, 0.2, 0.15);
            createOscillator('sine', 500, now + 0.15, 0.2, 0.12);
            createOscillator('sine', 400, now + 0.3, 0.25, 0.1);
            createOscillator('sine', 300, now + 0.45, 0.3, 0.08);
        },
        sleepEnd: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 400, now, 0.1, 0.1);
            createOscillator('sine', 500, now + 0.08, 0.1, 0.12);
            createOscillator('sine', 700, now + 0.16, 0.12, 0.15);
            createOscillator('sine', 900, now + 0.25, 0.15, 0.18);
        },
        attentionStart: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            for (let i = 0; i < 3; i++) {
                createOscillator('square', 800, now + i * 0.12, 0.08, 0.25);
                createOscillator('square', 600, now + i * 0.12 + 0.04, 0.06, 0.2);
            }
            createNoise(now, 0.4, 0.05);
        },
        attentionEnd: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 523, now, 0.12, 0.2);
            createOscillator('sine', 659, now + 0.1, 0.12, 0.2);
            createOscillator('sine', 784, now + 0.2, 0.2, 0.25);
            createOscillator('triangle', 1047, now + 0.3, 0.3, 0.15);
        },
        levelUp: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 523, now, 0.1, 0.15);
            createOscillator('square', 659, now + 0.08, 0.1, 0.15);
            createOscillator('square', 784, now + 0.16, 0.1, 0.15);
            createOscillator('square', 1047, now + 0.24, 0.2, 0.2);
            createOscillator('sine', 1047, now + 0.24, 0.3, 0.1);
            createNoise(now + 0.2, 0.15, 0.05);
        },
        milestone: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sawtooth', 400, now, 0.05, 0.15);
            createOscillator('sawtooth', 600, now + 0.04, 0.05, 0.15);
            createOscillator('square', 800, now + 0.08, 0.1, 0.2);
            createOscillator('sine', 1000, now + 0.15, 0.15, 0.15);
            createNoise(now + 0.1, 0.1, 0.04);
        },
        pomodoroStart: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 440, now, 0.15, 0.15);
            createOscillator('sine', 550, now + 0.12, 0.15, 0.15);
            createOscillator('sine', 660, now + 0.24, 0.2, 0.18);
        },
        pomodoroComplete: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 880, now, 0.3, 0.2);
            createOscillator('sine', 1100, now, 0.25, 0.1);
            createOscillator('sine', 880, now + 0.35, 0.3, 0.15);
            createOscillator('sine', 1100, now + 0.35, 0.25, 0.08);
        },
        xpGain: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 600, now, 0.04, 0.15);
            createOscillator('sine', 800, now + 0.03, 0.05, 0.12);
        },
        xpLoss: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 400, now, 0.06, 0.15);
            createOscillator('sine', 300, now + 0.04, 0.08, 0.12);
        },
        statsOpen: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 300, now, 0.04, 0.15);
            createOscillator('square', 500, now + 0.03, 0.04, 0.18);
            createOscillator('square', 700, now + 0.06, 0.06, 0.2);
            createNoise(now + 0.05, 0.08, 0.06);
        },
        statsClose: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 500, now, 0.04, 0.12);
            createOscillator('square', 350, now + 0.03, 0.05, 0.1);
            createNoise(now + 0.02, 0.05, 0.04);
        },
        selectChange: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 440, now, 0.03, 0.18);
            createOscillator('sine', 660, now + 0.02, 0.04, 0.12);
        },
        gong: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(110, now);
            osc1.frequency.exponentialRampToValueAtTime(100, now + 1.5);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(220, now);
            osc2.frequency.exponentialRampToValueAtTime(200, now + 1.2);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.35, now + 0.01);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.15, now + 0.01);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc1.connect(gain1); osc2.connect(gain2);
            gain1.connect(masterGain); gain2.connect(masterGain);
            osc1.start(now); osc2.start(now);
            osc1.stop(now + 2); osc2.stop(now + 1.5);
            createNoise(now, 0.15, 0.08);
        },
        starSpangledBanner: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            const melody = [
                { freq: 349.23, time: 0, dur: 0.2 },
                { freq: 293.66, time: 0.2, dur: 0.15 },
                { freq: 233.08, time: 0.35, dur: 0.15 },
                { freq: 293.66, time: 0.5, dur: 0.15 },
                { freq: 349.23, time: 0.65, dur: 0.25 }
            ];
            melody.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(note.freq, now + note.time);
                gain.gain.setValueAtTime(0, now + note.time);
                gain.gain.linearRampToValueAtTime(0.08, now + note.time + 0.02);
                gain.gain.setValueAtTime(0.07, now + note.time + note.dur * 0.7);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);
                osc.connect(gain); gain.connect(masterGain);
                osc.start(now + note.time); osc.stop(now + note.time + note.dur + 0.05);
            });
            melody.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.freq / 2, now + note.time);
                gain.gain.setValueAtTime(0, now + note.time);
                gain.gain.linearRampToValueAtTime(0.04, now + note.time + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);
                osc.connect(gain); gain.connect(masterGain);
                osc.start(now + note.time); osc.stop(now + note.time + note.dur + 0.05);
            });
            createNoise(now, 0.05, 0.02);
            createNoise(now + 0.35, 0.04, 0.015);
            createNoise(now + 0.65, 0.06, 0.02);
        },
        boot: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('sine', 60, now, 0.3, 0.15);
            createOscillator('square', 200, now + 0.1, 0.05, 0.2);
            createOscillator('square', 300, now + 0.18, 0.05, 0.2);
            createOscillator('square', 400, now + 0.26, 0.05, 0.2);
            createOscillator('square', 600, now + 0.34, 0.08, 0.25);
            createNoise(now + 0.15, 0.25, 0.06);
            createOscillator('sine', 880, now + 0.5, 0.15, 0.3);
            createOscillator('sine', 1100, now + 0.55, 0.2, 0.25);
            createOscillator('sine', 1320, now + 0.62, 0.25, 0.2);
        },
        shutdown: function() {
            if (!enabled) return;
            const ctx = getContext(); if (!ctx) return;
            const now = ctx.currentTime;
            createOscillator('square', 600, now, 0.08, 0.2);
            createOscillator('square', 400, now + 0.08, 0.08, 0.18);
            createOscillator('square', 250, now + 0.16, 0.1, 0.15);
            createOscillator('square', 150, now + 0.26, 0.15, 0.1);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(100, now + 0.3);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.7);
            gain.gain.setValueAtTime(0.15, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(now + 0.3); osc.stop(now + 0.8);
            createNoise(now + 0.1, 0.4, 0.08);
        }
    };

    let onSoundPlayCallback = null;

    return {
        play: function(soundName) {
            try {
                if (sounds[soundName]) {
                    sounds[soundName]();
                    if (onSoundPlayCallback) onSoundPlayCallback(soundName);
                    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.notifySoundPlayed) {
                        window.electronAPI.notifySoundPlayed(soundName);
                    }
                }
            } catch (e) {
                console.warn('SoundSystem: Error playing sound', soundName, e);
            }
        },
        onSoundPlay: function(callback) { onSoundPlayCallback = callback; },
        setEnabled: function(isEnabled) {
            enabled = isEnabled;
            if (typeof localStorage !== 'undefined') localStorage.setItem('radgotchi-sounds-enabled', isEnabled);
        },
        isEnabled: function() { return enabled; },
        setVolume: function(vol) {
            volume = Math.max(0, Math.min(1, vol));
            if (masterGain) masterGain.gain.value = volume;
            if (typeof localStorage !== 'undefined') localStorage.setItem('radgotchi-sounds-volume', volume);
        },
        getVolume: function() { return volume; },
        init: function() {
            if (typeof localStorage !== 'undefined') {
                const savedEnabled = localStorage.getItem('radgotchi-sounds-enabled');
                if (savedEnabled !== null) enabled = savedEnabled === 'true';
                const savedVolume = localStorage.getItem('radgotchi-sounds-volume');
                if (savedVolume !== null) volume = parseFloat(savedVolume);
            }
        }
    };
})();

SoundSystem.init();

export default SoundSystem;

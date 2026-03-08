// ═══════════════════════════════════════════════════════════════════════════
// RADGOTCHI SOUND SYSTEM - Synthetic retro-tech audio
// ═══════════════════════════════════════════════════════════════════════════

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
        // Resume if suspended (autoplay policy)
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

    // ═══════════════════════════════════════════════════════════════════════
    // SOUND DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════

    const sounds = {
        // Chat panel opening - ascending digital chirp sequence
        chatOpen: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Quick ascending beeps
            createOscillator('square', 400, now, 0.06, 0.2);
            createOscillator('square', 600, now + 0.05, 0.06, 0.2);
            createOscillator('square', 800, now + 0.1, 0.08, 0.25);
            
            // Data burst noise
            createNoise(now + 0.08, 0.1, 0.08);
        },

        // Chat panel closing - descending tone
        chatClose: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('square', 600, now, 0.05, 0.15);
            createOscillator('square', 400, now + 0.04, 0.06, 0.12);
            createOscillator('square', 250, now + 0.09, 0.08, 0.1);
        },

        // Message sent - outgoing transmission blip
        messageSend: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Quick upward sweep
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.1);
            
            createNoise(now, 0.05, 0.05);
        },

        // Message received - incoming data ping
        messageReceive: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sine', 880, now, 0.08, 0.3);
            createOscillator('sine', 1100, now + 0.06, 0.1, 0.25);
            createNoise(now + 0.05, 0.08, 0.04);
        },

        // Click/pet interaction - satisfying electronic tap
        click: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('square', 220, now, 0.03, 0.25);
            createOscillator('sine', 440, now, 0.05, 0.2);
            createNoise(now, 0.03, 0.1);
        },

        // Sleep start - gentle descending lullaby
        sleepStart: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Soft descending tones
            createOscillator('sine', 600, now, 0.2, 0.15);
            createOscillator('sine', 500, now + 0.15, 0.2, 0.12);
            createOscillator('sine', 400, now + 0.3, 0.25, 0.1);
            createOscillator('sine', 300, now + 0.45, 0.3, 0.08);
        },

        // Sleep end - wake up ascending chime
        sleepEnd: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sine', 400, now, 0.1, 0.1);
            createOscillator('sine', 500, now + 0.08, 0.1, 0.12);
            createOscillator('sine', 700, now + 0.16, 0.12, 0.15);
            createOscillator('sine', 900, now + 0.25, 0.15, 0.18);
        },

        // Attention event start - urgent warning pulse
        attentionStart: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Alarm-like pulses
            for (let i = 0; i < 3; i++) {
                createOscillator('square', 800, now + i * 0.12, 0.08, 0.25);
                createOscillator('square', 600, now + i * 0.12 + 0.04, 0.06, 0.2);
            }
            createNoise(now, 0.4, 0.05);
        },

        // Attention resolved - success confirmation
        attentionEnd: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Triumphant ascending resolution
            createOscillator('sine', 523, now, 0.12, 0.2);        // C5
            createOscillator('sine', 659, now + 0.1, 0.12, 0.2);  // E5
            createOscillator('sine', 784, now + 0.2, 0.2, 0.25);  // G5
            createOscillator('triangle', 1047, now + 0.3, 0.3, 0.15); // C6
        },

        // Level up - achievement fanfare
        levelUp: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Triumphant arpeggio
            createOscillator('square', 523, now, 0.1, 0.15);       // C5
            createOscillator('square', 659, now + 0.08, 0.1, 0.15); // E5
            createOscillator('square', 784, now + 0.16, 0.1, 0.15); // G5
            createOscillator('square', 1047, now + 0.24, 0.2, 0.2); // C6
            createOscillator('sine', 1047, now + 0.24, 0.3, 0.1);   // Sustain
            createNoise(now + 0.2, 0.15, 0.05);
        },

        // Milestone achieved - data burst celebration
        milestone: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sawtooth', 400, now, 0.05, 0.15);
            createOscillator('sawtooth', 600, now + 0.04, 0.05, 0.15);
            createOscillator('square', 800, now + 0.08, 0.1, 0.2);
            createOscillator('sine', 1000, now + 0.15, 0.15, 0.15);
            createNoise(now + 0.1, 0.1, 0.04);
        },

        // Pomodoro start - focus mode activation
        pomodoroStart: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sine', 440, now, 0.15, 0.15);
            createOscillator('sine', 550, now + 0.12, 0.15, 0.15);
            createOscillator('sine', 660, now + 0.24, 0.2, 0.18);
        },

        // Pomodoro complete - session finished bell
        pomodoroComplete: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Bell-like tones
            createOscillator('sine', 880, now, 0.3, 0.2);
            createOscillator('sine', 1100, now, 0.25, 0.1);
            createOscillator('sine', 880, now + 0.35, 0.3, 0.15);
            createOscillator('sine', 1100, now + 0.35, 0.25, 0.08);
        },

        // XP gain - subtle positive feedback
        xpGain: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sine', 600, now, 0.04, 0.15);
            createOscillator('sine', 800, now + 0.03, 0.05, 0.12);
        },

        // XP loss - subtle negative feedback  
        xpLoss: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('sine', 400, now, 0.06, 0.15);
            createOscillator('sine', 300, now + 0.04, 0.08, 0.12);
        },

        // Stats panel opening - data retrieval sequence
        statsOpen: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Quick data access beeps
            createOscillator('square', 300, now, 0.04, 0.15);
            createOscillator('square', 500, now + 0.03, 0.04, 0.18);
            createOscillator('square', 700, now + 0.06, 0.06, 0.2);
            createNoise(now + 0.05, 0.08, 0.06);
        },

        // Stats panel closing - data dismiss
        statsClose: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('square', 500, now, 0.04, 0.12);
            createOscillator('square', 350, now + 0.03, 0.05, 0.1);
            createNoise(now + 0.02, 0.05, 0.04);
        },

        // Selection change - digital toggle blip
        selectChange: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            createOscillator('square', 440, now, 0.03, 0.18);
            createOscillator('sine', 660, now + 0.02, 0.04, 0.12);
        },

        // Chinese mode activation - synthesized gong
        gong: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // Deep resonant gong hit
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            
            // Fundamental tone with slight detune for richness
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(110, now);
            osc1.frequency.exponentialRampToValueAtTime(100, now + 1.5);
            
            // Harmonic overtone
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(220, now);
            osc2.frequency.exponentialRampToValueAtTime(200, now + 1.2);
            
            // Gong-like envelope - sharp attack, long decay
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.35, now + 0.01);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
            
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.15, now + 0.01);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            
            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(masterGain);
            gain2.connect(masterGain);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 2);
            osc2.stop(now + 1.5);
            
            // Metallic shimmer
            createNoise(now, 0.15, 0.08);
        },

        // English mode activation - synthesized eagle screech (patriotic!)
        eagleScreech: function() {
            if (!enabled) return;
            const ctx = getContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            // High pitched descending screech
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            
            // Primary screech - high frequency sweep down then up
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(2000, now);
            osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
            osc1.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
            osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.5);
            
            // Harmonic layer
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(1600, now);
            osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.12);
            osc2.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
            
            // Sharp attack, warbling sustain
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gain1.gain.setValueAtTime(0.15, now + 0.15);
            gain1.gain.linearRampToValueAtTime(0.2, now + 0.25);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.08, now + 0.02);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            
            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(masterGain);
            gain2.connect(masterGain);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.7);
            osc2.stop(now + 0.5);
            
            // Breath noise for realism
            createNoise(now, 0.25, 0.06);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════

    return {
        play: function(soundName) {
            try {
                if (sounds[soundName]) {
                    sounds[soundName]();
                }
            } catch (e) {
                console.warn('SoundSystem: Error playing sound', soundName, e);
            }
        },
        
        setEnabled: function(isEnabled) {
            enabled = isEnabled;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('radgotchi-sounds-enabled', isEnabled);
            }
        },
        
        isEnabled: function() {
            return enabled;
        },
        
        setVolume: function(vol) {
            volume = Math.max(0, Math.min(1, vol));
            if (masterGain) {
                masterGain.gain.value = volume;
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('radgotchi-sounds-volume', volume);
            }
        },
        
        getVolume: function() {
            return volume;
        },
        
        init: function() {
            // Load preferences from localStorage
            if (typeof localStorage !== 'undefined') {
                const savedEnabled = localStorage.getItem('radgotchi-sounds-enabled');
                if (savedEnabled !== null) {
                    enabled = savedEnabled === 'true';
                }
                const savedVolume = localStorage.getItem('radgotchi-sounds-volume');
                if (savedVolume !== null) {
                    volume = parseFloat(savedVolume);
                }
            }
        }
    };
})();

// Auto-init if in browser context
if (typeof window !== 'undefined') {
    SoundSystem.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundSystem;
}

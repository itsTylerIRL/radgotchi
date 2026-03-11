// Audio reactive system — listens to system audio and triggers pet reactions

import { setFace, getFaceEl } from './pet-sprites.js';
import { getAudioStatus, pick } from './status-text.js';
import { getIsSleeping, getIsWorking, getIsLocked } from './mood-engine.js';
import SoundSystem from './sounds.js';

const faceEl = getFaceEl();
const statusEl = document.getElementById('radgotchi-status');
const faceFlipWrapper = document.getElementById('face-flip-wrapper');

// Audio state
let audioListening = false;
let audioContext = null;
let audioAnalyser = null;
let audioStream = null;
let audioSource = null;
let audioAnimationFrame = null;
let lastAudioReaction = 0;
let currentAudioMode = null;
let audioReactionTimeout = null;
let audioHealthCheckInterval = null;
let consecutiveZeroFrames = 0;
let isRestartingAudio = false;
let lastMeaningfulAudioTime = 0;
let audioDebugCounter = 0;

const AUDIO_CONFIG = {
    VOLUME_THRESHOLD: 1,
    BASS_THRESHOLD: 1,
    MUSIC_BEAT_THRESHOLD: 0.4,
    VOICE_FREQUENCY_MIN: 85,
    VOICE_FREQUENCY_MAX: 255,
    MUSIC_BASS_MAX: 150,
    REACTION_COOLDOWN: 200,
    MODE_SWITCH_DELAY: 500,
    SILENCE_TIMEOUT: 2000,
    HEALTH_CHECK_INTERVAL: 2000,
    ZERO_FRAME_THRESHOLD: 120,
    RESTART_COOLDOWN: 3000,
    RESTART_MAX_RETRIES: 5,
    RESTART_BACKOFF_MAX: 60000
};

// Sustained volume tracking
let highVolumeStartTime = 0;
let isInHighVolume = false;
const HIGH_VOLUME_THRESHOLD = 100;
const BANGER_SUSTAIN_TIME = 5000;

function getAudioStatusTier(avgVolume) {
    const now = Date.now();
    if (avgVolume > HIGH_VOLUME_THRESHOLD) {
        if (!isInHighVolume) { isInHighVolume = true; highVolumeStartTime = now; }
    } else {
        isInHighVolume = false;
    }
    if (isInHighVolume && (now - highVolumeStartTime > BANGER_SUSTAIN_TIME)) return 'banger';
    if (avgVolume > HIGH_VOLUME_THRESHOLD) return 'high';
    if (avgVolume > 50) return 'medium';
    return 'low';
}

// Restart state
let lastRestartAttempt = 0;
let restartRetryCount = 0;
let restartRetryTimeout = null;

// Self-sound pause
let audioReactionPaused = false;
let audioReactionPauseTimeout = null;
const AUDIO_SELF_SOUND_PAUSE = 2500;

function pauseAudioReaction() {
    audioReactionPaused = true;
    if (audioReactionPauseTimeout) clearTimeout(audioReactionPauseTimeout);
    audioReactionPauseTimeout = setTimeout(() => { audioReactionPaused = false; }, AUDIO_SELF_SOUND_PAUSE);
}

// Register pause with SoundSystem and IPC
if (SoundSystem && SoundSystem.onSoundPlay) SoundSystem.onSoundPlay(pauseAudioReaction);
if (window.electronAPI && window.electronAPI.onSoundPlayed) window.electronAPI.onSoundPlayed(pauseAudioReaction);

// Vibe face rotation
const vibeFaces = ['cool', 'cool', 'look_l', 'cool', 'cool', 'look_r', 'cool', 'happy', 'cool', 'cool'];
let lastVibeFaceIndex = 0;
let lastVibeFaceChange = 0;
const VIBE_FACE_INTERVAL = 800;

// Beat detection
const BEAT_HISTORY_SIZE = 43;
const BEAT_THRESHOLD_MULTIPLIER = 1.6;
const BEAT_MIN_INTERVAL = 800;
const bassHistory = [];
let lastBeatTime = 0;

function detectBeat(bassEnergy) {
    const now = Date.now();
    bassHistory.push(bassEnergy);
    if (bassHistory.length > BEAT_HISTORY_SIZE) bassHistory.shift();
    if (bassHistory.length < BEAT_HISTORY_SIZE / 2) return false;
    const avgBass = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;
    if (bassEnergy > avgBass * BEAT_THRESHOLD_MULTIPLIER &&
        bassEnergy > 30 &&
        now - lastBeatTime > BEAT_MIN_INTERVAL) {
        lastBeatTime = now;
        return true;
    }
    return false;
}

// Direction control
let desiredLookDir = 'right';
let currentVibeFace = 'cool';
let lastDirectionChange = 0;
const DIRECTION_CHANGE_INTERVAL = 1500;

function getScaleForDirection(faceName, direction) {
    if (faceName === 'look_l') return direction === 'left' ? 1 : -1;
    if (faceName === 'look_r') return direction === 'left' ? -1 : 1;
    return direction === 'left' ? -1 : 1;
}

function applyVibeDirection() {
    if (!faceFlipWrapper) return;
    const scale = getScaleForDirection(currentVibeFace, desiredLookDir);
    faceFlipWrapper.style.setProperty('--flip-dir', scale);
    faceFlipWrapper.style.transform = `scaleX(${scale})`;
}

function flipDirection() {
    desiredLookDir = desiredLookDir === 'left' ? 'right' : 'left';
    lastDirectionChange = Date.now();
    applyVibeDirection();
}

function setVibeFace(faceName) {
    currentVibeFace = faceName;
    applyVibeDirection();
}

// Status update cooldown
let lastAudioStatusUpdate = 0;
const AUDIO_STATUS_COOLDOWN = 2000;

function reactToAudio(avgVolume, bassEnergy) {
    if (audioReactionPaused) return;
    if (getIsSleeping() || getIsWorking() || getIsLocked()) return;

    currentAudioMode = 'vibing';
    faceEl.classList.remove('rg-vibe', 'rg-headbob', 'rg-notes');
    faceEl.classList.add('rg-audio-music');
    faceFlipWrapper.classList.remove('rg-breathing', 'rg-breathing-slow');

    const now = Date.now();
    const shouldUpdateStatus = now - lastAudioStatusUpdate > AUDIO_STATUS_COOLDOWN;
    const shouldChangeFace = now - lastVibeFaceChange > VIBE_FACE_INTERVAL;

    const beatDetected = detectBeat(bassEnergy);
    const intervalElapsed = now - lastDirectionChange > DIRECTION_CHANGE_INTERVAL;
    if ((beatDetected && avgVolume > 50) || intervalElapsed) flipDirection();
    applyVibeDirection();

    if (avgVolume > 100) {
        faceEl.classList.remove('rg-vibe', 'rg-headbob');
        faceEl.classList.add('rg-dance');
        if (shouldChangeFace) {
            lastVibeFaceIndex = (lastVibeFaceIndex + 1) % vibeFaces.length;
            const f = vibeFaces[lastVibeFaceIndex];
            setFace(f); setVibeFace(f); lastVibeFaceChange = now;
        }
        if (shouldUpdateStatus) {
            const st = getAudioStatus();
            statusEl.textContent = pick(st[getAudioStatusTier(avgVolume)]);
            lastAudioStatusUpdate = now;
        }
    } else if (avgVolume > 50) {
        faceEl.classList.remove('rg-dance', 'rg-headbob');
        faceEl.classList.add('rg-vibe');
        if (shouldChangeFace) {
            lastVibeFaceIndex = (lastVibeFaceIndex + 1) % vibeFaces.length;
            const f = vibeFaces[lastVibeFaceIndex];
            setFace(f); setVibeFace(f); lastVibeFaceChange = now;
        }
        if (shouldUpdateStatus) {
            const st = getAudioStatus();
            statusEl.textContent = pick(st[getAudioStatusTier(avgVolume)]);
            lastAudioStatusUpdate = now;
        }
    } else {
        faceEl.classList.remove('rg-dance', 'rg-vibe');
        faceEl.classList.add('rg-headbob');
        setFace('happy');
        if (shouldUpdateStatus) { statusEl.textContent = 'CHILLIN'; lastAudioStatusUpdate = now; }
    }
}

function analyzeAudio() {
    if (!audioListening || !audioAnalyser) return;
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
    if (audioReactionPaused) {
        audioAnimationFrame = requestAnimationFrame(analyzeAudio);
        return;
    }

    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audioAnalyser.getByteFrequencyData(dataArray);

    let sum = 0, hasAnyData = false;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
        if (dataArray[i] > 0) hasAnyData = true;
    }
    const avgVolume = sum / bufferLength;

    audioDebugCounter++;
    if (audioDebugCounter >= 120) {
        audioDebugCounter = 0;
        const secsSinceMeaningful = lastMeaningfulAudioTime ? ((Date.now() - lastMeaningfulAudioTime) / 1000).toFixed(1) : 'never';
        console.log('Audio levels - avgVolume:', avgVolume.toFixed(1), 'hasData:', hasAnyData, 'consecutiveZero:', consecutiveZeroFrames, 'lastMeaningful:', secsSinceMeaningful + 's ago');
    }

    if (avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD) lastMeaningfulAudioTime = Date.now();
    if (!hasAnyData && sum === 0) consecutiveZeroFrames++;
    else consecutiveZeroFrames = 0;

    const bassEnd = Math.floor(AUDIO_CONFIG.MUSIC_BASS_MAX / (audioContext.sampleRate / audioAnalyser.fftSize));
    let bassSum = 0;
    for (let i = 0; i < Math.min(bassEnd, bufferLength); i++) bassSum += dataArray[i];
    const bassEnergy = bassSum / Math.min(bassEnd, bufferLength);

    const now = Date.now();

    if (avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD) {
        lastAudioReaction = now;
        reactToAudio(avgVolume, bassEnergy);
    } else {
        if (now - lastAudioReaction > AUDIO_CONFIG.SILENCE_TIMEOUT && currentAudioMode) {
            currentAudioMode = null;
            faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes', 'rg-audio-music', 'rg-audio-voice');
            faceFlipWrapper.classList.add('rg-breathing');
            desiredLookDir = 'right'; currentVibeFace = 'cool'; lastDirectionChange = 0;
            if (!getIsLocked() && !getIsSleeping() && !getIsWorking()) {
                setFace('awake');
                const st = getAudioStatus();
                statusEl.textContent = pick(st.silent);
            }
        }
    }

    // Broadcast audio levels to chat equalizer
    if (window.electronAPI && window.electronAPI.sendAudioLevels) {
        const bands = 32;
        const bandSize = Math.floor(bufferLength / bands);
        const levels = [];
        for (let i = 0; i < bands; i++) {
            let s = 0;
            for (let j = 0; j < bandSize; j++) s += dataArray[i * bandSize + j];
            levels.push(s / bandSize);
        }
        window.electronAPI.sendAudioLevels({ levels, isActive: avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD, avgVolume });
    }

    audioAnimationFrame = requestAnimationFrame(analyzeAudio);
}

function startAudioHealthCheck() {
    if (audioHealthCheckInterval) clearInterval(audioHealthCheckInterval);
    audioHealthCheckInterval = setInterval(() => {
        if (!audioListening) return;
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
            return;
        }
        if (audioContext && audioContext.state === 'closed') { scheduleAudioRestart(); return; }
        if (audioStream) {
            const tracks = audioStream.getAudioTracks();
            if (tracks.length > 0 && tracks.every(t => t.readyState === 'ended')) { scheduleAudioRestart(); return; }
        }
    }, AUDIO_CONFIG.HEALTH_CHECK_INTERVAL);
}

function stopAudioHealthCheck() {
    if (audioHealthCheckInterval) { clearInterval(audioHealthCheckInterval); audioHealthCheckInterval = null; }
}

function stopAudioListeningInternal() {
    audioListening = false;
    currentAudioMode = null;
    consecutiveZeroFrames = 0;
    if (audioAnimationFrame) { cancelAnimationFrame(audioAnimationFrame); audioAnimationFrame = null; }
    if (audioReactionTimeout) { clearTimeout(audioReactionTimeout); audioReactionTimeout = null; }
    if (audioSource) { try { audioSource.disconnect(); } catch(e) {} audioSource = null; }
    if (audioStream) {
        audioStream.getTracks().forEach(t => { t.onended = null; t.stop(); });
        audioStream = null;
    }
    if (audioContext) {
        audioContext.onstatechange = null;
        try { audioContext.close(); } catch(e) {}
        audioContext = null; audioAnalyser = null;
    }
    faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes', 'rg-audio-music', 'rg-audio-voice');
}

function scheduleAudioRestart() {
    if (isRestartingAudio) return;
    const now = Date.now();
    const backoffDelay = Math.min(
        AUDIO_CONFIG.RESTART_COOLDOWN * Math.pow(2, restartRetryCount),
        AUDIO_CONFIG.RESTART_BACKOFF_MAX
    );
    if (now - lastRestartAttempt < backoffDelay) {
        if (!restartRetryTimeout) {
            restartRetryTimeout = setTimeout(() => { restartRetryTimeout = null; scheduleAudioRestart(); }, backoffDelay - (now - lastRestartAttempt) + 100);
        }
        return;
    }
    isRestartingAudio = true;
    lastRestartAttempt = now;
    stopAudioListeningInternal();
    setTimeout(() => {
        isRestartingAudio = false;
        startAudioListening().then(success => {
            if (success) { restartRetryCount = 0; }
            else {
                restartRetryCount++;
                if (restartRetryCount <= AUDIO_CONFIG.RESTART_MAX_RETRIES) {
                    scheduleAudioRestart();
                } else {
                    restartRetryTimeout = setTimeout(() => { restartRetryTimeout = null; restartRetryCount = 0; scheduleAudioRestart(); }, AUDIO_CONFIG.RESTART_BACKOFF_MAX);
                }
            }
        });
    }, 1000);
}

async function startAudioListening() {
    if (audioListening) return true;
    if (isRestartingAudio) return false;
    try {
        audioStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        audioStream.getVideoTracks().forEach(t => t.stop());
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.error('System audio capture returned no audio tracks.');
            return false;
        }
        audioTracks.forEach(t => { t.onended = () => scheduleAudioRestart(); });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();
        audioContext.onstatechange = () => {
            if (audioContext.state === 'suspended' && audioListening) audioContext.resume().catch(() => {});
            else if (audioContext.state === 'closed' && audioListening) scheduleAudioRestart();
        };
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 512;
        audioAnalyser.smoothingTimeConstant = 0.5;
        audioAnalyser.minDecibels = -90;
        audioAnalyser.maxDecibels = -10;
        audioSource = audioContext.createMediaStreamSource(audioStream);
        audioSource.connect(audioAnalyser);
        audioListening = true;
        consecutiveZeroFrames = 0;
        audioDebugCounter = 0;
        lastMeaningfulAudioTime = Date.now();
        startAudioHealthCheck();
        analyzeAudio();
        const st = getAudioStatus();
        statusEl.textContent = pick(st.silent);
        return true;
    } catch (err) {
        console.error('System audio capture failed:', err.message);
        return false;
    }
}

function stopAudioListening() {
    stopAudioHealthCheck();
    stopAudioListeningInternal();
    restartRetryCount = 0;
    if (restartRetryTimeout) { clearTimeout(restartRetryTimeout); restartRetryTimeout = null; }
}

export function setAudioListening(enabled) {
    if (enabled) {
        return startAudioListening().then(ok => {
            if (!ok) scheduleAudioRestart();
            return ok;
        });
    }
    stopAudioListening();
    return Promise.resolve(true);
}

export function isListeningAudio() { return audioListening; }

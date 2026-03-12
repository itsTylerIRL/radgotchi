// Core mood engine — state management, mood setter, idle routines, sleep/work

import { faces, setFace, clearAnimations, applyAnimation, startSleepZ, stopSleepZ, negativeMoods, spawnClickRipple, getContainer } from './pet-sprites.js';
import { getStatusText, getLanguage, pick } from './status-text.js';
import SoundSystem from './sounds.js';

const faceEl = document.getElementById('radgotchi-face');
const statusEl = document.getElementById('radgotchi-status');
const container = document.getElementById('radgotchi-container');

// === State ===
let mood = 'awake';
let lastMood = 'awake';
let locked = false;
let moodTimer = null;
let lastInteractTime = Date.now();
let hoverActive = false;
let petCount = 0;
let clickCount = 0;
let clickTimer = null;
let currentRoutine = null;
let idleStep = 0;
let routineTimer = null;
let isSleeping = false;
let isWorking = false;
let currentLevel = 1;

// === Level Unlocks ===
const LEVEL_UNLOCKS = {
    SMART_REACTIONS: 5,
    DEBUG_MODE: 10,
    INTENSE_REACTIONS: 15,
    ELITE_STATUS: 20,
    LEGENDARY: 25
};

// === Getters ===
export function getMood() { return mood; }
export function getIsSleeping() { return isSleeping; }
export function getIsWorking() { return isWorking; }
export function getIsLocked() { return locked; }
export function getLevel() { return currentLevel; }
export function setLevel(lvl) { currentLevel = lvl; }
export function getPetCount() { return petCount; }

// === Timer Helpers ===
function stopRoutine() {
    currentRoutine = null;
    idleStep = 0;
    if (routineTimer) { clearTimeout(routineTimer); routineTimer = null; }
}

// === Core Mood Setter ===
export function setMood(newMood, opts = {}) {
    opts = Object.assign({ duration: 0, anim: '', status: '', priority: false }, opts);

    if (locked && !opts.priority) return;
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
    if (opts.priority) locked = true;

    lastMood = mood;
    mood = newMood;

    if (isSleeping || isWorking) return;

    if (faces[mood]) setFace(mood);

    const st = getStatusText();
    const text = opts.status || pick(st[mood] || st.awake);
    statusEl.textContent = text;
    statusEl.style.display = '';

    clearAnimations();
    if (opts.anim) applyAnimation(opts.anim);

    if (negativeMoods.includes(mood)) faceEl.classList.add('rg-sad');
    else faceEl.classList.remove('rg-sad');

    if (mood === 'sleep' || mood === 'sleep2') startSleepZ();
    else stopSleepZ();

    if (opts.duration > 0) {
        moodTimer = setTimeout(() => {
            locked = false;
            setMood('awake', { anim: 'rg-wiggle' });
        }, opts.duration);
    } else if (opts.priority) {
        moodTimer = setTimeout(() => { locked = false; }, 10000);
    }
}

// === Event Reactor ===
export function react(level, msg) {
    if (locked) return;
    stopRoutine();
    lastInteractTime = Date.now();
    const msgLower = (msg || '').toLowerCase();
    const zh = getLanguage() === 'zh';

    if (level === 'critical') {
        setMood('angry', { duration: 6000, anim: 'rg-shake', priority: true,
            status: zh ? '威胁严重' : 'THREAT CRITICAL' });
        return;
    }
    if (level === 'warning') {
        setMood('intense', { duration: 3500, anim: 'rg-shake',
            status: zh ? '警报激活' : 'ALERT ACTIVE' });
        return;
    }
    if (msgLower.includes('offline') || msgLower.includes('down')) {
        setMood('sad', { duration: 4000, status: zh ? '资产离线' : 'ASSET OFFLINE' });
    } else if (msgLower.includes('online') || msgLower.includes('started')) {
        setMood('excited', { duration: 2500, anim: 'rg-bounce', status: zh ? '连接恢复' : 'CONTACT RESTORED' });
    } else if (msgLower.includes('cpu') && (msgLower.includes('high') || msgLower.includes('spike'))) {
        setMood('intense', { duration: 3000, anim: 'rg-shake', status: zh ? 'CPU飙升' : 'CPU SPIKE' });
    } else if (msgLower.includes('memory') && (msgLower.includes('high') || msgLower.includes('pressure'))) {
        setMood('intense', { duration: 3000, anim: 'rg-pulse', status: zh ? '内存压力' : 'MEM PRESSURE' });
    } else if (msgLower.includes('sync') || msgLower.includes('upload') || msgLower.includes('transfer')) {
        setMood('upload', { duration: 3500, anim: 'rg-upload', status: zh ? '数据传输' : 'DATA TRANSFER' });
    } else if (msgLower.includes('debug') || msgLower.includes('trace')) {
        setMood('debug', { duration: 2500, anim: 'rg-nod', status: zh ? '调试模式' : 'DEBUG MODE' });
    } else if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('crash')) {
        setMood('broken', { duration: 3500, anim: 'rg-shake', status: zh ? '检测到错误' : 'ERROR DETECTED' });
    } else if (level === 'info' && Math.random() < 0.25) {
        setMood(pick(['happy', 'excited', 'cool', 'motivated']), { duration: 1800, anim: 'rg-bounce' });
    } else if (level === 'ok' && Math.random() < 0.4) {
        setMood('happy', { duration: 1500, anim: 'rg-bounce', status: zh ? '一切正常' : 'ALL CLEAR' });
    }
}

// === Idle Routines ===
const idleRoutines = [
    { name: 'patrol', steps: ['look_l','awake','look_r','awake','look_l_happy','awake'], stepTime: 1500,
      anim: ['rg-peek-l','','rg-peek-r','','rg-peek-l','rg-wiggle'] },
    { name: 'study', steps: ['smart','smart','debug','smart','excited'], stepTime: 2000,
      anim: ['rg-nod','','rg-nod','rg-pulse','rg-bounce'] },
    { name: 'vibe', steps: ['cool','cool','happy','cool','motivated'], stepTime: 2200,
      anim: ['rg-float','','rg-wiggle','rg-float','rg-bounce'] },
    { name: 'restless', steps: ['bored','look_l','look_r','bored','demotivated','bored'], stepTime: 1800,
      anim: ['','rg-peek-l','rg-peek-r','','rg-nod',''] },
    { name: 'workout', steps: ['motivated','intense','motivated','excited','happy','cool'], stepTime: 1400,
      anim: ['rg-bounce','rg-shake','rg-bounce','rg-pulse','rg-wiggle','rg-float'] },
    { name: 'nap_prep', steps: ['bored','bored','sleep','sleep2','sleep','sleep2','sleep','awake'], stepTime: 2500,
      anim: ['','rg-nod','rg-sleep','rg-sleep','rg-sleep','rg-sleep','rg-sleep','rg-bounce'] },
    { name: 'hack', steps: ['debug','smart','debug','intense','debug','excited'], stepTime: 1600,
      anim: ['rg-nod','rg-pulse','rg-nod','rg-shake','rg-nod','rg-bounce'] },
    { name: 'social', steps: ['look_l','friend','happy','look_r','friend','grateful'], stepTime: 1800,
      anim: ['rg-peek-l','rg-bounce','rg-wiggle','rg-peek-r','rg-bounce','rg-nod'] },
    { name: 'upload_cycle', steps: ['upload','upload1','upload2','upload1','upload2','happy'], stepTime: 800,
      anim: ['rg-upload','rg-upload','rg-upload','rg-upload','rg-upload','rg-bounce'] },
    { name: 'existential', steps: ['smart','lonely','sad','smart','bored','cool'], stepTime: 2200,
      anim: ['rg-nod','','','rg-nod','','rg-float'] },
    { name: 'analyst', minLevel: 5, steps: ['smart','debug','smart','intense','smart','cool'], stepTime: 1800,
      anim: ['rg-nod','rg-pulse','rg-nod','rg-shake','rg-nod','rg-float'] },
    { name: 'deepdive', minLevel: 10, steps: ['debug','debug','intense','debug','smart','excited'], stepTime: 2000,
      anim: ['rg-nod','rg-pulse','rg-shake','rg-nod','rg-pulse','rg-spin'] },
    { name: 'tactical', minLevel: 15, steps: ['intense','look_l','intense','look_r','motivated','cool'], stepTime: 1400,
      anim: ['rg-pulse','rg-peek-l','rg-shake','rg-peek-r','rg-bounce','rg-float'] },
    { name: 'elite_ops', minLevel: 20, steps: ['cool','intense','debug','motivated','cool','smart','cool'], stepTime: 1600,
      anim: ['rg-float','rg-shake','rg-pulse','rg-bounce','rg-float','rg-nod','rg-spin'] },
    { name: 'legendary', minLevel: 25, steps: ['cool','debug','intense','smart','motivated','cool','excited'], stepTime: 1500,
      anim: ['rg-spin','rg-pulse','rg-shake','rg-nod','rg-bounce','rg-float','rg-spin'] }
];

function runRoutineStep() {
    if (!currentRoutine) return;
    if (idleStep >= currentRoutine.steps.length) {
        stopRoutine();
        setMood('awake', { anim: 'rg-wiggle' });
        return;
    }
    setMood(currentRoutine.steps[idleStep], { anim: currentRoutine.anim[idleStep] || '' });
    idleStep++;
    routineTimer = setTimeout(runRoutineStep, currentRoutine.stepTime);
}

function startIdleRoutine() {
    if (locked || currentRoutine) return;
    let pool = idleRoutines.filter(r => !r.minLevel || currentLevel >= r.minLevel);
    const hour = new Date().getHours();
    const isNight = hour >= 23 || hour < 6;

    if (isNight) {
        const nap = pool.find(r => r.name === 'nap_prep');
        if (nap) { pool.push(nap); pool.push(nap); }
    }

    // Boost level-gated routines so higher-level pets show off more
    const gated = pool.filter(r => r.minLevel && currentLevel >= r.minLevel);
    for (const r of gated) {
        pool.push(r); // double weight for unlocked advanced routines
    }
    pool = pool.filter(Boolean);
    currentRoutine = pick(pool);
    idleStep = 0;
    runRoutineStep();
}

function idleCheck() {
    const idleTime = Date.now() - lastInteractTime;
    if (currentRoutine || locked) return;
    if (idleTime > 120000) {
        const isNight = new Date().getHours() >= 23 || new Date().getHours() < 6;
        if (isNight || Math.random() < 0.5) {
            setMood(pick(['sleep', 'sleep2']), { anim: 'rg-sleep' });
        } else {
            setMood('lonely', { status: getLanguage() === 'zh' ? '等待接触' : 'AWAITING CONTACT' });
        }
        return;
    }
    if (idleTime > 15000 && ['awake', 'bored', 'cool'].includes(mood)) {
        if (Math.random() < 0.65) { startIdleRoutine(); return; }
    }
    if (idleTime < 15000) {
        if (Math.random() < 0.15) startIdleRoutine();
        else if (Math.random() < 0.13) setMood(pick(['smart','cool','motivated','debug']), { duration: 2000, anim: 'rg-nod' });
    }
}

setInterval(idleCheck, 6000);

// === Mouse Interaction ===
let lastTrackTime = 0;
document.addEventListener('mousemove', (e) => {
    if (locked || hoverActive || currentRoutine) return;
    if (mood.startsWith('sleep') || mood === 'broken') return;
    const now = Date.now();
    if (now - lastTrackTime < 200) return;
    lastTrackTime = now;
    const rect = faceEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const deltaX = e.clientX - centerX;
    if (Math.abs(deltaX) < 250) {
        const threshold = rect.width * 0.4;
        const isHappy = ['happy', 'excited', 'grateful'].includes(mood);
        if (deltaX < -threshold) setMood(isHappy ? 'look_l_happy' : 'look_l');
        else if (deltaX > threshold) setMood(isHappy ? 'look_r_happy' : 'look_r');
        else if (mood.startsWith('look_')) setMood('awake');
    }
});

container.addEventListener('mouseenter', () => {
    hoverActive = true;
    lastInteractTime = Date.now();
    stopRoutine();
    if (mood.startsWith('sleep')) {
        setMood('awake', { anim: 'rg-bounce', status: getLanguage() === 'zh' ? '已唤醒' : 'AWAKENED' });
    } else if (['bored', 'lonely', 'demotivated'].includes(mood)) {
        setMood('happy', { anim: 'rg-wiggle', status: getLanguage() === 'zh' ? '有人来了' : 'CONTACT MADE' });
    } else if (!locked) {
        setMood('happy', { anim: 'rg-wiggle' });
    }
});

container.addEventListener('mouseleave', () => {
    hoverActive = false;
    if (!locked && ['happy', 'excited', 'grateful'].includes(mood)) setMood('awake');
});

// Click on face
faceEl.addEventListener('click', (e) => {
    lastInteractTime = Date.now();
    stopRoutine();
    SoundSystem.play('click');

    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 400);

    const rect = container.getBoundingClientRect();
    spawnClickRipple(e.clientX - rect.left, e.clientY - rect.top);

    if (clickCount >= 5) {
        setMood('angry', { duration: 3000, anim: 'rg-shake', priority: true,
            status: getLanguage() === 'zh' ? '输入过多' : 'EXCESSIVE INPUT' });
        clickCount = 0;
        return;
    }
    if (clickCount >= 3) {
        setMood('excited', { duration: 2000, anim: 'rg-bounce',
            status: getLanguage() === 'zh' ? '快速接触' : 'RAPID CONTACT' });
        return;
    }

    petCount++;
    const lang = getLanguage();
    const reactionsEN = [
        { m: 'happy', a: 'rg-bounce', s: 'CONTACT CONFIRMED' },
        { m: 'excited', a: 'rg-wiggle', s: 'GOOD CONTACT' },
        { m: 'grateful', a: 'rg-nod', s: 'ACKNOWLEDGED' },
        { m: 'cool', a: 'rg-float', s: 'APPRECIATED' },
        { m: 'motivated', a: 'rg-pulse', s: 'ENERGIZED' },
        { m: 'friend', a: 'rg-bounce', s: 'ALLY CONFIRMED' },
        { m: 'happy', a: 'rg-wiggle', s: 'RAPPORT ++' },
        { m: 'excited', a: 'rg-bounce', s: 'MORALE BOOST' }
    ];
    const reactionsZH = [
        { m: 'happy', a: 'rg-bounce', s: '接触确认' },
        { m: 'excited', a: 'rg-wiggle', s: '良好接触' },
        { m: 'grateful', a: 'rg-nod', s: '已收到' },
        { m: 'cool', a: 'rg-float', s: '已感谢' },
        { m: 'motivated', a: 'rg-pulse', s: '充能完毕' },
        { m: 'friend', a: 'rg-bounce', s: '盟友确认' },
        { m: 'happy', a: 'rg-wiggle', s: '好感 ++' },
        { m: 'excited', a: 'rg-bounce', s: '士气提升' }
    ];
    const reaction = pick(lang === 'zh' ? reactionsZH : reactionsEN);
    setMood(reaction.m, { duration: 2000, anim: reaction.a, status: reaction.s });

    // Level-gated bonus reactions
    if (currentLevel >= LEVEL_UNLOCKS.LEGENDARY && Math.random() < 0.15) {
        const pool = lang === 'zh'
            ? [{ m:'intense',a:'rg-pulse',s:'顶级特工' },{ m:'debug',a:'rg-float',s:'全知全能' },{ m:'smart',a:'rg-spin',s:'超越极限' },{ m:'cool',a:'rg-pulse',s:'传奇状态' }]
            : [{ m:'intense',a:'rg-pulse',s:'APEX OPERATOR' },{ m:'debug',a:'rg-float',s:'OMNISCIENT' },{ m:'smart',a:'rg-spin',s:'TRANSCENDENT' },{ m:'cool',a:'rg-pulse',s:'LEGENDARY STATUS' }];
        const r = pick(pool);
        setTimeout(() => setMood(r.m, { duration: 2500, anim: r.a, status: r.s, priority: true }), 300);
    } else if (currentLevel >= LEVEL_UNLOCKS.ELITE_STATUS && Math.random() < 0.18) {
        const pool = lang === 'zh'
            ? [{ m:'cool',a:'rg-float',s:'精英行动' },{ m:'motivated',a:'rg-pulse',s:'老兵状态' },{ m:'smart',a:'rg-nod',s:'资深分析师' }]
            : [{ m:'cool',a:'rg-float',s:'ELITE OPS' },{ m:'motivated',a:'rg-pulse',s:'VETERAN STATUS' },{ m:'smart',a:'rg-nod',s:'SENIOR ANALYST' }];
        const r = pick(pool);
        setTimeout(() => setMood(r.m, { duration: 2000, anim: r.a, status: r.s }), 300);
    } else if (currentLevel >= LEVEL_UNLOCKS.INTENSE_REACTIONS && Math.random() < 0.2) {
        const pool = lang === 'zh'
            ? [{ m:'intense',a:'rg-pulse',s:'全神贯注' },{ m:'motivated',a:'rg-bounce',s:'久经沙场' }]
            : [{ m:'intense',a:'rg-pulse',s:'LOCKED IN' },{ m:'motivated',a:'rg-bounce',s:'HARDENED' }];
        const r = pick(pool);
        setTimeout(() => setMood(r.m, { duration: 2000, anim: r.a, status: r.s }), 300);
    } else if (currentLevel >= LEVEL_UNLOCKS.DEBUG_MODE && Math.random() < 0.22) {
        const pool = lang === 'zh'
            ? [{ m:'debug',a:'rg-nod',s:'深度分析' },{ m:'smart',a:'rg-float',s:'模式识别' }]
            : [{ m:'debug',a:'rg-nod',s:'DEEP ANALYSIS' },{ m:'smart',a:'rg-float',s:'PATTERN RECOGNIZED' }];
        const r = pick(pool);
        setTimeout(() => setMood(r.m, { duration: 2000, anim: r.a, status: r.s }), 300);
    } else if (currentLevel >= LEVEL_UNLOCKS.SMART_REACTIONS && Math.random() < 0.25) {
        const pool = lang === 'zh'
            ? [{ m:'smart',a:'rg-nod',s:'计算中' },{ m:'smart',a:'rg-pulse',s:'数据洞察' }]
            : [{ m:'smart',a:'rg-nod',s:'CALCULATING' },{ m:'smart',a:'rg-pulse',s:'DATA INSIGHT' }];
        const r = pick(pool);
        setTimeout(() => setMood(r.m, { duration: 1800, anim: r.a, status: r.s }), 300);
    }

    // Milestone reactions
    const lang2 = getLanguage();
    if (petCount === 10) setTimeout(() => setMood('excited', { duration: 2500, anim: 'rg-spin', status: lang2 === 'zh' ? '10次接触！' : '10 CONTACTS!' }), 500);
    else if (petCount === 50) setTimeout(() => setMood('grateful', { duration: 3000, anim: 'rg-spin', status: lang2 === 'zh' ? '50次接触！' : '50 CONTACTS!' }), 500);
    else if (petCount === 100) setTimeout(() => setMood('motivated', { duration: 3500, anim: 'rg-pulse', status: lang2 === 'zh' ? '百次达成！' : 'CENTURY MARK!' }), 500);
    else if (petCount % 25 === 0 && petCount > 100) setTimeout(() => setMood('cool', { duration: 2000, anim: 'rg-bounce', status: lang2 === 'zh' ? petCount + ' 次！' : petCount + ' STRONG' }), 500);
});

faceEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    lastInteractTime = Date.now();
    stopRoutine();
    setMood('excited', { duration: 2000, anim: 'rg-spin',
        status: getLanguage() === 'zh' ? '紧急规避' : 'EVASIVE MANEUVER' });
});

// === Sleep Mode ===
export function setSleep(sleeping) {
    isSleeping = sleeping;
    if (sleeping) {
        SoundSystem.play('sleepStart');
        setFace('sleep');
        const st = getStatusText();
        statusEl.textContent = pick(st.sleep);
        container.classList.add('sleeping');
    } else {
        SoundSystem.play('sleepEnd');
        container.classList.remove('sleeping');
        setFace('awake');
        const st = getStatusText();
        statusEl.textContent = pick(st.awake);
    }
}

export function setSleepAnimation(animation) {
    if (!isSleeping) return;
    if (faces[animation]) setFace(animation);
    const st = getStatusText();
    statusEl.textContent = pick(st[animation] || st.sleep);
}

// === Work Mode ===
export function setWork(working) {
    isWorking = working;
    if (working) {
        if (isSleeping) setSleep(false);
        container.classList.add('working');
        setFace('smart');
        const st = getStatusText();
        statusEl.textContent = pick(st.smart);
    } else {
        container.classList.remove('working');
        setFace('happy');
        const st = getStatusText();
        statusEl.textContent = pick(st.happy);
    }
}

export function setWorkAnimation(animation) {
    if (!isWorking) return;
    if (faces[animation]) setFace(animation);
    const st = getStatusText();
    statusEl.textContent = pick(st[animation] || st.smart);
}

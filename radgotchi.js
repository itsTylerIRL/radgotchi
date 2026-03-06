/**
 * RADGOTCHI — Virtual Pet Module
 * Standalone desktop version
 */

const RG = (function() {
    'use strict';

    // === DOM Elements ===
    const container = document.getElementById('radgotchi-container');
    const faceEl = document.getElementById('radgotchi-face');
    const statusEl = document.getElementById('radgotchi-status');

    // === Sprite Paths (25 states) ===
    const faces = {
        awake: 'assets/AWAKE.png',
        happy: 'assets/HAPPY.png',
        excited: 'assets/EXCITED.png',
        cool: 'assets/COOL.png',
        grateful: 'assets/GRATEFUL.png',
        motivated: 'assets/MOTIVATED.png',
        friend: 'assets/FRIEND.png',
        look_l: 'assets/LOOK_L.png',
        look_r: 'assets/LOOK_R.png',
        look_l_happy: 'assets/LOOK_L_HAPPY.png',
        look_r_happy: 'assets/LOOK_R_HAPPY.png',
        smart: 'assets/SMART.png',
        intense: 'assets/INTENSE.png',
        debug: 'assets/DEBUG.png',
        bored: 'assets/BORED.png',
        sad: 'assets/SAD.png',
        angry: 'assets/ANGRY.png',
        lonely: 'assets/LONELY.png',
        demotivated: 'assets/DEMOTIVATED.png',
        broken: 'assets/BROKEN.png',
        sleep: 'assets/SLEEP.png',
        sleep2: 'assets/SLEEP2.png',
        upload: 'assets/UPLOAD.png',
        upload1: 'assets/UPLOAD1.png',
        upload2: 'assets/UPLOAD2.png'
    };

    // === Status Text Messages (themed) ===
    const statusText = {
        awake: ['SIGINT NOMINAL', 'OVERWATCH ACTIVE', 'ALL VECTORS CLEAR', 'SYSTEMS ONLINE', 'AWAITING ORDERS'],
        happy: ['ASSET VERIFIED', 'OPS NOMINAL', 'CLEARANCE GRANTED', 'MISSION SUCCESS', 'ALL CLEAR'],
        excited: ['HIGH ALERT', 'CONTACT ACQUIRED', 'TARGET LOCKED', 'SIGNAL STRONG', 'INTERCEPT READY'],
        cool: ['CHILL MODE', 'STEALTH ENABLED', 'LOW PROFILE', 'DARK RUNNING', 'COVERT OPS'],
        grateful: ['APPRECIATED', 'RAPPORT BUILT', 'TRUST VERIFIED', 'BOND CONFIRMED', 'ALLY RECOGNIZED'],
        motivated: ['PRIMED', 'COMBAT READY', 'WEAPONS HOT', 'STANDING BY', 'MISSION PREP'],
        friend: ['HANDSHAKE OK', 'LINK SECURE', 'COMMS UP', 'ALLY ONLINE', 'CHANNEL OPEN'],
        look_l: ['SCANNING LEFT', 'PERIMETER CHECK', 'VISUAL SWEEP', 'SECTOR SCAN'],
        look_r: ['SCANNING RIGHT', 'FLANK CHECK', 'VISUAL SWEEP', 'SECTOR SCAN'],
        look_l_happy: ['FRIENDLY LEFT', 'ALLY SPOTTED', 'GOOD VIBES', 'POSITIVE ID'],
        look_r_happy: ['FRIENDLY RIGHT', 'ALLY SPOTTED', 'GOOD VIBES', 'POSITIVE ID'],
        smart: ['ANALYZING', 'DATA CRUNCH', 'PATTERN MATCH', 'DECODE ACTIVE', 'PROCESSING'],
        intense: ['HIGH ALERT', 'THREAT NEARBY', 'CAUTION', 'ELEVATED STATUS', 'WATCHFUL'],
        debug: ['FORENSIC MODE', 'STACK TRACE', 'ROOT CAUSE', 'DEEP SCAN', 'DIAGNOSTICS'],
        bored: ['IDLE STATE', 'NO SIGNALS', 'QUIET SECTOR', 'LOW ACTIVITY', 'STANDBY'],
        sad: ['SIGNAL LOST', 'ASSET DOWN', 'MORALE LOW', 'DARK COMMS', 'OFFLINE'],
        angry: ['DEFCON 1', 'HOSTILE ACT', 'COMPROMISE', 'RED ALERT', 'BREACH'],
        lonely: ['NO UPLINK', 'ZERO CONTACTS', 'COMMS DARK', 'BLACKOUT', 'ISOLATED'],
        demotivated: ['LOW MORALE', 'MISSION DOUBT', 'FATIGUE', 'BURNOUT', 'WEARY'],
        broken: ['SYSTEM FAIL', 'INTEGRITY LOSS', 'CRITICAL ERR', 'CONTAINMENT', 'MALFUNCTION'],
        sleep: ['DORMANT OPS', 'LOW POWER', 'PASSIVE MODE', 'REST CYCLE', 'DREAM STATE'],
        sleep2: ['DEEP SLEEP', 'HIBERNATING', 'RECHARGING', 'STANDBY LOW', 'RECOVERY'],
        upload: ['EXFIL START', 'DATA BURST', 'TRANSMITTING', 'UPLINK ACTIVE', 'SYNC BEGIN'],
        upload1: ['EXFIL CONT', 'BURST MODE', 'TX IN PROG', 'UPLOADING', 'SYNC 50%'],
        upload2: ['EXFIL DONE', 'BURST SENT', 'TX COMPLETE', 'UPLOAD OK', 'SYNC 100%']
    };

    // === Negative Moods (for sad filter) ===
    const negativeMoods = ['sad', 'angry', 'broken', 'lonely', 'demotivated'];

    // === System Event Status Messages ===
    const systemEventStatus = {
        'cpu-spike': ['CPU MAXED', 'PROC OVERLOAD', 'COMPUTE SPIKE', 'THERMAL EVENT', 'THROTTLE RISK'],
        'cpu-high': ['HIGH LOAD', 'PROCESSING', 'BUSY CYCLE', 'HEAVY OPS', 'CRUNCHING'],
        'cpu-normal': ['LOAD CLEAR', 'CPU STABLE', 'CYCLES FREE', 'PROC NOMINAL'],
        'memory-high': ['RAM PRESSURE', 'MEM CRITICAL', 'SWAP ACTIVE', 'ALLOC WARN', 'HEAP FULL'],
        'memory-normal': ['MEM CLEAR', 'RAM FREE', 'HEAP OK', 'ALLOC GOOD'],
        'network-connected': ['LINK UP', 'NET ONLINE', 'COMMS ACTIVE', 'CONNECTED', 'SIGNAL FOUND'],
        'network-disconnected': ['LINK DOWN', 'NET OFFLINE', 'COMMS LOST', 'NO SIGNAL', 'DARKNET'],
        'window-opened': ['NEW VECTOR', 'SPAWN DETECT', 'ASSET ONLINE', 'WINDOW UP', 'PROC START'],
        'window-closed': ['ASSET TERM', 'WINDOW DOWN', 'PROC EXIT', 'TARGET LOST', 'DESPAWN'],
        'app-not-responding': ['HUNG DETECT', 'ZOMBIE PROC', 'FROZEN APP', 'DEADLOCK', 'UNRESPONSIVE']
    };

    // === State Variables ===
    let mood = 'awake';
    let lastMood = 'awake';
    let locked = false;
    let moodTimer = null;
    let lastInteractTime = Date.now();
    let hoverActive = false;
    let petCount = 0;
    let systemHealth = 'good';
    let clickCount = 0;
    let clickTimer = null;
    let currentRoutine = null;
    let idleStep = 0;
    let routineTimer = null;
    let sleepZTimer = null;

    // === Idle Routines ===
    const idleRoutines = [
        {
            name: 'patrol',
            steps: ['look_l', 'awake', 'look_r', 'awake', 'look_l_happy', 'awake'],
            stepTime: 1500,
            anim: ['rg-peek-l', '', 'rg-peek-r', '', 'rg-peek-l', 'rg-wiggle']
        },
        {
            name: 'study',
            steps: ['smart', 'smart', 'debug', 'smart', 'excited'],
            stepTime: 2000,
            anim: ['rg-nod', '', 'rg-nod', 'rg-pulse', 'rg-bounce']
        },
        {
            name: 'vibe',
            steps: ['cool', 'cool', 'happy', 'cool', 'motivated'],
            stepTime: 2200,
            anim: ['rg-float', '', 'rg-wiggle', 'rg-float', 'rg-bounce']
        },
        {
            name: 'restless',
            steps: ['bored', 'look_l', 'look_r', 'bored', 'demotivated', 'bored'],
            stepTime: 1800,
            anim: ['', 'rg-peek-l', 'rg-peek-r', '', 'rg-nod', '']
        },
        {
            name: 'workout',
            steps: ['motivated', 'intense', 'motivated', 'excited', 'happy', 'cool'],
            stepTime: 1400,
            anim: ['rg-bounce', 'rg-shake', 'rg-bounce', 'rg-pulse', 'rg-wiggle', 'rg-float']
        },
        {
            name: 'nap_prep',
            steps: ['bored', 'bored', 'sleep', 'sleep2', 'sleep', 'sleep2', 'sleep', 'awake'],
            stepTime: 2500,
            anim: ['', 'rg-nod', 'rg-sleep', 'rg-sleep', 'rg-sleep', 'rg-sleep', 'rg-sleep', 'rg-bounce']
        },
        {
            name: 'hack',
            steps: ['debug', 'smart', 'debug', 'intense', 'debug', 'excited'],
            stepTime: 1600,
            anim: ['rg-nod', 'rg-pulse', 'rg-nod', 'rg-shake', 'rg-nod', 'rg-bounce']
        },
        {
            name: 'social',
            steps: ['look_l', 'friend', 'happy', 'look_r', 'friend', 'grateful'],
            stepTime: 1800,
            anim: ['rg-peek-l', 'rg-bounce', 'rg-wiggle', 'rg-peek-r', 'rg-bounce', 'rg-nod']
        },
        {
            name: 'upload_cycle',
            steps: ['upload', 'upload1', 'upload2', 'upload1', 'upload2', 'happy'],
            stepTime: 800,
            anim: ['rg-upload', 'rg-upload', 'rg-upload', 'rg-upload', 'rg-upload', 'rg-bounce']
        },
        {
            name: 'existential',
            steps: ['smart', 'lonely', 'sad', 'smart', 'bored', 'cool'],
            stepTime: 2200,
            anim: ['rg-nod', '', '', 'rg-nod', '', 'rg-float']
        }
    ];

    // === Utility Functions ===

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function clearAllTimers() {
        if (moodTimer) clearTimeout(moodTimer);
        if (routineTimer) clearTimeout(routineTimer);
        if (sleepZTimer) clearInterval(sleepZTimer);
        moodTimer = null;
        routineTimer = null;
        sleepZTimer = null;
    }

    function stopRoutine() {
        currentRoutine = null;
        idleStep = 0;
        if (routineTimer) {
            clearTimeout(routineTimer);
            routineTimer = null;
        }
    }

    // === Animation Helpers ===

    function clearAnimations() {
        faceEl.classList.remove(
            'rg-bounce', 'rg-wiggle', 'rg-shake', 'rg-nod', 'rg-float',
            'rg-spin', 'rg-pulse', 'rg-peek-l', 'rg-peek-r', 'rg-sleep',
            'rg-upload', 'rg-scared', 'rg-sad', 'rg-glitch', 'rg-sad-wobble'
        );
    }

    function applyAnimation(anim) {
        if (!anim) return;
        clearAnimations();
        void faceEl.offsetWidth; // Force reflow
        faceEl.classList.add(anim);
    }

    // === Sleep Z Particles ===

    function spawnSleepZ() {
        const z = document.createElement('span');
        z.className = 'rg-zzz';
        z.textContent = pick(['z', 'Z', 'zZ', 'Zz']);
        z.style.left = (60 + Math.random() * 30) + 'px';
        z.style.top = (20 + Math.random() * 20) + 'px';
        container.appendChild(z);
        setTimeout(() => z.remove(), 2500);
    }

    function startSleepZ() {
        if (sleepZTimer) return;
        spawnSleepZ();
        sleepZTimer = setInterval(spawnSleepZ, 1800);
    }

    function stopSleepZ() {
        if (sleepZTimer) {
            clearInterval(sleepZTimer);
            sleepZTimer = null;
        }
    }

    // === Click Ripple Particle ===

    function spawnClickRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'rg-click-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        container.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    // === Core Mood Setter ===

    function setMood(newMood, opts = {}) {
        opts = Object.assign({ duration: 0, anim: '', status: '', priority: false }, opts);

        // Priority lock check
        if (locked && !opts.priority) return;

        // Clear old timer
        if (moodTimer) {
            clearTimeout(moodTimer);
            moodTimer = null;
        }

        // Set lock if priority
        if (opts.priority) {
            locked = true;
        }

        lastMood = mood;
        mood = newMood;

        // Update sprite (flip direction is on wrapper, not affected by img src change)
        if (faces[mood]) {
            faceEl.src = faces[mood];
        }

        // Update status text
        const text = opts.status || pick(statusText[mood] || statusText.awake);
        statusEl.textContent = text;

        // Apply animation
        clearAnimations();
        if (opts.anim) {
            applyAnimation(opts.anim);
        }

        // Apply sad filter for negative moods
        if (negativeMoods.includes(mood)) {
            faceEl.classList.add('rg-sad');
        } else {
            faceEl.classList.remove('rg-sad');
        }

        // Sleep Z particles
        if (mood === 'sleep' || mood === 'sleep2') {
            startSleepZ();
        } else {
            stopSleepZ();
        }

        // Auto-reset timer
        if (opts.duration > 0) {
            moodTimer = setTimeout(() => {
                locked = false;
                setMood('awake', { anim: 'rg-wiggle' });
            }, opts.duration);
        } else if (opts.priority) {
            // Auto-unlock after 10s max
            moodTimer = setTimeout(() => {
                locked = false;
            }, 10000);
        }
    }

    // === Event Reactor ===

    function react(level, msg) {
        if (locked) return;
        stopRoutine();
        lastInteractTime = Date.now();

        const msgLower = (msg || '').toLowerCase();

        // Critical events
        if (level === 'critical') {
            setMood('angry', { duration: 6000, anim: 'rg-shake', priority: true, status: 'THREAT CRITICAL' });
            return;
        }

        // Warning events
        if (level === 'warning') {
            setMood('intense', { duration: 3500, anim: 'rg-shake', status: 'ALERT ACTIVE' });
            return;
        }

        // Keyword matching
        if (msgLower.includes('offline') || msgLower.includes('down')) {
            setMood('sad', { duration: 4000, anim: '', status: 'ASSET OFFLINE' });
        } else if (msgLower.includes('online') || msgLower.includes('started')) {
            setMood('excited', { duration: 2500, anim: 'rg-bounce', status: 'CONTACT RESTORED' });
        } else if (msgLower.includes('cpu') && (msgLower.includes('high') || msgLower.includes('spike'))) {
            setMood('intense', { duration: 3000, anim: 'rg-shake', status: 'CPU SPIKE' });
        } else if (msgLower.includes('memory') && (msgLower.includes('high') || msgLower.includes('pressure'))) {
            setMood('intense', { duration: 3000, anim: 'rg-pulse', status: 'MEM PRESSURE' });
        } else if (msgLower.includes('sync') || msgLower.includes('upload') || msgLower.includes('transfer')) {
            setMood('upload', { duration: 3500, anim: 'rg-upload', status: 'DATA TRANSFER' });
        } else if (msgLower.includes('debug') || msgLower.includes('trace')) {
            setMood('debug', { duration: 2500, anim: 'rg-nod', status: 'DEBUG MODE' });
        } else if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('crash')) {
            setMood('broken', { duration: 3500, anim: 'rg-shake', status: 'ERROR DETECTED' });
        } else if (level === 'info' && Math.random() < 0.25) {
            const positiveMoods = ['happy', 'excited', 'cool', 'motivated'];
            setMood(pick(positiveMoods), { duration: 1800, anim: 'rg-bounce' });
        } else if (level === 'ok' && Math.random() < 0.4) {
            setMood('happy', { duration: 1500, anim: 'rg-bounce', status: 'ALL CLEAR' });
        }
    }

    // === Health Assessment ===

    function assessHealth(data) {
        if (!data) return;

        const cpu = data.cpu?.usage_total || 0;
        const mem = data.memory?.percent || 0;
        const temps = data.temperatures || [];
        const maxTemp = temps.length > 0 ? Math.max(...temps.map(t => t.current || 0)) : 0;

        let newHealth = 'good';

        if (cpu > 90 || mem > 92 || maxTemp > 85) {
            newHealth = 'crit';
        } else if (cpu > 75 || mem > 80) {
            newHealth = 'warn';
        }

        // Trigger on state change
        if (newHealth !== systemHealth) {
            const oldHealth = systemHealth;
            systemHealth = newHealth;

            if (newHealth === 'crit') {
                setMood('intense', { duration: 4000, anim: 'rg-shake', status: 'THREAT LVL CRITICAL' });
            } else if (newHealth === 'warn' && oldHealth === 'good') {
                setMood('intense', { duration: 2500, anim: 'rg-pulse', status: 'ESCALATION DETECTED' });
            } else if (newHealth === 'good' && (oldHealth === 'crit' || oldHealth === 'warn')) {
                setMood('happy', { duration: 2000, anim: 'rg-bounce', status: 'THREAT NEUTRALIZED' });
            }
        }
    }

    // === System Event Handler ===
    function handleSystemEvent(event) {
        if (!event || !event.type) return;
        if (locked) return; // Don't interrupt important moods
        
        const type = event.type;
        const value = event.value;
        const statusPool = systemEventStatus[type] || [];
        const status = statusPool.length > 0 ? pick(statusPool) : type.toUpperCase();
        
        switch (type) {
            case 'cpu-spike':
                setMood('intense', { 
                    duration: 3000, 
                    anim: 'rg-shake', 
                    status: `${status} ${value}%`
                });
                break;
                
            case 'cpu-high':
                setMood('smart', { 
                    duration: 2500, 
                    anim: 'rg-pulse', 
                    status: `${status} ${value}%`
                });
                break;
                
            case 'cpu-normal':
                setMood('cool', { 
                    duration: 2000, 
                    anim: 'rg-wiggle', 
                    status: status 
                });
                break;
                
            case 'memory-high':
                setMood('intense', { 
                    duration: 2500, 
                    anim: 'rg-shake', 
                    status: `${status} ${value}%`
                });
                break;
                
            case 'memory-normal':
                setMood('happy', { 
                    duration: 2000, 
                    anim: 'rg-bounce', 
                    status: status 
                });
                break;
                
            case 'network-connected':
                setMood('excited', { 
                    duration: 3000, 
                    anim: 'rg-bounce', 
                    status: status 
                });
                break;
                
            case 'network-disconnected':
                setMood('lonely', { 
                    duration: 4000, 
                    anim: 'rg-sad-wobble', 
                    status: status 
                });
                break;
                
            case 'window-opened':
                // Only react sometimes to avoid spam
                if (Math.random() > 0.5) {
                    setMood('look_r', { 
                        duration: 1500, 
                        anim: 'rg-peek-r', 
                        status: status 
                    });
                }
                break;
                
            case 'window-closed':
                // Only react sometimes
                if (Math.random() > 0.6) {
                    const closeMood = pick(['look_l', 'bored', 'awake']);
                    setMood(closeMood, { 
                        duration: 1500, 
                        status: status 
                    });
                }
                break;
                
            case 'app-not-responding':
                setMood('debug', { 
                    duration: 4000, 
                    anim: 'rg-glitch', 
                    status: `${status}: ${event.app || 'UNKNOWN'}`.slice(0, 20)
                });
                break;
        }
    }

    // === Idle Routine Runner ===

    function runRoutineStep() {
        if (!currentRoutine) return;

        if (idleStep >= currentRoutine.steps.length) {
            // Routine complete
            stopRoutine();
            setMood('awake', { anim: 'rg-wiggle' });
            return;
        }

        const moodStep = currentRoutine.steps[idleStep];
        const animStep = currentRoutine.anim[idleStep] || '';

        setMood(moodStep, { anim: animStep });
        idleStep++;

        routineTimer = setTimeout(runRoutineStep, currentRoutine.stepTime);
    }

    function startIdleRoutine() {
        if (locked || currentRoutine) return;

        // Pick routine based on health/time
        let pool = [...idleRoutines];
        const hour = new Date().getHours();
        const isNight = hour >= 23 || hour < 6;

        if (systemHealth === 'crit') {
            pool = pool.filter(r => ['restless', 'existential', 'hack'].includes(r.name));
        } else if (systemHealth === 'warn') {
            // Weight hack more
            pool.push(idleRoutines.find(r => r.name === 'hack'));
        }

        if (isNight) {
            // Weight nap_prep more
            pool.push(idleRoutines.find(r => r.name === 'nap_prep'));
            pool.push(idleRoutines.find(r => r.name === 'nap_prep'));
        }

        pool = pool.filter(Boolean);
        currentRoutine = pick(pool);
        idleStep = 0;

        runRoutineStep();
    }

    // === Idle Check ===

    function idleCheck() {
        const idleTime = Date.now() - lastInteractTime;

        // In routine already
        if (currentRoutine || locked) return;

        // Extended idle (2+ min)
        if (idleTime > 120000) {
            const hour = new Date().getHours();
            const isNight = hour >= 23 || hour < 6;

            if (isNight || Math.random() < 0.5) {
                setMood(pick(['sleep', 'sleep2']), { anim: 'rg-sleep' });
            } else {
                setMood('lonely', { status: 'AWAITING CONTACT' });
            }
            return;
        }

        // Medium idle (15s+)
        if (idleTime > 15000 && ['awake', 'bored', 'cool'].includes(mood)) {
            if (Math.random() < 0.65) {
                startIdleRoutine();
            }
            return;
        }

        // Quick personality ticks
        if (idleTime < 15000) {
            if (Math.random() < 0.15) {
                startIdleRoutine();
            } else if (Math.random() < 0.13) {
                const quickMoods = ['smart', 'cool', 'motivated', 'debug'];
                setMood(pick(quickMoods), { duration: 2000, anim: 'rg-nod' });
            }
        }
    }

    // Start idle checker
    setInterval(idleCheck, 6000);

    // === Mouse Interaction ===

    // Mouse tracking (eye follow)
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

        // Only track if cursor is within reasonable range
        if (Math.abs(deltaX) < 250) {
            const threshold = rect.width * 0.4;
            const isHappy = ['happy', 'excited', 'grateful'].includes(mood);

            if (deltaX < -threshold) {
                setMood(isHappy ? 'look_l_happy' : 'look_l');
            } else if (deltaX > threshold) {
                setMood(isHappy ? 'look_r_happy' : 'look_r');
            } else if (mood.startsWith('look_')) {
                setMood('awake');
            }
        }
    });

    // Hover on pet
    container.addEventListener('mouseenter', () => {
        hoverActive = true;
        lastInteractTime = Date.now();
        stopRoutine();

        if (mood.startsWith('sleep')) {
            setMood('awake', { anim: 'rg-bounce', status: 'AWAKENED' });
        } else if (['bored', 'lonely', 'demotivated'].includes(mood)) {
            setMood('happy', { anim: 'rg-wiggle', status: 'CONTACT MADE' });
        } else if (!locked) {
            setMood('happy', { anim: 'rg-wiggle' });
        }
    });

    container.addEventListener('mouseleave', () => {
        hoverActive = false;
        if (!locked && ['happy', 'excited', 'grateful'].includes(mood)) {
            setMood('awake');
        }
    });

    // Click interactions
    faceEl.addEventListener('click', (e) => {
        lastInteractTime = Date.now();
        stopRoutine();

        // Click counter for rapid clicks
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 400);

        // Spawn ripple
        const rect = container.getBoundingClientRect();
        spawnClickRipple(e.clientX - rect.left, e.clientY - rect.top);

        // Rapid click reactions
        if (clickCount >= 5) {
            setMood('angry', { duration: 3000, anim: 'rg-shake', priority: true, status: 'EXCESSIVE INPUT' });
            clickCount = 0;
            return;
        }

        if (clickCount >= 3) {
            setMood('excited', { duration: 2000, anim: 'rg-bounce', status: 'RAPID CONTACT' });
            return;
        }

        // Normal click - random positive reaction
        petCount++;
        const reactions = [
            { m: 'happy', a: 'rg-bounce', s: 'CONTACT CONFIRMED' },
            { m: 'excited', a: 'rg-wiggle', s: 'GOOD CONTACT' },
            { m: 'grateful', a: 'rg-nod', s: 'ACKNOWLEDGED' },
            { m: 'cool', a: 'rg-float', s: 'APPRECIATED' },
            { m: 'motivated', a: 'rg-pulse', s: 'ENERGIZED' },
            { m: 'friend', a: 'rg-bounce', s: 'ALLY CONFIRMED' },
            { m: 'happy', a: 'rg-wiggle', s: 'RAPPORT ++' },
            { m: 'excited', a: 'rg-bounce', s: 'MORALE BOOST' }
        ];

        const reaction = pick(reactions);
        setMood(reaction.m, { duration: 2000, anim: reaction.a, status: reaction.s });

        // Milestone reactions
        if (petCount === 10) {
            setTimeout(() => setMood('excited', { duration: 2500, anim: 'rg-spin', status: '10 CONTACTS!' }), 500);
        } else if (petCount === 50) {
            setTimeout(() => setMood('grateful', { duration: 3000, anim: 'rg-spin', status: '50 CONTACTS!' }), 500);
        } else if (petCount === 100) {
            setTimeout(() => setMood('motivated', { duration: 3500, anim: 'rg-pulse', status: 'CENTURY MARK!' }), 500);
        } else if (petCount % 25 === 0 && petCount > 100) {
            setTimeout(() => setMood('cool', { duration: 2000, anim: 'rg-bounce', status: petCount + ' STRONG' }), 500);
        }
    });

    // Double click
    faceEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        lastInteractTime = Date.now();
        stopRoutine();
        setMood('excited', { duration: 2000, anim: 'rg-spin', status: 'EVASIVE MANEUVER' });
    });

    // === Public API ===

    return {
        react: react,
        assessHealth: assessHealth,
        handleSystemEvent: handleSystemEvent,
        setMood: setMood,
        get mood() { return mood; },
        get petCount() { return petCount; }
    };

})();

// Expose globally for system integration
window.RG = RG;

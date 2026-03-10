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

    // === Language Support ===
    let currentLang = localStorage.getItem('radgotchi-lang') || 'en';

    // === Status Text Messages — English (themed) ===
    const statusTextEN = {
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

    // === Status Text Messages — Chinese (中文) ===
    const statusTextZH = {
        awake: ['信号正常', '监控中', '全线畅通', '系统在线', '等待指令'],
        happy: ['资产确认', '运行正常', '权限通过', '任务成功', '一切正常'],
        excited: ['高度警戒', '目标捕获', '信号锁定', '信号强劲', '准备拦截'],
        cool: ['休闲模式', '隐身启动', '低调运行', '暗中行动', '秘密行动'],
        grateful: ['感谢有你', '关系稳固', '信任确认', '同盟确认', '伙伴认可'],
        motivated: ['蓄势待发', '战斗准备', '全力以赴', '待命中', '任务准备'],
        friend: ['握手成功', '连接安全', '通讯畅通', '伙伴在线', '频道开启'],
        look_l: ['左侧扫描', '周界检查', '目视巡查', '区域扫描'],
        look_r: ['右侧扫描', '侧翼检查', '目视巡查', '区域扫描'],
        look_l_happy: ['左侧友军', '发现伙伴', '氛围很好', '身份确认'],
        look_r_happy: ['右侧友军', '发现伙伴', '氛围很好', '身份确认'],
        smart: ['分析中', '数据处理', '模式匹配', '解码进行', '运算中'],
        intense: ['高度警戒', '威胁临近', '注意安全', '状态升级', '保持警惕'],
        debug: ['取证模式', '堆栈追踪', '根因分析', '深度扫描', '诊断中'],
        bored: ['空闲状态', '无信号', '安静区域', '低活动', '待机中'],
        sad: ['信号丢失', '资产离线', '士气低落', '通讯中断', '已离线'],
        angry: ['一级战备', '敌对行为', '安全失守', '红色警报', '防线突破'],
        lonely: ['无上行链路', '零联系', '通讯黑暗', '全面断联', '孤立无援'],
        demotivated: ['士气低落', '任务存疑', '精力不足', '过度疲劳', '身心俱疲'],
        broken: ['系统故障', '完整性丢失', '严重错误', '隔离中', '功能异常'],
        sleep: ['休眠行动', '低功耗', '被动模式', '休息周期', '梦境中'],
        sleep2: ['深度睡眠', '冬眠中', '充电中', '低功耗待机', '恢复中'],
        upload: ['数据传出', '数据突发', '传输中', '上行激活', '同步开始'],
        upload1: ['传输继续', '突发模式', '传输进行', '上传中', '同步50%'],
        upload2: ['传输完成', '突发已送', '传输结束', '上传完成', '同步100%']
    };

    // Active status text pool — switches based on current language
    function getStatusText() {
        return currentLang === 'zh' ? statusTextZH : statusTextEN;
    }

    // === Negative Moods (for sad filter) ===
    const negativeMoods = ['sad', 'angry', 'broken', 'lonely', 'demotivated'];

    // === System Event Status Messages — English ===
    const systemEventStatusEN = {
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

    // === System Event Status Messages — Chinese (中文) ===
    const systemEventStatusZH = {
        'cpu-spike': ['CPU爆满', '处理器超载', '算力飙升', '过热警告', '降频风险'],
        'cpu-high': ['高负载', '处理中', '繁忙周期', '高强度运算', '数据处理'],
        'cpu-normal': ['负载正常', 'CPU稳定', '周期空闲', '处理器正常'],
        'memory-high': ['内存紧张', '内存告急', '交换启动', '分配警告', '堆已满'],
        'memory-normal': ['内存正常', '内存充足', '堆正常', '分配良好'],
        'network-connected': ['连接恢复', '网络在线', '通讯激活', '已连接', '信号找到'],
        'network-disconnected': ['连接断开', '网络离线', '通讯丢失', '无信号', '暗网'],
        'window-opened': ['新窗口', '检测到启动', '资产在线', '窗口打开', '进程启动'],
        'window-closed': ['资产终止', '窗口关闭', '进程退出', '目标丢失', '已销毁'],
        'app-not-responding': ['检测到卡死', '僵尸进程', '应用冻结', '死锁', '无响应']
    };

    // Active system event status pool — switches based on current language
    function getSystemEventStatus() {
        return currentLang === 'zh' ? systemEventStatusZH : systemEventStatusEN;
    }

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
    let isSleeping = false;
    let isWorking = false;
    let currentLevel = 1;  // Track XP level for level-gated expressions
    
    // === Level Thresholds for Expression Unlocks ===
    const LEVEL_UNLOCKS = {
        SMART_REACTIONS: 5,      // Level 5+: Smart/analytical expressions
        DEBUG_MODE: 10,          // Level 10+: Debug/deep analysis expressions
        INTENSE_REACTIONS: 15,   // Level 15+: Intense/focused expressions  
        ELITE_STATUS: 20,        // Level 20+: Elite status messages
        LEGENDARY: 25            // Level 25+: Legendary expressions
    };

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
        },
        // Level-gated routines (unlocked at higher levels)
        {
            name: 'analyst',
            minLevel: 5,
            steps: ['smart', 'debug', 'smart', 'intense', 'smart', 'cool'],
            stepTime: 1800,
            anim: ['rg-nod', 'rg-pulse', 'rg-nod', 'rg-shake', 'rg-nod', 'rg-float']
        },
        {
            name: 'deepdive',
            minLevel: 10,
            steps: ['debug', 'debug', 'intense', 'debug', 'smart', 'excited'],
            stepTime: 2000,
            anim: ['rg-nod', 'rg-pulse', 'rg-shake', 'rg-nod', 'rg-pulse', 'rg-spin']
        },
        {
            name: 'tactical',
            minLevel: 15,
            steps: ['intense', 'look_l', 'intense', 'look_r', 'motivated', 'cool'],
            stepTime: 1400,
            anim: ['rg-pulse', 'rg-peek-l', 'rg-shake', 'rg-peek-r', 'rg-bounce', 'rg-float']
        },
        {
            name: 'elite_ops',
            minLevel: 20,
            steps: ['cool', 'intense', 'debug', 'motivated', 'cool', 'smart', 'cool'],
            stepTime: 1600,
            anim: ['rg-float', 'rg-shake', 'rg-pulse', 'rg-bounce', 'rg-float', 'rg-nod', 'rg-spin']
        },
        {
            name: 'legendary',
            minLevel: 25,
            steps: ['cool', 'debug', 'intense', 'smart', 'motivated', 'cool', 'excited'],
            stepTime: 1500,
            anim: ['rg-spin', 'rg-pulse', 'rg-shake', 'rg-nod', 'rg-bounce', 'rg-float', 'rg-spin']
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

    // === Sprite Sync Helper ===
    // Sets face and notifies chat window for avatar sync
    function setFace(faceName) {
        if (!faces[faceName]) return;
        faceEl.src = faces[faceName];
        // Notify chat window of sprite change for bro avatar sync
        if (window.electronAPI && window.electronAPI.updateSprite) {
            const spriteName = faces[faceName].split('/').pop();
            window.electronAPI.updateSprite(spriteName);
        }
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
        // Don't change face/status if sleeping or in work mode (pomodoro)
        // But still sync sprite to chat for those modes
        if (isSleeping || isWorking) {
            // Still sync the current face to chat even if we don't change it here
            return;
        }
        
        if (faces[mood]) {
            setFace(mood);
        }

        // Update status text
        const st = getStatusText();
        const text = opts.status || pick(st[mood] || st.awake);
        statusEl.textContent = text;
        statusEl.style.display = '';

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
        const zh = currentLang === 'zh';

        if (level === 'critical') {
            setMood('angry', { duration: 6000, anim: 'rg-shake', priority: true,
                status: zh ? '威胁严重' : 'THREAT CRITICAL' });
            return;
        }

        // Warning events
        if (level === 'warning') {
            setMood('intense', { duration: 3500, anim: 'rg-shake',
                status: zh ? '警报激活' : 'ALERT ACTIVE' });
            return;
        }

        // Keyword matching
        if (msgLower.includes('offline') || msgLower.includes('down')) {
            setMood('sad', { duration: 4000, anim: '',
                status: zh ? '资产离线' : 'ASSET OFFLINE' });
        } else if (msgLower.includes('online') || msgLower.includes('started')) {
            setMood('excited', { duration: 2500, anim: 'rg-bounce',
                status: zh ? '连接恢复' : 'CONTACT RESTORED' });
        } else if (msgLower.includes('cpu') && (msgLower.includes('high') || msgLower.includes('spike'))) {
            setMood('intense', { duration: 3000, anim: 'rg-shake',
                status: zh ? 'CPU飙升' : 'CPU SPIKE' });
        } else if (msgLower.includes('memory') && (msgLower.includes('high') || msgLower.includes('pressure'))) {
            setMood('intense', { duration: 3000, anim: 'rg-pulse',
                status: zh ? '内存压力' : 'MEM PRESSURE' });
        } else if (msgLower.includes('sync') || msgLower.includes('upload') || msgLower.includes('transfer')) {
            setMood('upload', { duration: 3500, anim: 'rg-upload',
                status: zh ? '数据传输' : 'DATA TRANSFER' });
        } else if (msgLower.includes('debug') || msgLower.includes('trace')) {
            setMood('debug', { duration: 2500, anim: 'rg-nod',
                status: zh ? '调试模式' : 'DEBUG MODE' });
        } else if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('crash')) {
            setMood('broken', { duration: 3500, anim: 'rg-shake',
                status: zh ? '检测到错误' : 'ERROR DETECTED' });
        } else if (level === 'info' && Math.random() < 0.25) {
            const positiveMoods = ['happy', 'excited', 'cool', 'motivated'];
            setMood(pick(positiveMoods), { duration: 1800, anim: 'rg-bounce' });
        } else if (level === 'ok' && Math.random() < 0.4) {
            setMood('happy', { duration: 1500, anim: 'rg-bounce',
                status: zh ? '一切正常' : 'ALL CLEAR' });
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

            const zh = currentLang === 'zh';
            if (newHealth === 'crit') {
                setMood('intense', { duration: 4000, anim: 'rg-shake',
                    status: zh ? '威胁等级严重' : 'THREAT LVL CRITICAL' });
            } else if (newHealth === 'warn' && oldHealth === 'good') {
                setMood('intense', { duration: 2500, anim: 'rg-pulse',
                    status: zh ? '检测到升级' : 'ESCALATION DETECTED' });
            } else if (newHealth === 'good' && (oldHealth === 'crit' || oldHealth === 'warn')) {
                setMood('happy', { duration: 2000, anim: 'rg-bounce',
                    status: zh ? '威胁已解除' : 'THREAT NEUTRALIZED' });
            }
        }
    }

    // === System Event Handler ===
    function handleSystemEvent(event) {
        if (!event || !event.type) return;
        if (locked) return; // Don't interrupt important moods
        
        const type = event.type;
        const value = event.value;
        const ses = getSystemEventStatus();
        const statusPool = ses[type] || [];
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

        // Pick routine based on health/time/level
        // Filter routines by level requirement
        let pool = idleRoutines.filter(r => !r.minLevel || currentLevel >= r.minLevel);
        const hour = new Date().getHours();
        const isNight = hour >= 23 || hour < 6;

        if (systemHealth === 'crit') {
            pool = pool.filter(r => ['restless', 'existential', 'hack', 'deepdive'].includes(r.name));
        } else if (systemHealth === 'warn') {
            // Weight hack more
            const hackRoutine = pool.find(r => r.name === 'hack');
            if (hackRoutine) pool.push(hackRoutine);
        }

        if (isNight) {
            // Weight nap_prep more
            const napRoutine = pool.find(r => r.name === 'nap_prep');
            if (napRoutine) {
                pool.push(napRoutine);
                pool.push(napRoutine);
            }
        }
        
        // Weight level-exclusive routines higher for high-level players
        if (currentLevel >= LEVEL_UNLOCKS.LEGENDARY) {
            const legendaryRoutine = pool.find(r => r.name === 'legendary');
            if (legendaryRoutine) pool.push(legendaryRoutine);
        }
        if (currentLevel >= LEVEL_UNLOCKS.ELITE_STATUS) {
            const eliteRoutine = pool.find(r => r.name === 'elite_ops');
            if (eliteRoutine) pool.push(eliteRoutine);
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
                setMood('lonely', { status: currentLang === 'zh' ? '等待接触' : 'AWAITING CONTACT' });
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
            setMood('awake', { anim: 'rg-bounce',
                status: currentLang === 'zh' ? '已唤醒' : 'AWAKENED' });
        } else if (['bored', 'lonely', 'demotivated'].includes(mood)) {
            setMood('happy', { anim: 'rg-wiggle',
                status: currentLang === 'zh' ? '有人来了' : 'CONTACT MADE' });
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
        
        // Play click sound
        if (typeof SoundSystem !== 'undefined') SoundSystem.play('click');

        // Click counter for rapid clicks
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 400);

        // Spawn ripple
        const rect = container.getBoundingClientRect();
        spawnClickRipple(e.clientX - rect.left, e.clientY - rect.top);

        // Rapid click reactions
        if (clickCount >= 5) {
            setMood('angry', { duration: 3000, anim: 'rg-shake', priority: true,
                status: currentLang === 'zh' ? '输入过多' : 'EXCESSIVE INPUT' });
            clickCount = 0;
            return;
        }

        if (clickCount >= 3) {
            setMood('excited', { duration: 2000, anim: 'rg-bounce',
                status: currentLang === 'zh' ? '快速接触' : 'RAPID CONTACT' });
            return;
        }

        // Normal click - random positive reaction
        petCount++;
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

        const reaction = pick(currentLang === 'zh' ? reactionsZH : reactionsEN);
        setMood(reaction.m, { duration: 2000, anim: reaction.a, status: reaction.s });
        
        // Level-gated bonus reactions (chance to show level-exclusive expression)
        if (currentLevel >= LEVEL_UNLOCKS.LEGENDARY && Math.random() < 0.15) {
            // Legendary tier: rare intense + debug combo
            setTimeout(() => {
                const legendaryEN = [
                    { m: 'intense', a: 'rg-pulse', s: 'APEX OPERATOR' },
                    { m: 'debug', a: 'rg-float', s: 'OMNISCIENT' },
                    { m: 'smart', a: 'rg-spin', s: 'TRANSCENDENT' },
                    { m: 'cool', a: 'rg-pulse', s: 'LEGENDARY STATUS' }
                ];
                const legendaryZH = [
                    { m: 'intense', a: 'rg-pulse', s: '顶级特工' },
                    { m: 'debug', a: 'rg-float', s: '全知全能' },
                    { m: 'smart', a: 'rg-spin', s: '超越极限' },
                    { m: 'cool', a: 'rg-pulse', s: '传奇状态' }
                ];
                const r = pick(currentLang === 'zh' ? legendaryZH : legendaryEN);
                setMood(r.m, { duration: 2500, anim: r.a, status: r.s, priority: true });
            }, 300);
        } else if (currentLevel >= LEVEL_UNLOCKS.ELITE_STATUS && Math.random() < 0.18) {
            // Elite tier: confident elite reactions
            setTimeout(() => {
                const eliteEN = [
                    { m: 'cool', a: 'rg-float', s: 'ELITE OPS' },
                    { m: 'motivated', a: 'rg-pulse', s: 'VETERAN STATUS' },
                    { m: 'smart', a: 'rg-nod', s: 'SENIOR ANALYST' }
                ];
                const eliteZH = [
                    { m: 'cool', a: 'rg-float', s: '精英行动' },
                    { m: 'motivated', a: 'rg-pulse', s: '老兵状态' },
                    { m: 'smart', a: 'rg-nod', s: '资深分析师' }
                ];
                const r = pick(currentLang === 'zh' ? eliteZH : eliteEN);
                setMood(r.m, { duration: 2000, anim: r.a, status: r.s });
            }, 300);
        } else if (currentLevel >= LEVEL_UNLOCKS.INTENSE_REACTIONS && Math.random() < 0.2) {
            // Intense tier: focused intensity
            setTimeout(() => {
                const intenseEN = [
                    { m: 'intense', a: 'rg-pulse', s: 'LOCKED IN' },
                    { m: 'motivated', a: 'rg-bounce', s: 'HARDENED' }
                ];
                const intenseZH = [
                    { m: 'intense', a: 'rg-pulse', s: '全神贯注' },
                    { m: 'motivated', a: 'rg-bounce', s: '久经沙场' }
                ];
                const r = pick(currentLang === 'zh' ? intenseZH : intenseEN);
                setMood(r.m, { duration: 2000, anim: r.a, status: r.s });
            }, 300);
        } else if (currentLevel >= LEVEL_UNLOCKS.DEBUG_MODE && Math.random() < 0.22) {
            // Debug tier: analytical depth
            setTimeout(() => {
                const debugEN = [
                    { m: 'debug', a: 'rg-nod', s: 'DEEP ANALYSIS' },
                    { m: 'smart', a: 'rg-float', s: 'PATTERN RECOGNIZED' }
                ];
                const debugZH = [
                    { m: 'debug', a: 'rg-nod', s: '深度分析' },
                    { m: 'smart', a: 'rg-float', s: '模式识别' }
                ];
                const r = pick(currentLang === 'zh' ? debugZH : debugEN);
                setMood(r.m, { duration: 2000, anim: r.a, status: r.s });
            }, 300);
        } else if (currentLevel >= LEVEL_UNLOCKS.SMART_REACTIONS && Math.random() < 0.25) {
            // Smart tier: analytical expressions
            setTimeout(() => {
                const smartEN = [
                    { m: 'smart', a: 'rg-nod', s: 'CALCULATING' },
                    { m: 'smart', a: 'rg-pulse', s: 'DATA INSIGHT' }
                ];
                const smartZH = [
                    { m: 'smart', a: 'rg-nod', s: '计算中' },
                    { m: 'smart', a: 'rg-pulse', s: '数据洞察' }
                ];
                const r = pick(currentLang === 'zh' ? smartZH : smartEN);
                setMood(r.m, { duration: 1800, anim: r.a, status: r.s });
            }, 300);
        }

        // Milestone reactions
        if (petCount === 10) {
            setTimeout(() => setMood('excited', { duration: 2500, anim: 'rg-spin',
                status: currentLang === 'zh' ? '10次接触！' : '10 CONTACTS!' }), 500);
        } else if (petCount === 50) {
            setTimeout(() => setMood('grateful', { duration: 3000, anim: 'rg-spin',
                status: currentLang === 'zh' ? '50次接触！' : '50 CONTACTS!' }), 500);
        } else if (petCount === 100) {
            setTimeout(() => setMood('motivated', { duration: 3500, anim: 'rg-pulse',
                status: currentLang === 'zh' ? '百次达成！' : 'CENTURY MARK!' }), 500);
        } else if (petCount % 25 === 0 && petCount > 100) {
            setTimeout(() => setMood('cool', { duration: 2000, anim: 'rg-bounce',
                status: currentLang === 'zh' ? petCount + ' 次！' : petCount + ' STRONG' }), 500);
        }
    });

    // Double click
    faceEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        lastInteractTime = Date.now();
        stopRoutine();
        setMood('excited', { duration: 2000, anim: 'rg-spin',
            status: currentLang === 'zh' ? '紧急规避' : 'EVASIVE MANEUVER' });
    });

    // === Language Setter ===

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('radgotchi-lang', lang);
        // Refresh status text to reflect new language immediately
        if (!isSleeping) {
            const st = getStatusText();
            statusEl.textContent = pick(st[mood] || st.awake);
        }
    }
    
    // === Sleep Mode ===
    
    function setSleep(sleeping) {
        isSleeping = sleeping;
        if (sleeping) {
            // Play sleep sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('sleepStart');
            // Enter sleep mode - show sleep animation
            setFace('sleep');
            const st = getStatusText();
            statusEl.textContent = pick(st.sleep);
            container.classList.add('sleeping');
        } else {
            // Play wake sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('sleepEnd');
            // Wake up - return to normal
            container.classList.remove('sleeping');
            setFace('awake');
            const st = getStatusText();
            statusEl.textContent = pick(st.awake);
        }
    }
    
    function setSleepAnimation(animation) {
        if (!isSleeping) return;
        if (faces[animation]) {
            setFace(animation);
        }
        const st = getStatusText();
        statusEl.textContent = pick(st[animation] || st.sleep);
    }
    
    // === Work Mode (Pomodoro Focus) ===
    
    function setWork(working) {
        isWorking = working;
        if (working) {
            // Ensure not sleeping
            if (isSleeping) {
                setSleep(false);
            }
            // Enter work mode - show first work animation
            container.classList.add('working');
            setFace('smart');
            const st = getStatusText();
            statusEl.textContent = pick(st.smart);
        } else {
            // Exit work mode - return to normal
            container.classList.remove('working');
            setFace('happy');  // Happy after completing work
            const st = getStatusText();
            statusEl.textContent = pick(st.happy);
        }
    }
    
    function setWorkAnimation(animation) {
        if (!isWorking) return;
        if (faces[animation]) {
            setFace(animation);
        }
        const st = getStatusText();
        statusEl.textContent = pick(st[animation] || st.smart);
    }

    // === Audio Reactive System ===
    // Listens to system audio (music/voice) and triggers pet reactions
    // Uses Electron's desktopCapturer to capture system audio output
    
    let audioListening = false;
    let audioContext = null;
    let audioAnalyser = null;
    let audioStream = null;
    let audioSource = null;
    let audioAnimationFrame = null;
    let lastAudioReaction = 0;
    let currentAudioMode = null; // 'music', 'voice', or null
    let audioReactionTimeout = null;
    let audioHealthCheckInterval = null;
    let consecutiveZeroFrames = 0;
    let isRestartingAudio = false;
    let lastMeaningfulAudioTime = 0;  // Track when we last saw real audio data
    let audioDebugCounter = 0;  // For periodic logging
    
    // Audio detection thresholds
    const AUDIO_CONFIG = {
        VOLUME_THRESHOLD: 1,         // Min volume to react (0-255 scale) - very sensitive
        BASS_THRESHOLD: 1,           // Min bass energy to trigger vibe mode
        MUSIC_BEAT_THRESHOLD: 0.4,   // Beat detection sensitivity
        VOICE_FREQUENCY_MIN: 85,     // Human voice ~85-255 Hz
        VOICE_FREQUENCY_MAX: 255,
        MUSIC_BASS_MAX: 150,         // Bass frequencies for beat detection
        REACTION_COOLDOWN: 200,      // ms between animation updates
        MODE_SWITCH_DELAY: 500,      // ms before switching music/voice mode
        SILENCE_TIMEOUT: 2000,       // ms of silence before stopping reaction
        HEALTH_CHECK_INTERVAL: 2000, // ms between stream health checks (faster)
        ZERO_FRAME_THRESHOLD: 120,   // consecutive zero-data frames before considering dead (~2 sec)
        RESTART_COOLDOWN: 3000,      // ms between restart attempts (base)
        RESTART_MAX_RETRIES: 5,      // max consecutive restart attempts before backing off
        RESTART_BACKOFF_MAX: 60000   // max backoff delay (1 minute)
    };
    
    // Status messages for audio modes - tiered by intensity
    const audioStatusEN = {
        low: ['CHILLIN', 'VIBES', 'MELLOW'],                    // Low volume, gentle vibes
        medium: ['VIBING', 'FEELING IT', 'GROOVING'],           // Medium sustained volume
        high: ['SICK BEAT', 'RAD TUNES', 'PUMPING'],            // High volume
        banger: ['BANGER ALERT', 'ABSOLUTE UNIT', 'LEGENDARY'], // Sustained high volume (5+ seconds)
        silent: ['AUDIO IDLE', 'MONITORING...', 'SYS AUDIO ON'] // No audio detected
    };
    const audioStatusZH = {
        low: ['悠闲', '氛围', '轻柔'],
        medium: ['摇摆中', '感受旋律', '节奏感'],
        high: ['好听', '氛围拉满', '嗨起来'],
        banger: ['神曲警告', '绝绝子', '传奇时刻'],
        silent: ['音频待机', '监听中...', '系统音频开启']
    };
    
    // Sustained volume tracking for status tiers
    let highVolumeStartTime = 0;
    let isInHighVolume = false;
    const HIGH_VOLUME_THRESHOLD = 100;
    const BANGER_SUSTAIN_TIME = 5000; // 5 seconds of sustained high volume for "BANGER ALERT"
    
    function getAudioStatusTier(avgVolume) {
        const now = Date.now();
        
        // Track sustained high volume
        if (avgVolume > HIGH_VOLUME_THRESHOLD) {
            if (!isInHighVolume) {
                isInHighVolume = true;
                highVolumeStartTime = now;
            }
        } else {
            isInHighVolume = false;
        }
        
        // Determine tier based on volume and sustain
        if (isInHighVolume && (now - highVolumeStartTime > BANGER_SUSTAIN_TIME)) {
            return 'banger';
        } else if (avgVolume > HIGH_VOLUME_THRESHOLD) {
            return 'high';
        } else if (avgVolume > 50) {
            return 'medium';
        } else {
            return 'low';
        }
    }
    
    function getAudioStatus() {
        return currentLang === 'zh' ? audioStatusZH : audioStatusEN;
    }
    
    async function startAudioListening() {
        if (audioListening) return true;
        if (isRestartingAudio) return false;
        
        try {
            // Capture system audio via getDisplayMedia with OS-level loopback.
            // The main process intercepts this via setDisplayMediaRequestHandler,
            // automatically selecting the primary screen and enabling loopback audio
            // (WASAPI on Windows, ScreenCaptureKit on macOS 13+, PulseAudio/PipeWire on Linux).
            // Never falls back to microphone.
            audioStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,   // Required by spec; discarded immediately
                audio: true    // System audio via loopback
            });
            
            // Discard video track immediately - we only need audio
            audioStream.getVideoTracks().forEach(track => track.stop());
            
            const audioTracks = audioStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.error('System audio capture returned no audio tracks. On macOS, ensure Screen Recording permission is granted in System Settings > Privacy & Security. On Linux, ensure PulseAudio/PipeWire is running.');
                return false;
            }
            console.log('System audio capture started');
            
            // Monitor audio tracks for unexpected endings
            audioStream.getAudioTracks().forEach(track => {
                track.onended = () => {
                    console.warn('Audio track ended unexpectedly, will restart...');
                    scheduleAudioRestart();
                };
            });
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume AudioContext if suspended (browser autoplay policy)
            if (audioContext.state === 'suspended') {
                console.log('AudioContext suspended, resuming...');
                await audioContext.resume();
            }
            
            // Monitor AudioContext state changes
            audioContext.onstatechange = () => {
                console.log('AudioContext state changed to:', audioContext.state);
                if (audioContext.state === 'suspended' && audioListening) {
                    audioContext.resume().catch(err => {
                        console.warn('Failed to resume AudioContext:', err);
                    });
                } else if (audioContext.state === 'closed' && audioListening) {
                    console.warn('AudioContext closed, will restart...');
                    scheduleAudioRestart();
                }
            };
            
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 512;  // More frequency resolution
            audioAnalyser.smoothingTimeConstant = 0.5;  // Faster response to audio changes
            audioAnalyser.minDecibels = -90;  // More sensitive to quiet audio
            audioAnalyser.maxDecibels = -10;
            
            audioSource = audioContext.createMediaStreamSource(audioStream);
            audioSource.connect(audioAnalyser);
            
            audioListening = true;
            consecutiveZeroFrames = 0;
            audioDebugCounter = 0;
            lastMeaningfulAudioTime = Date.now();  // Assume fresh start
            console.log('Audio listening started, mode: system audio');
            
            // Start health check interval
            startAudioHealthCheck();
            
            analyzeAudio();
            
            const st = getAudioStatus();
            statusEl.textContent = pick(st.silent);
            
            return true;
        } catch (err) {
            console.error('System audio capture failed:', err.message,
                '- On macOS, grant Screen Recording permission in System Settings > Privacy & Security.',
                'On Linux, ensure PulseAudio/PipeWire is running.',
                'On Windows, check audio output device is active.');
            return false;
        }
    }
    
    let lastRestartAttempt = 0;
    let restartRetryCount = 0;
    let restartRetryTimeout = null;
    
    function scheduleAudioRestart() {
        if (isRestartingAudio) return;
        
        const now = Date.now();
        const timeSinceLastRestart = now - lastRestartAttempt;
        
        // Calculate backoff delay based on retry count
        const backoffDelay = Math.min(
            AUDIO_CONFIG.RESTART_COOLDOWN * Math.pow(2, restartRetryCount),
            AUDIO_CONFIG.RESTART_BACKOFF_MAX
        );
        
        // Respect cooldown with exponential backoff
        if (timeSinceLastRestart < backoffDelay) {
            console.log('Restart cooldown active, waiting... (retry', restartRetryCount, ', backoff', backoffDelay, 'ms)');
            // Schedule a retry when cooldown expires if not already scheduled
            if (!restartRetryTimeout) {
                restartRetryTimeout = setTimeout(() => {
                    restartRetryTimeout = null;
                    scheduleAudioRestart();
                }, backoffDelay - timeSinceLastRestart + 100);
            }
            return;
        }
        
        isRestartingAudio = true;
        lastRestartAttempt = now;
        
        console.log('Scheduling audio restart... (attempt', restartRetryCount + 1, ')');
        
        // Clean up and restart
        stopAudioListeningInternal();
        
        setTimeout(() => {
            isRestartingAudio = false;
            startAudioListening().then(success => {
                if (success) {
                    console.log('Audio successfully restarted');
                    restartRetryCount = 0; // Reset retry count on success
                } else {
                    restartRetryCount++;
                    console.warn('Audio restart failed (attempt', restartRetryCount, '), scheduling retry with backoff...');
                    // Schedule another retry with backoff
                    if (restartRetryCount <= AUDIO_CONFIG.RESTART_MAX_RETRIES) {
                        scheduleAudioRestart();
                    } else {
                        console.error('Audio restart max retries exceeded, will try again in', AUDIO_CONFIG.RESTART_BACKOFF_MAX / 1000, 'seconds');
                        // Schedule a long-delay retry to eventually recover
                        restartRetryTimeout = setTimeout(() => {
                            restartRetryTimeout = null;
                            restartRetryCount = 0; // Reset for fresh attempts
                            scheduleAudioRestart();
                        }, AUDIO_CONFIG.RESTART_BACKOFF_MAX);
                    }
                }
            });
        }, 1000);
    }
    
    function startAudioHealthCheck() {
        if (audioHealthCheckInterval) {
            clearInterval(audioHealthCheckInterval);
        }
        
        audioHealthCheckInterval = setInterval(() => {
            if (!audioListening) return;
            
            // Check if AudioContext is suspended
            if (audioContext && audioContext.state === 'suspended') {
                console.log('Health check: AudioContext suspended, resuming...');
                audioContext.resume().catch(() => {});
            }
            
            // Check if AudioContext is in a bad state
            if (audioContext && audioContext.state !== 'running') {
                console.warn('Health check: AudioContext not running (state:', audioContext.state, '), restarting...');
                scheduleAudioRestart();
                return;
            }
            
            // Check if audio tracks are still active
            if (audioStream) {
                const audioTracks = audioStream.getAudioTracks();
                const hasLiveTracks = audioTracks.some(track => track.readyState === 'live');
                
                if (!hasLiveTracks && audioTracks.length > 0) {
                    console.warn('Health check: No live audio tracks, restarting...');
                    scheduleAudioRestart();
                    return;
                }
                
                // Check for enabled tracks
                const hasEnabledTracks = audioTracks.some(track => track.enabled);
                if (!hasEnabledTracks && audioTracks.length > 0) {
                    console.warn('Health check: No enabled audio tracks, restarting...');
                    scheduleAudioRestart();
                    return;
                }
            }
            
            // Check if source is still connected
            if (!audioSource || !audioAnalyser) {
                console.warn('Health check: Audio source or analyser missing, restarting...');
                scheduleAudioRestart();
            }
        }, AUDIO_CONFIG.HEALTH_CHECK_INTERVAL);
    }
    
    function stopAudioHealthCheck() {
        if (audioHealthCheckInterval) {
            clearInterval(audioHealthCheckInterval);
            audioHealthCheckInterval = null;
        }
    }
    
    // Internal cleanup (used during restart - doesn't stop health check)
    function stopAudioListeningInternal() {
        audioListening = false;
        currentAudioMode = null;
        consecutiveZeroFrames = 0;
        
        if (audioAnimationFrame) {
            cancelAnimationFrame(audioAnimationFrame);
            audioAnimationFrame = null;
        }
        
        if (audioReactionTimeout) {
            clearTimeout(audioReactionTimeout);
            audioReactionTimeout = null;
        }
        
        // Disconnect source before stopping tracks
        if (audioSource) {
            try { audioSource.disconnect(); } catch(e) {}
            audioSource = null;
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => {
                track.onended = null; // Remove handler to prevent restart during cleanup
                track.stop();
            });
            audioStream = null;
        }
        
        if (audioContext) {
            audioContext.onstatechange = null; // Remove handler
            try { audioContext.close(); } catch(e) {}
            audioContext = null;
            audioAnalyser = null;
        }
        
        // Clear audio-reactive classes
        faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes');
        faceEl.classList.remove('rg-audio-music', 'rg-audio-voice');
    }
    
    function stopAudioListening() {
        stopAudioHealthCheck();
        stopAudioListeningInternal();
        // Reset retry state when manually stopped
        restartRetryCount = 0;
        if (restartRetryTimeout) {
            clearTimeout(restartRetryTimeout);
            restartRetryTimeout = null;
        }
    }
    
    function analyzeAudio() {
        if (!audioListening || !audioAnalyser) {
            console.log('analyzeAudio early return: audioListening=', audioListening, 'audioAnalyser=', !!audioAnalyser);
            return;
        }
        
        // Check AudioContext health - resume if suspended
        if (audioContext && audioContext.state === 'suspended') {
            console.log('AudioContext suspended, resuming...');
            audioContext.resume().catch(() => {});
        }
        
        // Skip analysis if paused due to app's own sounds
        if (audioReactionPaused) {
            audioAnimationFrame = requestAnimationFrame(analyzeAudio);
            return;
        }
        
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate overall volume
        let sum = 0;
        let hasAnyData = false;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
            if (dataArray[i] > 0) hasAnyData = true;
        }
        const avgVolume = sum / bufferLength;
        
        // Debug logging every ~2 seconds
        audioDebugCounter++;
        if (audioDebugCounter >= 120) {
            audioDebugCounter = 0;
            const secsSinceMeaningful = lastMeaningfulAudioTime ? ((Date.now() - lastMeaningfulAudioTime) / 1000).toFixed(1) : 'never';
            console.log('Audio levels - avgVolume:', avgVolume.toFixed(1), 'hasData:', hasAnyData, 'consecutiveZero:', consecutiveZeroFrames, 'lastMeaningful:', secsSinceMeaningful + 's ago');
        }
        
        // Track when we last saw meaningful (above threshold) audio
        if (avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD) {
            lastMeaningfulAudioTime = Date.now();
        }
        
        // Track consecutive frames with absolutely zero data (indicates dead stream)
        // Only consider it "dead" if we had audio recently - otherwise it's just silent
        // This prevents constant restarts when user isn't playing audio
        if (!hasAnyData && sum === 0) {
            consecutiveZeroFrames++;
            // Only restart if we had meaningful audio in the last 30 seconds AND now it's dead
            const hadRecentAudio = lastMeaningfulAudioTime && (Date.now() - lastMeaningfulAudioTime < 30000);
            if (consecutiveZeroFrames > AUDIO_CONFIG.ZERO_FRAME_THRESHOLD && hadRecentAudio) {
                console.warn('Detected dead audio stream (was playing, now zero data), restarting...');
                consecutiveZeroFrames = 0;
                scheduleAudioRestart();
                return;
            }
        } else {
            // Reset counter when we get any data
            consecutiveZeroFrames = 0;
        }
        
        // Calculate bass energy (for beat detection)
        const bassEnd = Math.floor(AUDIO_CONFIG.MUSIC_BASS_MAX / (audioContext.sampleRate / audioAnalyser.fftSize));
        let bassSum = 0;
        for (let i = 0; i < Math.min(bassEnd, bufferLength); i++) {
            bassSum += dataArray[i];
        }
        const bassEnergy = bassSum / Math.min(bassEnd, bufferLength);
        
        // Calculate mid-frequency energy (voice range)
        const voiceStart = Math.floor(AUDIO_CONFIG.VOICE_FREQUENCY_MIN / (audioContext.sampleRate / audioAnalyser.fftSize));
        const voiceEnd = Math.floor(AUDIO_CONFIG.VOICE_FREQUENCY_MAX / (audioContext.sampleRate / audioAnalyser.fftSize));
        let voiceSum = 0;
        for (let i = voiceStart; i < Math.min(voiceEnd, bufferLength); i++) {
            voiceSum += dataArray[i];
        }
        const voiceEnergy = voiceSum / (Math.min(voiceEnd, bufferLength) - voiceStart);
        
        const now = Date.now();
        
        // React if volume exceeds threshold - bass threshold gates the intensity of animation
        if (avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD) {
            lastAudioReaction = now;
            
            // React to audio intensity - pass bass for animation intensity selection
            reactToAudio(avgVolume, bassEnergy);
        } else {
            // Silence - fade out reactions after timeout
            if (now - lastAudioReaction > AUDIO_CONFIG.SILENCE_TIMEOUT && currentAudioMode) {
                currentAudioMode = null;
                faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes');
                faceEl.classList.remove('rg-audio-music', 'rg-audio-voice');
                
                // Re-enable breathing animation
                faceFlipWrapper.classList.add('rg-breathing');
                
                // Reset vibe direction state
                desiredLookDir = 'right';
                currentVibeFace = 'cool';
                lastDirectionChange = 0;
                
                // Return to neutral
                if (!locked && !isSleeping && !isWorking) {
                    setFace('awake');
                    const st = getAudioStatus();
                    statusEl.textContent = pick(st.silent);
                }
            }
        }
        
        // Broadcast audio levels to chat window for equalizer visualization
        // Sample 32 frequency bands for the equalizer bars
        if (window.electronAPI && window.electronAPI.sendAudioLevels) {
            const bands = 32;
            const bandSize = Math.floor(bufferLength / bands);
            const levels = [];
            for (let i = 0; i < bands; i++) {
                let sum = 0;
                for (let j = 0; j < bandSize; j++) {
                    sum += dataArray[i * bandSize + j];
                }
                levels.push(sum / bandSize);
            }
            // Send levels and whether audio is actively detected
            const isActive = avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD;
            window.electronAPI.sendAudioLevels({ levels, isActive, avgVolume });
        }
        
        audioAnimationFrame = requestAnimationFrame(analyzeAudio);
    }
    
    let lastAudioStatusUpdate = 0;
    const AUDIO_STATUS_COOLDOWN = 2000; // Only update status text every 2 seconds
    
    // Pause audio reaction briefly when app plays its own sounds
    let audioReactionPaused = false;
    let audioReactionPauseTimeout = null;
    const AUDIO_SELF_SOUND_PAUSE = 2500; // Ignore audio for 2.5 seconds after app plays sound
    
    // Helper to pause audio reaction
    function pauseAudioReaction(soundName) {
        audioReactionPaused = true;
        if (audioReactionPauseTimeout) clearTimeout(audioReactionPauseTimeout);
        audioReactionPauseTimeout = setTimeout(() => {
            audioReactionPaused = false;
        }, AUDIO_SELF_SOUND_PAUSE);
    }
    
    // Register with SoundSystem to pause during self-sounds (local sounds in main window)
    if (typeof SoundSystem !== 'undefined' && SoundSystem.onSoundPlay) {
        SoundSystem.onSoundPlay(pauseAudioReaction);
    }
    
    // Also listen for IPC sound notifications (sounds from chat window or other windows)
    if (window.electronAPI && window.electronAPI.onSoundPlayed) {
        window.electronAPI.onSoundPlayed(pauseAudioReaction);
    }
    
    // Vibe face rotation for variety (not just sunglasses pulsing)
    // Cool appears more often and stays longer
    const vibeFaces = ['cool', 'cool', 'look_l', 'cool', 'cool', 'look_r', 'cool', 'happy', 'cool', 'cool'];
    let lastVibeFaceIndex = 0;
    let lastVibeFaceChange = 0;
    const VIBE_FACE_INTERVAL = 800; // Change face every 800ms during vibing (slower, more chill)
    
    // Beat detection for syncing direction changes
    const BEAT_HISTORY_SIZE = 43; // ~43 frames at 60fps = ~700ms of history
    const BEAT_THRESHOLD_MULTIPLIER = 1.6; // Current bass must be 60% above average to trigger beat
    const BEAT_MIN_INTERVAL = 800; // Minimum ms between direction changes (holds each direction longer)
    const bassHistory = [];
    let lastBeatTime = 0;
    
    // Detect if there's a beat based on bass energy spike
    function detectBeat(bassEnergy) {
        const now = Date.now();
        
        // Add to history
        bassHistory.push(bassEnergy);
        if (bassHistory.length > BEAT_HISTORY_SIZE) {
            bassHistory.shift();
        }
        
        // Need enough history
        if (bassHistory.length < BEAT_HISTORY_SIZE / 2) return false;
        
        // Calculate average bass energy
        const avgBass = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;
        
        // Beat detected if current bass exceeds threshold and enough time has passed
        if (bassEnergy > avgBass * BEAT_THRESHOLD_MULTIPLIER && 
            bassEnergy > 30 && // Minimum absolute threshold
            now - lastBeatTime > BEAT_MIN_INTERVAL) {
            lastBeatTime = now;
            return true;
        }
        return false;
    }
    
    // Get flip wrapper for direction control during vibe
    const faceFlipWrapper = document.getElementById('face-flip-wrapper');
    
    // Track desired look direction ('left' or 'right') and current vibe face
    let desiredLookDir = 'right';
    let currentVibeFace = 'cool';
    let lastDirectionChange = 0;
    const DIRECTION_CHANGE_INTERVAL = 1500; // Flip direction at least every 1.5 seconds
    
    // Get the correct scaleX value for a face and desired direction
    // Some faces are already drawn looking a certain way:
    // - look_l: asset faces left, so scaleX(1) = left, scaleX(-1) = right
    // - look_r: asset faces right, so scaleX(1) = right, scaleX(-1) = left
    // - other faces: neutral, scaleX(-1) = left, scaleX(1) = right
    function getScaleForDirection(faceName, direction) {
        if (faceName === 'look_l') {
            // Asset faces left: no flip for left, flip for right
            return direction === 'left' ? 1 : -1;
        } else if (faceName === 'look_r') {
            // Asset faces right: no flip for right, flip for left
            return direction === 'left' ? -1 : 1;
        } else {
            // Neutral faces: flip for left, no flip for right
            return direction === 'left' ? -1 : 1;
        }
    }
    
    // Apply the current direction to the face
    function applyVibeDirection() {
        if (!faceFlipWrapper) return;
        const scale = getScaleForDirection(currentVibeFace, desiredLookDir);
        faceFlipWrapper.style.setProperty('--flip-dir', scale);
        faceFlipWrapper.style.transform = `scaleX(${scale})`;
    }
    
    // Flip direction (alternates left/right)
    function flipDirection() {
        desiredLookDir = desiredLookDir === 'left' ? 'right' : 'left';
        lastDirectionChange = Date.now();
        applyVibeDirection();
    }
    
    // Set the current vibe face and update direction accordingly
    function setVibeFace(faceName) {
        currentVibeFace = faceName;
        applyVibeDirection();
    }
    
    function reactToAudio(avgVolume, bassEnergy) {
        // Skip if paused due to app's own sounds
        if (audioReactionPaused) return;
        if (isSleeping || isWorking || locked) return;
        
        currentAudioMode = 'vibing';
        
        // Clear previous animation classes
        faceEl.classList.remove('rg-vibe', 'rg-headbob', 'rg-notes');
        faceEl.classList.add('rg-audio-music');
        
        // Disable breathing animation during vibe (its CSS transform conflicts with direction control)
        faceFlipWrapper.classList.remove('rg-breathing', 'rg-breathing-slow');
        
        const now = Date.now();
        const shouldUpdateStatus = now - lastAudioStatusUpdate > AUDIO_STATUS_COOLDOWN;
        const shouldChangeFace = now - lastVibeFaceChange > VIBE_FACE_INTERVAL;
        
        // Direction flipping: on beat OR at regular intervals (whichever comes first)
        const beatDetected = detectBeat(bassEnergy);
        const intervalElapsed = now - lastDirectionChange > DIRECTION_CHANGE_INTERVAL;
        
        if ((beatDetected && avgVolume > 50) || intervalElapsed) {
            flipDirection();
        }
        
        // Always apply direction on every frame to prevent drift
        applyVibeDirection();
        
        // Choose animation based on volume intensity
        if (avgVolume > 100) {
            // High energy - full dance with face variety
            faceEl.classList.remove('rg-vibe', 'rg-headbob');
            faceEl.classList.add('rg-dance');
            if (shouldChangeFace) {
                lastVibeFaceIndex = (lastVibeFaceIndex + 1) % vibeFaces.length;
                const newFace = vibeFaces[lastVibeFaceIndex];
                setFace(newFace);
                setVibeFace(newFace);
                lastVibeFaceChange = now;
            }
            if (shouldUpdateStatus) {
                const st = getAudioStatus();
                const tier = getAudioStatusTier(avgVolume);
                statusEl.textContent = pick(st[tier]);
                lastAudioStatusUpdate = now;
            }
        } else if (avgVolume > 50) {
            // Medium energy - vibe with face variety
            faceEl.classList.remove('rg-dance', 'rg-headbob');
            faceEl.classList.add('rg-vibe');
            if (shouldChangeFace) {
                lastVibeFaceIndex = (lastVibeFaceIndex + 1) % vibeFaces.length;
                const newFace = vibeFaces[lastVibeFaceIndex];
                setFace(newFace);
                setVibeFace(newFace);
                lastVibeFaceChange = now;
            }
            if (shouldUpdateStatus) {
                const st = getAudioStatus();
                const tier = getAudioStatusTier(avgVolume);
                statusEl.textContent = pick(st[tier]);
                lastAudioStatusUpdate = now;
            }
        } else {
            // Low energy - head bob
            faceEl.classList.remove('rg-dance', 'rg-vibe');
            faceEl.classList.add('rg-headbob');
            setFace('happy');
            if (shouldUpdateStatus) {
                statusEl.textContent = 'CHILLIN';
                lastAudioStatusUpdate = now;
            }
        }
    }

    function reactToMusic(bassEnergy, avgVolume) {
        if (isSleeping || isWorking || locked) return;
        
        // Choose animation based on intensity
        faceEl.classList.remove('rg-vibe', 'rg-headbob', 'rg-notes');
        faceEl.classList.add('rg-audio-music');
        
        if (bassEnergy > 80) {
            // High energy - full dance
            faceEl.classList.remove('rg-vibe', 'rg-headbob');
            faceEl.classList.add('rg-dance');
            setFace('excited');
        } else if (bassEnergy > 50) {
            // Medium energy - vibe
            faceEl.classList.remove('rg-dance', 'rg-headbob');
            faceEl.classList.add('rg-vibe');
            setFace('cool');
        } else {
            // Low energy - head bob
            faceEl.classList.remove('rg-dance', 'rg-vibe');
            faceEl.classList.add('rg-headbob');
            setFace('happy');
        }
        
        const st = getAudioStatus();
        statusEl.textContent = pick(st.music);
    }
    
    function reactToVoice(voiceEnergy) {
        if (isSleeping || isWorking || locked) return;
        
        faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-audio-music');
        faceEl.classList.add('rg-notes', 'rg-audio-voice');
        
        // Alternate between listening expressions
        if (voiceEnergy > 50) {
            setFace('smart');
        } else {
            setFace('debug');
        }
        
        const st = getAudioStatus();
        statusEl.textContent = pick(st.voice);
    }
    
    function setAudioListening(enabled) {
        if (enabled) {
            return startAudioListening();
        } else {
            stopAudioListening();
            return Promise.resolve(true);
        }
    }

    // === Initialization ===

    // === Public API ===

    return {
        react: react,
        assessHealth: assessHealth,
        handleSystemEvent: handleSystemEvent,
        setMood: setMood,
        setLanguage: setLanguage,
        setSleep: setSleep,
        setSleepAnimation: setSleepAnimation,
        setWork: setWork,
        setWorkAnimation: setWorkAnimation,
        setAudioListening: setAudioListening,
        setLevel: (lvl) => { currentLevel = lvl; },
        get level() { return currentLevel; },
        get mood() { return mood; },
        get petCount() { return petCount; },
        get language() { return currentLang; },
        get isSleeping() { return isSleeping; },
        get isWorking() { return isWorking; },
        get isListeningAudio() { return audioListening; }
    };

})();

// Expose globally for system integration
window.RG = RG;

// Listen for XP updates to track level for level-gated expressions
if (window.electronAPI && window.electronAPI.onXpUpdate) {
    window.electronAPI.onXpUpdate((data) => {
        if (data && typeof data.level === 'number' && RG.setLevel) {
            RG.setLevel(data.level);
        }
    });
}

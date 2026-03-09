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
        // Don't change face/status if sleeping or in work mode (pomodoro)
        if (isSleeping || isWorking) return;
        
        if (faces[mood]) {
            faceEl.src = faces[mood];
            // Notify chat window of sprite change for bro avatar
            if (window.electronAPI && window.electronAPI.updateSprite) {
                const spriteName = faces[mood].split('/').pop();
                window.electronAPI.updateSprite(spriteName);
            }
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
            faceEl.src = faces['sleep'];
            const st = getStatusText();
            statusEl.textContent = pick(st.sleep);
            container.classList.add('sleeping');
        } else {
            // Play wake sound
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('sleepEnd');
            // Wake up - return to normal
            container.classList.remove('sleeping');
            faceEl.src = faces['awake'];
            const st = getStatusText();
            statusEl.textContent = pick(st.awake);
        }
    }
    
    function setSleepAnimation(animation) {
        if (!isSleeping) return;
        if (faces[animation]) {
            faceEl.src = faces[animation];
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
            faceEl.src = faces['smart'];
            const st = getStatusText();
            statusEl.textContent = pick(st.smart);
        } else {
            // Exit work mode - return to normal
            container.classList.remove('working');
            faceEl.src = faces['happy'];  // Happy after completing work
            const st = getStatusText();
            statusEl.textContent = pick(st.happy);
        }
    }
    
    function setWorkAnimation(animation) {
        if (!isWorking) return;
        if (faces[animation]) {
            faceEl.src = faces[animation];
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
    let audioAnimationFrame = null;
    let lastAudioReaction = 0;
    let currentAudioMode = null; // 'music', 'voice', or null
    let audioReactionTimeout = null;
    
    // Audio detection thresholds
    const AUDIO_CONFIG = {
        VOLUME_THRESHOLD: 8,         // Min volume to react (0-255 scale) - lower for system audio
        MUSIC_BEAT_THRESHOLD: 0.4,   // Beat detection sensitivity
        VOICE_FREQUENCY_MIN: 85,     // Human voice ~85-255 Hz
        VOICE_FREQUENCY_MAX: 255,
        MUSIC_BASS_MAX: 150,         // Bass frequencies for beat detection
        REACTION_COOLDOWN: 200,      // ms between animation updates
        MODE_SWITCH_DELAY: 500,      // ms before switching music/voice mode
        SILENCE_TIMEOUT: 2000        // ms of silence before stopping reaction
    };
    
    // Status messages for audio modes
    const audioStatusEN = {
        music: ['VIBING', 'SICK BEAT', 'GROOVING', 'FEELING IT', 'RAD TUNES', 'BANGER ALERT'],
        voice: ['LISTENING', 'TAKING NOTES', 'PROCESSING', 'RECORDING', 'ATTENTION', 'COPY THAT'],
        silent: ['AUDIO IDLE', 'MONITORING...', 'SYS AUDIO ON']
    };
    const audioStatusZH = {
        music: ['摇摆中', '节奏感', '氛围拉满', '感受旋律', '好听', '神曲警告'],
        voice: ['聆听中', '记录中', '处理中', '录音中', '注意', '收到'],
        silent: ['音频待机', '监听中...', '系统音频开启']
    };
    
    function getAudioStatus() {
        return currentLang === 'zh' ? audioStatusZH : audioStatusEN;
    }
    
    async function startAudioListening() {
        if (audioListening) return true;
        
        let usingMicFallback = false;
        
        try {
            // Try desktop/system audio capture first
            let captureSuccess = false;
            
            if (window.electronAPI && window.electronAPI.getDesktopSources) {
                try {
                    const sources = await window.electronAPI.getDesktopSources();
                    if (sources && sources.length > 0) {
                        // Use the first screen source (captures all system audio)
                        const screenSource = sources.find(s => s.id.startsWith('screen:')) || sources[0];
                        
                        // Request system audio via desktop capturer
                        audioStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    chromeMediaSourceId: screenSource.id
                                }
                            },
                            video: {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    chromeMediaSourceId: screenSource.id,
                                    maxWidth: 1,
                                    maxHeight: 1,
                                    maxFrameRate: 1
                                }
                            }
                        });
                        
                        // We only need audio, stop the video track
                        audioStream.getVideoTracks().forEach(track => track.stop());
                        captureSuccess = true;
                        console.log('System audio capture started');
                    }
                } catch (desktopErr) {
                    console.warn('Desktop audio capture failed (HDR/GPU issue?), falling back to microphone:', desktopErr.message);
                }
            }
            
            // Fallback to microphone if desktop capture failed
            if (!captureSuccess) {
                console.log('Falling back to microphone audio capture');
                usingMicFallback = true;
                audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
            }
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume AudioContext if suspended (browser autoplay policy)
            if (audioContext.state === 'suspended') {
                console.log('AudioContext suspended, resuming...');
                await audioContext.resume();
            }
            
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 256;
            audioAnalyser.smoothingTimeConstant = 0.8;
            
            const source = audioContext.createMediaStreamSource(audioStream);
            source.connect(audioAnalyser);
            
            audioListening = true;
            console.log('Audio listening started, mode:', usingMicFallback ? 'microphone' : 'system audio');
            analyzeAudio();
            
            const st = getAudioStatus();
            statusEl.textContent = usingMicFallback ? 'MIC LISTEN' : pick(st.silent);
            
            return true;
        } catch (err) {
            console.error('Audio capture failed:', err);
            return false;
        }
    }
    
    function stopAudioListening() {
        audioListening = false;
        currentAudioMode = null;
        
        if (audioAnimationFrame) {
            cancelAnimationFrame(audioAnimationFrame);
            audioAnimationFrame = null;
        }
        
        if (audioReactionTimeout) {
            clearTimeout(audioReactionTimeout);
            audioReactionTimeout = null;
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
            audioAnalyser = null;
        }
        
        // Clear audio-reactive classes
        faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes');
        faceEl.classList.remove('rg-audio-music', 'rg-audio-voice');
    }
    
    function analyzeAudio() {
        if (!audioListening || !audioAnalyser) return;
        
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
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const avgVolume = sum / bufferLength;
        
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
        
        if (avgVolume > AUDIO_CONFIG.VOLUME_THRESHOLD) {
            lastAudioReaction = now;
            
            // React to audio intensity directly (simplified - no music/voice split)
            reactToAudio(avgVolume, bassEnergy);
        } else {
            // Silence - fade out reactions after timeout
            if (now - lastAudioReaction > AUDIO_CONFIG.SILENCE_TIMEOUT && currentAudioMode) {
                currentAudioMode = null;
                faceEl.classList.remove('rg-dance', 'rg-vibe', 'rg-headbob', 'rg-notes');
                faceEl.classList.remove('rg-audio-music', 'rg-audio-voice');
                
                // Return to neutral
                if (!locked && !isSleeping && !isWorking) {
                    faceEl.src = faces['awake'];
                    const st = getAudioStatus();
                    statusEl.textContent = pick(st.silent);
                }
            }
        }
        
        audioAnimationFrame = requestAnimationFrame(analyzeAudio);
    }
    
    let lastAudioStatusUpdate = 0;
    const AUDIO_STATUS_COOLDOWN = 2000; // Only update status text every 2 seconds
    
    // Pause audio reaction briefly when app plays its own sounds
    let audioReactionPaused = false;
    let audioReactionPauseTimeout = null;
    const AUDIO_SELF_SOUND_PAUSE = 2500; // Ignore audio for 2.5 seconds after app plays sound (accounts for mic latency)
    
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
    
    function reactToAudio(avgVolume, bassEnergy) {
        // Skip if paused due to app's own sounds
        if (audioReactionPaused) return;
        if (isSleeping || isWorking || locked) return;
        
        currentAudioMode = 'vibing';
        
        // Clear previous animation classes
        faceEl.classList.remove('rg-vibe', 'rg-headbob', 'rg-notes');
        faceEl.classList.add('rg-audio-music');
        
        const now = Date.now();
        const shouldUpdateStatus = now - lastAudioStatusUpdate > AUDIO_STATUS_COOLDOWN;
        
        // Choose animation based on volume intensity
        if (avgVolume > 100) {
            // High energy - full dance
            faceEl.classList.remove('rg-vibe', 'rg-headbob');
            faceEl.classList.add('rg-dance');
            faceEl.src = faces['excited'];
            if (shouldUpdateStatus) {
                const st = getAudioStatus();
                statusEl.textContent = pick(st.music);
                lastAudioStatusUpdate = now;
            }
        } else if (avgVolume > 50) {
            // Medium energy - vibe
            faceEl.classList.remove('rg-dance', 'rg-headbob');
            faceEl.classList.add('rg-vibe');
            faceEl.src = faces['cool'];
            if (shouldUpdateStatus) {
                const st = getAudioStatus();
                statusEl.textContent = pick(st.music);
                lastAudioStatusUpdate = now;
            }
        } else {
            // Low energy - head bob
            faceEl.classList.remove('rg-dance', 'rg-vibe');
            faceEl.classList.add('rg-headbob');
            faceEl.src = faces['happy'];
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
            faceEl.src = faces['excited'];
        } else if (bassEnergy > 50) {
            // Medium energy - vibe
            faceEl.classList.remove('rg-dance', 'rg-headbob');
            faceEl.classList.add('rg-vibe');
            faceEl.src = faces['cool'];
        } else {
            // Low energy - head bob
            faceEl.classList.remove('rg-dance', 'rg-vibe');
            faceEl.classList.add('rg-headbob');
            faceEl.src = faces['happy'];
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
            faceEl.src = faces['smart'];
        } else {
            faceEl.src = faces['debug'];
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

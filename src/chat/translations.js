// Chat translations — en/zh strings, language management

export const translations = {
    en: {
        classification: 'RB//WR',
        title: 'RAD TERMINAL',
        encrypted: 'ENCRYPTED',
        session: 'SESSION',
        placeholder: 'ENTER QUERY...',
        send: 'XMIT',
        processing: 'PROCESSING...',
        linkEstablished: 'LINK ESTABLISHED. AWAITING QUERY.',
        commsOffline: 'COMMS OFFLINE — Configure LLM endpoint via system tray',
        linkFailure: 'LINK FAILURE',
        err: 'ERR',
        copy: 'COPY',
        copied: 'COPIED',
        error: 'ERROR',
        operator: 'OPERATOR',
        bro: 'BRO',
        system: 'SYSTEM',
        mov: 'MOV',
        col: 'COL',
        sleep: 'ZZZ',
        stats: 'STAT',
        pomo: 'WORK',
        hunger: 'PWR',
        energy: 'BND',
        uptime: 'UPTIME',
        clicks: 'CLICKS',
        msgs: 'MSGS',
        sessions: 'SESSIONS',
        streak: 'STREAK',
        best: 'BEST',
        stasis: 'STASIS',
        deepest: 'DEEPEST',
        work: 'WORK',
        days: 'days',
        langToggle: '中文',
        movOptions: { none: 'NONE', bounce: 'BOUNCE', follow: 'FOLLOW', wander: 'WANDER' },
        colOptions: { '#ff3344': 'RED', '#00ffff': 'CYAN', '#39ff14': 'GREEN', '#bf00ff': 'PURPLE', '#ff1493': 'PINK', '#ff6600': 'ORANGE', '#ffd700': 'YELLOW', '#00bfff': 'BLUE', '#00ff00': 'LIME', '#ffffff': 'WHITE' }
    },
    zh: {
        classification: '机密//绝密',
        title: 'RAD 终端',
        encrypted: '已加密',
        session: '会话',
        placeholder: '输入查询...',
        send: '发送',
        processing: '处理中...',
        linkEstablished: '链接已建立，等待查询。',
        commsOffline: '通讯离线 — 通过系统托盘配置LLM端点',
        linkFailure: '链接失败',
        err: '错误',
        copy: '复制',
        copied: '已复制',
        error: '错误',
        operator: '操作员',
        bro: '兄弟',
        system: '系统',
        mov: '动作',
        col: '颜色',
        sleep: '睡眠',
        stats: '统计',
        pomo: '专注',
        hunger: '能量',
        energy: '带宽',
        uptime: '运行',
        clicks: '点击',
        msgs: '消息',
        sessions: '会话',
        streak: '连续',
        best: '最佳',
        stasis: '休眠',
        deepest: '最深',
        work: '专注',
        days: '天',
        langToggle: 'EN',
        movOptions: { none: '无', bounce: '弹跳', follow: '跟随', wander: '漫游' },
        colOptions: { '#ff3344': '红', '#00ffff': '青', '#39ff14': '绿', '#bf00ff': '紫', '#ff1493': '粉', '#ff6600': '橙', '#ffd700': '黄', '#00bfff': '蓝', '#00ff00': '草绿', '#ffffff': '白' }
    }
};

export const networkTranslations = {
    en: {
        title: 'RAD MESH',
        assets: 'ASSETS',
        scanning: 'SCANNING PERIMETER...',
        noAssets: 'NO ASSETS DETECTED',
        nodeOnline: 'ASSET ONLINE',
        nodeOffline: 'ASSET OFFLINE',
    },
    zh: {
        title: 'RAD 网络',
        assets: '资产',
        scanning: '扫描周界...',
        noAssets: '未检测到资产',
        nodeOnline: '资产上线',
        nodeOffline: '资产离线',
    }
};

export const sleepMessages = {
    en: { start: 'DORMANT CYCLE INITIATED', elapsed: 'STASIS DURATION', end: 'SYSTEM REACTIVATED' },
    zh: { start: '休眠周期已启动', elapsed: '休眠时长', end: '系统已重新激活' }
};

let currentLang = 'en';

// Restore saved language
try {
    const saved = localStorage.getItem('radgotchi-lang');
    if (saved === 'zh') currentLang = 'zh';
} catch(e) {}

export function getCurrentLang() { return currentLang; }
export function setCurrentLang(lang) { currentLang = lang; }

export function updateLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    const sessionIdEl = document.getElementById('session-id');

    document.querySelector('.classification').textContent = t.classification;
    document.querySelector('.terminal-title').textContent = t.title;
    document.querySelector('.status-indicator span:last-child').textContent = t.encrypted;
    document.querySelector('.info-bar span:first-child').innerHTML = t.session + ': <span id="session-id">' + sessionIdEl.textContent + '</span>';
    document.getElementById('input').placeholder = t.placeholder;
    document.getElementById('send-btn').textContent = t.send;

    document.getElementById('label-mov').textContent = t.mov;
    document.getElementById('label-col').textContent = t.col;
    document.getElementById('label-sleep').textContent = t.sleep;
    document.getElementById('label-pomo').textContent = t.pomo;
    document.getElementById('toggle-lang').textContent = t.langToggle;
    document.getElementById('label-hunger').textContent = t.hunger;
    document.getElementById('label-energy').textContent = t.energy;
    document.getElementById('label-uptime').textContent = t.uptime;
    document.getElementById('label-clicks').textContent = t.clicks;
    document.getElementById('label-msgs').textContent = t.msgs;
    document.getElementById('label-sessions').textContent = t.sessions;
    document.getElementById('label-streak').textContent = t.streak;
    document.getElementById('label-best').textContent = t.best;
    document.getElementById('label-stasis').textContent = t.stasis;
    document.getElementById('label-deepest').textContent = t.deepest;
    document.getElementById('label-work').textContent = t.work;

    const selectMovement = document.getElementById('select-movement');
    Array.from(selectMovement.options).forEach(opt => {
        opt.textContent = t.movOptions[opt.value];
    });
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.title = t.colOptions[swatch.dataset.color];
    });
    document.querySelectorAll('.copy-btn').forEach(btn => {
        if (!btn.classList.contains('copied')) btn.textContent = t.copy;
    });
    document.querySelectorAll('.message.user').forEach(msg => {
        msg.style.setProperty('--operator-label', '"' + t.operator + '"');
    });
    document.querySelectorAll('.message.assistant').forEach(msg => {
        msg.style.setProperty('--bro-label', '"' + t.bro + '"');
    });
    document.querySelectorAll('.message.system').forEach(msg => {
        msg.style.setProperty('--system-label', '"' + t.system + '"');
    });
}

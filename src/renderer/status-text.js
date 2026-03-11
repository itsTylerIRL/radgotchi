// Status text pools and language management

let currentLang = localStorage.getItem('radgotchi-lang') || 'en';

export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function getLanguage() { return currentLang; }

export function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('radgotchi-lang', lang);
}

// === Mood Status Text — English ===
export const statusTextEN = {
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

// === Mood Status Text — Chinese ===
export const statusTextZH = {
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

export function getStatusText() {
    return currentLang === 'zh' ? statusTextZH : statusTextEN;
}

// === System Event Status — English ===
export const systemEventStatusEN = {
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

// === System Event Status — Chinese ===
export const systemEventStatusZH = {
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

export function getSystemEventStatus() {
    return currentLang === 'zh' ? systemEventStatusZH : systemEventStatusEN;
}

// === Audio Status Text ===
export const audioStatusEN = {
    low: ['CHILLIN', 'VIBES', 'MELLOW'],
    medium: ['VIBING', 'FEELING IT', 'GROOVING'],
    high: ['SICK BEAT', 'RAD TUNES', 'PUMPING'],
    banger: ['BANGER ALERT', 'ABSOLUTE UNIT', 'LEGENDARY'],
    silent: ['AUDIO IDLE', 'MONITORING...', 'SYS AUDIO ON']
};

export const audioStatusZH = {
    low: ['悠闲', '氛围', '轻柔'],
    medium: ['摇摆中', '感受旋律', '节奏感'],
    high: ['好听', '氛围拉满', '嗨起来'],
    banger: ['神曲警告', '绝绝子', '传奇时刻'],
    silent: ['音频待机', '监听中...', '系统音频开启']
};

export function getAudioStatus() {
    return currentLang === 'zh' ? audioStatusZH : audioStatusEN;
}

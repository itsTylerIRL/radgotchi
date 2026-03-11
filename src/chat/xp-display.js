// XP, needs, pomodoro, stats display

import SoundSystem from '../renderer/sounds.js';
import { getCurrentLang } from './translations.js';
import { addMessage } from './messages.js';

const levelBar = document.getElementById('level-bar');
const levelBadge = document.getElementById('level-badge');
const rankBadge = document.getElementById('rank-badge');
const rankList = document.getElementById('rank-list');
const rankTooltipTitle = document.getElementById('rank-tooltip-title');
const xpLabel = document.getElementById('xp-label');
const xpPercent = document.getElementById('xp-percent');
const xpFill = document.getElementById('xp-fill');
const xpTotal = document.getElementById('xp-total');
const hungerFill = document.getElementById('hunger-fill');
const hungerValue = document.getElementById('hunger-value');
const energyFill = document.getElementById('energy-fill');
const energyValue = document.getElementById('energy-value');
const pomodoroBar = document.getElementById('pomodoro-bar');
const pomoMode = document.getElementById('pomo-mode');
const pomoTimer = document.getElementById('pomo-timer');
const pomoFill = document.getElementById('pomo-fill');
const pomoCount = document.getElementById('pomo-count');
const statsPanel = document.getElementById('stats-panel');

const RANKS = [
    { name: 'TRAINEE', nameZh: '见习员', minLevel: 1 },
    { name: 'ANALYST', nameZh: '分析员', minLevel: 3 },
    { name: 'OPERATIVE', nameZh: '行动员', minLevel: 5 },
    { name: 'AGENT', nameZh: '特工', minLevel: 8 },
    { name: 'SPECIALIST', nameZh: '专家', minLevel: 11 },
    { name: 'HANDLER', nameZh: '指挥官', minLevel: 14 },
    { name: 'CONTROLLER', nameZh: '控制者', minLevel: 17 },
    { name: 'DIRECTOR', nameZh: '主管', minLevel: 20 },
    { name: 'EXECUTIVE', nameZh: '执行官', minLevel: 24 },
    { name: 'OVERSEER', nameZh: '监察官', minLevel: 28 },
    { name: 'SENTINEL', nameZh: '哨兵', minLevel: 33 },
    { name: 'ARCHITECT', nameZh: '架构师', minLevel: 40 },
    { name: 'PHANTOM', nameZh: '幻影', minLevel: 50 }
];

function formatTime(ms) {
    const min = Math.floor(Math.floor(ms / 1000) / 60);
    const sec = Math.floor(ms / 1000) % 60;
    return min.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0');
}

function formatUptime(ms) {
    return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
}

function populateRankTooltip(currentLevel) {
    const lang = getCurrentLang();
    rankList.innerHTML = '';
    rankTooltipTitle.textContent = lang === 'zh' ? '等级列表' : 'CLEARANCE LEVELS';
    RANKS.forEach((rd, i) => {
        const li = document.createElement('li');
        li.className = 'rank-list-item';
        li.innerHTML = '<span class="rank-name">' + (lang === 'zh' ? rd.nameZh : rd.name) + '</span><span class="rank-level">L' + rd.minLevel + '</span>';
        const next = RANKS[i + 1];
        const isCurrent = currentLevel >= rd.minLevel && (!next || currentLevel < next.minLevel);
        if (isCurrent) li.classList.add('current');
        else if (currentLevel < rd.minLevel) li.classList.add('locked');
        rankList.appendChild(li);
    });
}

export function updateXpDisplay(xpData, animate = false) {
    if (!xpData) return;
    const { level, totalXp, xpIntoLevel, xpNeeded, progress, leveledUp, leveledDown, xpLost, source,
            rank, rankZh, totalClicks, totalMessages, totalSessions, totalUptimeMs, currentStreak, longestStreak,
            totalStasis, deepestStasis, workStarted, workCompleted, hunger, energy } = xpData;
    const lang = getCurrentLang();

    levelBadge.textContent = 'LV ' + level;
    xpLabel.textContent = 'XP: ' + xpIntoLevel + ' / ' + xpNeeded;
    xpPercent.textContent = Math.round(progress * 100) + '%';
    xpFill.style.width = (progress * 100) + '%';
    xpTotal.textContent = 'TOTAL: ' + totalXp;

    if (rank) { rankBadge.textContent = lang === 'zh' ? rankZh : rank; populateRankTooltip(level); }
    if (totalUptimeMs !== undefined) document.getElementById('stat-uptime').textContent = formatUptime(totalUptimeMs);
    if (totalClicks !== undefined) document.getElementById('stat-clicks').textContent = totalClicks;
    if (totalMessages !== undefined) document.getElementById('stat-messages').textContent = totalMessages;
    if (totalSessions !== undefined) document.getElementById('stat-sessions').textContent = totalSessions;
    if (currentStreak !== undefined) document.getElementById('stat-streak').textContent = currentStreak + (lang === 'zh' ? ' 天' : ' days');
    if (longestStreak !== undefined) document.getElementById('stat-best').textContent = longestStreak + (lang === 'zh' ? ' 天' : ' days');
    if (totalStasis !== undefined) document.getElementById('stat-stasis').textContent = formatUptime(totalStasis);
    if (deepestStasis !== undefined) document.getElementById('stat-deepest').textContent = formatUptime(deepestStasis);
    if (workCompleted !== undefined && workStarted !== undefined) document.getElementById('stat-work').textContent = workCompleted + ' (' + workStarted + ')';
    if (hunger !== undefined) updateNeedsDisplay({ hunger, energy });

    if (leveledUp && animate) {
        SoundSystem.play('levelUp');
        levelBar.classList.add('level-up-flash');
        levelBadge.style.animation = 'none';
        levelBadge.offsetHeight;
        levelBadge.style.animation = 'level-up-glow 1s ease-out';
        const newRank = lang === 'zh' ? rankZh : rank;
        const lvlMsg = lang === 'zh' ? '🎉 等级提升！已达到 ' + level + ' 级！ [' + newRank + ']' : '🎉 LEVEL UP! Now level ' + level + '! [' + newRank + ']';
        addMessage('system', lvlMsg, false, null, true);
        setTimeout(() => levelBar.classList.remove('level-up-flash'), 500);
    }
    if (leveledDown && animate) {
        SoundSystem.play('xpLoss');
        levelBar.classList.add('level-down-flash');
        const lvlMsg = lang === 'zh' ? '📉 等级下降！降至 ' + level + ' 级...' : '📉 LEVEL DOWN! Dropped to level ' + level + '...';
        addMessage('system', lvlMsg, false, null, true);
        setTimeout(() => levelBar.classList.remove('level-down-flash'), 500);
    }
    if (xpLost && animate && source && (source === 'idle-decay' || source === 'attention-neglect')) {
        xpTotal.classList.add('xp-loss-flash');
        setTimeout(() => xpTotal.classList.remove('xp-loss-flash'), 300);
    }
}

export function updateNeedsDisplay(needs) {
    if (!needs) return;
    const { hunger, energy, hungerLow, energyLow } = needs;
    hungerFill.style.width = hunger + '%';
    hungerValue.textContent = Math.round(hunger);
    energyFill.style.width = energy + '%';
    energyValue.textContent = Math.round(energy);
    hungerFill.classList.toggle('low', hunger < 30 || !!hungerLow);
    energyFill.classList.toggle('low', energy < 30 || !!energyLow);
}

export function updatePomodoroDisplay(data) {
    if (!data) return;
    const { active, mode, remaining, pomosCompleted, progress } = data;
    const lang = getCurrentLang();
    const togglePomo = document.getElementById('toggle-pomo');
    if (active) {
        pomodoroBar.classList.add('visible');
        togglePomo.classList.add('active');
        pomodoroBar.classList.toggle('work-mode', mode === 'work');
        pomodoroBar.classList.toggle('break-mode', mode === 'break');
        pomoMode.textContent = mode === 'work' ? (lang === 'zh' ? '专注' : 'WORK') : (lang === 'zh' ? '休息' : 'BREAK');
        pomoMode.className = 'pomo-mode ' + mode;
        pomoTimer.textContent = formatTime(remaining);
        pomoFill.style.width = (progress * 100) + '%';
    } else {
        pomodoroBar.classList.remove('visible');
        togglePomo.classList.remove('active');
    }
    pomoCount.textContent = '🍅 ' + pomosCompleted;
}

// Stats toggle
levelBadge.addEventListener('click', () => {
    levelBadge.classList.toggle('active');
    statsPanel.classList.toggle('visible');
    SoundSystem.play(statsPanel.classList.contains('visible') ? 'statsOpen' : 'statsClose');
});

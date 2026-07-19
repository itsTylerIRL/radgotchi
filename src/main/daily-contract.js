'use strict';

// Daily Contracts — one rank-flavored objective per day with an XP bounty.
// Deterministic per date; progress is fed by xp-system source hooks and arcade.

const { broadcastToWindows } = require('./broadcast');

const CONTRACT_TEMPLATES = [
    {
        id: 'pomos', type: 'pomodoro', target: 2, bounty: 60,
        brief: 'Complete {n} focus cycles', briefZh: '完成 {n} 个专注周期',
    },
    {
        id: 'messages', type: 'messages', target: 8, bounty: 50,
        brief: 'Exchange {n} transmissions', briefZh: '交换 {n} 条通讯',
    },
    {
        id: 'clicks', type: 'clicks', target: 25, bounty: 40,
        brief: 'Make {n} direct contacts', briefZh: '进行 {n} 次直接接触',
    },
    {
        id: 'feed', type: 'feed', target: 1, bounty: 30,
        brief: 'Resupply: use {n} inventory item', briefZh: '补给：使用 {n} 件库存物品',
    },
    {
        id: 'gamble', type: 'gamble-win', target: 2, bounty: 70,
        brief: 'Win {n} wagers in the arcade', briefZh: '在游戏厅赢 {n} 次赌注',
    },
];

const STORE_KEY = 'dailyContract';

let _persistence = null;
let _addActivityLogEntry = null;
let _addXp = null;

let contract = null; // { date, templateId, progress, completed }

function init({ persistence, addActivityLogEntry, addXp }) {
    _persistence = persistence;
    _addActivityLogEntry = addActivityLogEntry;
    _addXp = addXp;
}

function todayKey() {
    return new Date().toDateString();
}

// Deterministic template pick per date, so restarting doesn't reroll
function templateForDate(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return CONTRACT_TEMPLATES[Math.abs(hash) % CONTRACT_TEMPLATES.length];
}

function getTemplate() {
    if (!contract) return null;
    return CONTRACT_TEMPLATES.find(t => t.id === contract.templateId) || null;
}

function save() {
    if (_persistence && contract) {
        _persistence.updateWindowStateProperty(STORE_KEY, 'contract', contract);
    }
}

// Create today's contract if it doesn't exist yet; announce it once
function ensureToday() {
    if (!_persistence) return;
    if (contract && contract.date === todayKey()) return;

    const saved = _persistence.getWindowState(STORE_KEY, {}).contract;
    if (saved && saved.date === todayKey()) {
        contract = saved;
        return;
    }

    const template = templateForDate(todayKey());
    contract = { date: todayKey(), templateId: template.id, progress: 0, completed: false };
    save();

    if (_addActivityLogEntry) {
        const brief = template.brief.replace('{n}', template.target);
        const briefZh = template.briefZh.replace('{n}', template.target);
        _addActivityLogEntry('contract',
            `📋 DAILY DIRECTIVE: ${brief} [BOUNTY: ${template.bounty} XP]`,
            `📋 每日指令：${briefZh} [赏金：${template.bounty} XP]`);
    }
}

// Called by xp-system / arcade when a trackable event happens
function recordEvent(type) {
    ensureToday();
    if (!contract || contract.completed) return;
    const template = getTemplate();
    if (!template || template.type !== type) return;

    contract.progress++;
    if (contract.progress >= template.target) {
        contract.completed = true;
        save();
        if (_addActivityLogEntry) {
            _addActivityLogEntry('contract',
                `✅ DIRECTIVE COMPLETE — ${template.bounty} XP bounty paid.`,
                `✅ 指令完成 — 已支付 ${template.bounty} XP 赏金。`);
        }
        broadcastToWindows('pet-react', {
            mood: 'motivated',
            status: 'DIRECTIVE COMPLETE',
            statusZh: '指令完成',
            anim: 'rg-bounce',
            duration: 3500,
        });
        if (_addXp) _addXp(template.bounty, 'contract');
    } else {
        save();
    }
}

// For chat-ready payload — briefing shown when the chat window opens
function getStatus() {
    ensureToday();
    if (!contract) return null;
    const template = getTemplate();
    if (!template) return null;
    return {
        brief: template.brief.replace('{n}', template.target),
        briefZh: template.briefZh.replace('{n}', template.target),
        progress: contract.progress,
        target: template.target,
        bounty: template.bounty,
        completed: contract.completed,
    };
}

module.exports = {
    init,
    ensureToday,
    recordEvent,
    getStatus,
};

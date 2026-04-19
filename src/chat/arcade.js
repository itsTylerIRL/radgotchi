// Arcade UI — games, shop, and inventory panel
// Renders inside the arcade-bar element in chat.html

import SoundSystem from '../renderer/sounds.js';
import { getCurrentLang } from './translations.js';
import { addMessage, playArcadeBetReaction, playArcadeWinReaction, playArcadeLoseReaction, playArcadeDealReaction, playArcadeJackpotReaction } from './messages.js';

// ═══════════════════════════════════════════════════════════════════════════
// DOM Elements
// ═══════════════════════════════════════════════════════════════════════════

const arcadeBar = document.getElementById('arcade-bar');
const arcadeHeader = document.getElementById('arcade-header');
const arcadeExpandBtn = document.getElementById('arcade-expand-btn');
const arcadeOpenBtn = document.getElementById('arcade-open-btn');
const arcadePanel = document.getElementById('arcade-panel');
const inventorySlots = document.getElementById('inventory-slots');

// Tab buttons
const tabBtnGames = document.getElementById('arcade-tab-games');
const tabBtnShop = document.getElementById('arcade-tab-shop');

// Panels
const gamesPanel = document.getElementById('arcade-games');
const shopPanel = document.getElementById('arcade-shop');
const shopItems = document.getElementById('shop-items');

// Coinflip elements
const cfBetInput = document.getElementById('cf-bet');
const cfHeadsBtn = document.getElementById('cf-heads');
const cfTailsBtn = document.getElementById('cf-tails');
const cfResult = document.getElementById('cf-result');

// Blackjack elements
const bjBetInput = document.getElementById('bj-bet');
const bjDealBtn = document.getElementById('bj-deal');
const bjHitBtn = document.getElementById('bj-hit');
const bjStandBtn = document.getElementById('bj-stand');
const bjDoubleBtn = document.getElementById('bj-double');
const bjDealerCards = document.getElementById('bj-dealer-cards');
const bjPlayerCards = document.getElementById('bj-player-cards');
const bjDealerValue = document.getElementById('bj-dealer-value');
const bjPlayerValue = document.getElementById('bj-player-value');
const bjResult = document.getElementById('bj-result');
const bjTable = document.getElementById('bj-table');

// Stats
const statWins = document.getElementById('arcade-stat-wins');
const statLosses = document.getElementById('arcade-stat-losses');
const statProfit = document.getElementById('arcade-stat-profit');

let currentTab = 'games';
let blackjackActive = false;

// ═══════════════════════════════════════════════════════════════════════════
// Tab switching
// ═══════════════════════════════════════════════════════════════════════════

function switchTab(tab) {
    currentTab = tab;
    tabBtnGames.classList.toggle('active', tab === 'games');
    tabBtnShop.classList.toggle('active', tab === 'shop');
    gamesPanel.classList.toggle('hidden', tab !== 'games');
    shopPanel.classList.toggle('hidden', tab !== 'shop');
}

tabBtnGames.addEventListener('click', () => { switchTab('games'); SoundSystem.play('hover'); });
tabBtnShop.addEventListener('click', () => { switchTab('shop'); SoundSystem.play('hover'); });

// ═══════════════════════════════════════════════════════════════════════════
// Arcade toggle
// ═══════════════════════════════════════════════════════════════════════════

arcadeOpenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    arcadeBar.classList.toggle('collapsed');
    SoundSystem.play('click');
});

arcadeHeader.addEventListener('click', () => {
    arcadeBar.classList.toggle('collapsed');
    SoundSystem.play('hover');
});

arcadeExpandBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    arcadeBar.classList.toggle('collapsed');
});

// Start collapsed
arcadeBar.classList.add('collapsed');

// ═══════════════════════════════════════════════════════════════════════════
// Coinflip
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function playCoinflip(choice) {
    const bet = parseInt(cfBetInput.value, 10);
    if (!bet || bet < 1) {
        cfResult.textContent = 'ENTER A BET';
        return;
    }

    cfHeadsBtn.disabled = true;
    cfTailsBtn.disabled = true;
    cfResult.textContent = '🪙 FLIPPING...';
    cfResult.className = 'cf-result flipping';
    playArcadeBetReaction();

    // Brief animation delay
    await new Promise(r => setTimeout(r, 400));

    try {
        const res = await window.electronAPI.arcadeCoinflip(bet, choice);
        if (!res.success) {
            cfResult.textContent = res.reason === 'insufficient-xp'
                ? `NOT ENOUGH XP (NEED ${res.need})`
                : `INVALID BET (${res.min}-${res.max} XP)`;
            cfResult.className = 'cf-result error';
        } else if (res.won) {
            cfResult.innerHTML = `${res.result === 'heads' ? '🪙' : '🔄'} ${res.result.toUpperCase()} — YOU WIN <span class="xp-gain">+${res.profit} XP</span>`;
            cfResult.className = 'cf-result win';
            SoundSystem.play('levelUp');
            playArcadeWinReaction();
        } else {
            cfResult.innerHTML = `${res.result === 'heads' ? '🪙' : '🔄'} ${res.result.toUpperCase()} — YOU LOSE <span class="xp-loss">-${bet} XP</span>`;
            cfResult.className = 'cf-result lose';
            SoundSystem.play('hover');
            playArcadeLoseReaction();
        }
    } catch (e) {
        cfResult.textContent = 'ERROR';
        cfResult.className = 'cf-result error';
    }

    cfHeadsBtn.disabled = false;
    cfTailsBtn.disabled = false;
}

cfHeadsBtn.addEventListener('click', () => playCoinflip('heads'));
cfTailsBtn.addEventListener('click', () => playCoinflip('tails'));

// ═══════════════════════════════════════════════════════════════════════════
// Blackjack
// ═══════════════════════════════════════════════════════════════════════════

function renderCards(container, cards, hide) {
    container.innerHTML = '';
    cards.forEach((card, i) => {
        const cardEl = document.createElement('span');
        cardEl.className = 'bj-card';
        if (card === '??') {
            cardEl.classList.add('face-down');
            cardEl.textContent = '🂠';
        } else {
            cardEl.textContent = card;
            // Color red suits
            if (card.includes('♥') || card.includes('♦')) {
                cardEl.classList.add('red');
            }
        }
        container.appendChild(cardEl);
    });
}

function setBjControls(state) {
    const dealing = state === 'dealing';
    const playing = state === 'playing';
    const idle = state === 'idle';

    bjBetInput.disabled = !idle;
    bjDealBtn.disabled = !idle;
    bjHitBtn.disabled = !playing;
    bjStandBtn.disabled = !playing;
    bjDoubleBtn.disabled = !playing;
    bjTable.classList.toggle('active', playing || dealing);
    blackjackActive = playing;
}

async function dealBlackjack() {
    const bet = parseInt(bjBetInput.value, 10);
    if (!bet || bet < 1) {
        bjResult.textContent = 'ENTER A BET';
        return;
    }

    setBjControls('dealing');
    bjResult.textContent = '';
    bjDealerCards.innerHTML = '';
    bjPlayerCards.innerHTML = '';
    bjDealerValue.textContent = '';
    bjPlayerValue.textContent = '';

    try {
        const res = await window.electronAPI.arcadeBlackjackDeal(bet);
        if (!res.success) {
            bjResult.textContent = res.reason === 'insufficient-xp'
                ? `NOT ENOUGH XP (NEED ${res.need})`
                : res.reason === 'game-in-progress' ? 'FINISH CURRENT HAND' : `INVALID BET (${res.min}-${res.max} XP)`;
            bjResult.className = 'bj-result error';
            setBjControls('idle');
            return;
        }

        if (res.state === 'complete') {
            renderBlackjackResult(res);
            return;
        }

        renderCards(bjDealerCards, res.dealer);
        renderCards(bjPlayerCards, res.player);
        bjDealerValue.textContent = res.dealerShowing;
        bjPlayerValue.textContent = res.playerValue;
        bjDoubleBtn.disabled = !res.canDouble;
        setBjControls('playing');
        SoundSystem.play('click');
        playArcadeDealReaction();
    } catch (e) {
        bjResult.textContent = 'ERROR';
        setBjControls('idle');
    }
}

async function bjAction(action) {
    let res;
    try {
        if (action === 'hit') res = await window.electronAPI.arcadeBlackjackHit();
        else if (action === 'stand') res = await window.electronAPI.arcadeBlackjackStand();
        else if (action === 'double') res = await window.electronAPI.arcadeBlackjackDouble();

        if (!res || !res.success) {
            bjResult.textContent = res?.reason || 'ERROR';
            setBjControls('idle');
            return;
        }

        if (res.state === 'playing') {
            renderCards(bjPlayerCards, res.player);
            bjPlayerValue.textContent = res.playerValue;
            bjDoubleBtn.disabled = true; // Can only double on first action
            SoundSystem.play('hover');
        } else if (res.state === 'complete') {
            renderBlackjackResult(res);
        }
    } catch (e) {
        bjResult.textContent = 'ERROR';
        setBjControls('idle');
    }
}

function renderBlackjackResult(res) {
    renderCards(bjDealerCards, res.dealer);
    renderCards(bjPlayerCards, res.player);
    bjDealerValue.textContent = res.dealerValue;
    bjPlayerValue.textContent = res.playerValue;

    const outcomeLabels = {
        'blackjack': '🃏 BLACKJACK!',
        'win': '✅ YOU WIN',
        'dealer-bust': '💥 DEALER BUSTS',
        'push': '🤝 PUSH',
        'bust': '💀 BUST',
        'lose': '❌ DEALER WINS',
    };

    const label = outcomeLabels[res.outcome] || res.outcome.toUpperCase();

    if (res.profit > 0) {
        bjResult.innerHTML = `${label} <span class="xp-gain">+${res.profit} XP</span>`;
        bjResult.className = 'bj-result win';
        SoundSystem.play('levelUp');
        if (res.outcome === 'blackjack') playArcadeJackpotReaction();
        else playArcadeWinReaction();
    } else if (res.profit < 0) {
        bjResult.innerHTML = `${label} <span class="xp-loss">${res.profit} XP</span>`;
        bjResult.className = 'bj-result lose';
        SoundSystem.play('hover');
        playArcadeLoseReaction();
    } else {
        bjResult.textContent = `${label} — BET RETURNED`;
        bjResult.className = 'bj-result push';
    }

    setBjControls('idle');
}

bjDealBtn.addEventListener('click', dealBlackjack);
bjHitBtn.addEventListener('click', () => bjAction('hit'));
bjStandBtn.addEventListener('click', () => bjAction('stand'));
bjDoubleBtn.addEventListener('click', () => bjAction('double'));

// ═══════════════════════════════════════════════════════════════════════════
// Shop
// ═══════════════════════════════════════════════════════════════════════════

export function renderShop(items) {
    if (!items || !Array.isArray(items)) return;
    shopItems.innerHTML = '';
    const lang = getCurrentLang();

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
            <span class="shop-item-icon">${item.icon}</span>
            <div class="shop-item-info">
                <span class="shop-item-name">${escapeHtml(lang === 'zh' ? item.nameZh : item.name)}</span>
                <span class="shop-item-desc">${escapeHtml(lang === 'zh' ? item.descriptionZh : item.description)}</span>
            </div>
            <button class="shop-buy-btn" data-item-id="${escapeHtml(item.id)}">${item.cost} XP</button>
        `;
        el.querySelector('.shop-buy-btn').addEventListener('click', async () => {
            const res = await window.electronAPI.arcadeBuyItem(item.id);
            if (res.success) {
                SoundSystem.play('click');
                addMessage('system', `🛒 ${lang === 'zh' ? '购买了' : 'Purchased'} ${item.icon} ${lang === 'zh' ? item.nameZh : item.name}`);
            } else if (res.reason === 'insufficient-xp') {
                SoundSystem.play('hover');
                addMessage('system', `❌ ${lang === 'zh' ? 'XP不足' : 'Not enough XP'} (${lang === 'zh' ? '需要' : 'need'} ${res.need})`);
            }
        });
        shopItems.appendChild(el);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Inventory display (visible on main chat page)
// ═══════════════════════════════════════════════════════════════════════════

export function updateInventory(inv) {
    if (!inv) return;
    inventorySlots.innerHTML = '';

    const entries = Object.entries(inv);
    if (entries.length === 0) {
        const emptyEl = document.createElement('span');
        emptyEl.className = 'inventory-empty';
        emptyEl.textContent = getCurrentLang() === 'zh' ? '空背包' : 'EMPTY';
        inventorySlots.appendChild(emptyEl);
        return;
    }

    entries.forEach(([itemId, count]) => {
        // Look up item definition from SHOP_ITEMS loaded at init
        const item = window.__ARCADE_SHOP_ITEMS?.[itemId];
        if (!item) return;

        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.title = `${getCurrentLang() === 'zh' ? item.nameZh : item.name} (x${count}) — ${getCurrentLang() === 'zh' ? '点击使用' : 'Click to use'}`;
        slot.innerHTML = `<span class="inv-icon">${item.icon}</span><span class="inv-count">${count}</span>`;
        slot.addEventListener('click', async () => {
            const res = await window.electronAPI.arcadeUseItem(itemId);
            if (res.success) {
                SoundSystem.play('milestone');
                const lang = getCurrentLang();
                addMessage('system', `${item.icon} ${lang === 'zh' ? '使用了' : 'Used'} ${lang === 'zh' ? item.nameZh : item.name}`);
            }
        });
        inventorySlots.appendChild(slot);
    });
}

export function updateGameStats(stats) {
    if (!stats) return;
    const totalWins = (stats.coinflipWins || 0) + (stats.blackjackWins || 0);
    const totalLosses = (stats.coinflipLosses || 0) + (stats.blackjackLosses || 0);
    const totalProfit = (stats.coinflipProfit || 0) + (stats.blackjackProfit || 0);

    if (statWins) statWins.textContent = totalWins;
    if (statLosses) statLosses.textContent = totalLosses;
    if (statProfit) {
        statProfit.textContent = (totalProfit >= 0 ? '+' : '') + totalProfit;
        statProfit.className = 'arcade-stat-value ' + (totalProfit >= 0 ? 'positive' : 'negative');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Init / State restore
// ═══════════════════════════════════════════════════════════════════════════

export async function initArcade() {
    try {
        const state = await window.electronAPI.arcadeGetState();
        if (state) {
            // Cache shop items for inventory tooltip lookups
            if (state.shopItems) {
                window.__ARCADE_SHOP_ITEMS = {};
                state.shopItems.forEach(item => { window.__ARCADE_SHOP_ITEMS[item.id] = item; });
                renderShop(state.shopItems);
            }
            updateInventory(state.inventory);
            updateGameStats(state.gameStats);

            // Restore active blackjack if any
            if (state.blackjackActive && state.blackjackState) {
                const s = state.blackjackState;
                renderCards(bjDealerCards, s.dealer);
                renderCards(bjPlayerCards, s.player);
                bjDealerValue.textContent = s.dealerShowing;
                bjPlayerValue.textContent = s.playerValue;
                bjBetInput.value = s.bet;
                setBjControls('playing');
                bjDoubleBtn.disabled = !s.canDouble;
            }
        }
    } catch (e) {
        console.error('Failed to init arcade:', e);
    }
}

// Handle live updates from main process
export function handleArcadeUpdate(data) {
    if (data.inventory) updateInventory(data.inventory);
    if (data.gameStats) updateGameStats(data.gameStats);
}

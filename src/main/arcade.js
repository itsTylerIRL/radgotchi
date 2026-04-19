'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// ARCADE — Games, shop, and inventory system
//
// Games: coinflip, blackjack — bet XP to win more XP
// Shop: spend XP to buy consumable items that restore pet stats
// Inventory: persistent item storage
// ═══════════════════════════════════════════════════════════════════════════

const { broadcastToWindows } = require('./broadcast');

// Shop items — spend XP, get stat boosts
const SHOP_ITEMS = {
    'ration-pack': {
        name: 'RATION PACK',
        nameZh: '口粮包',
        description: 'Restores 50% hunger',
        descriptionZh: '恢复50%饥饿值',
        cost: 50,
        icon: '🍱',
        effect: { type: 'hunger', amount: 50 },
    },
    'energy-cell': {
        name: 'ENERGY CELL',
        nameZh: '能量核心',
        description: 'Restores 50% energy',
        descriptionZh: '恢复50%能量值',
        cost: 50,
        icon: '🔋',
        effect: { type: 'energy', amount: 50 },
    },
    'stim-shot': {
        name: 'STIM SHOT',
        nameZh: '兴奋剂',
        description: 'Restores 25% of both stats',
        descriptionZh: '恢复两项数值各25%',
        cost: 40,
        icon: '💉',
        effect: { type: 'both', amount: 25 },
    },
    'full-restore': {
        name: 'FULL RESTORE',
        nameZh: '完全修复',
        description: 'Restores all stats to 100%',
        descriptionZh: '所有数值恢复至100%',
        cost: 150,
        icon: '✨',
        effect: { type: 'both', amount: 100 },
    },
};

// Game configs
const COINFLIP_MIN_BET = 5;
const COINFLIP_MAX_BET = 500;
const COINFLIP_PAYOUT = 1.8; // Slight house edge: 2x * 0.9

const BLACKJACK_MIN_BET = 10;
const BLACKJACK_MAX_BET = 500;

// Blackjack helpers
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Dependencies
let _xpSystem = null;
let _petNeeds = null;
let _persistence = null;
let _addActivityLogEntry = null;

// State
let inventory = {};
let gameStats = {
    coinflipWins: 0,
    coinflipLosses: 0,
    coinflipProfit: 0,
    blackjackWins: 0,
    blackjackLosses: 0,
    blackjackPushes: 0,
    blackjackProfit: 0,
    totalWagered: 0,
    totalWon: 0,
};

// Active blackjack game state
let activeBlackjack = null;

function init({ xpSystem, petNeeds, persistence, addActivityLogEntry }) {
    _xpSystem = xpSystem;
    _petNeeds = petNeeds;
    _persistence = persistence;
    _addActivityLogEntry = addActivityLogEntry;
    loadArcadeData();
}

// ═══════════════════════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════════════════════

function loadArcadeData() {
    const data = _persistence.loadArcadeDataFromDisk();
    if (data) {
        inventory = data.inventory || {};
        gameStats = { ...gameStats, ...(data.gameStats || {}) };
    }
}

function saveArcadeData() {
    _persistence.saveArcadeDataToDisk({ inventory, gameStats });
}

// ═══════════════════════════════════════════════════════════════════════════
// Inventory
// ═══════════════════════════════════════════════════════════════════════════

function getInventory() {
    return { ...inventory };
}

function useItem(itemId) {
    if (!inventory[itemId] || inventory[itemId] <= 0) {
        return { success: false, reason: 'no-item' };
    }
    const item = SHOP_ITEMS[itemId];
    if (!item) return { success: false, reason: 'invalid-item' };

    inventory[itemId]--;
    if (inventory[itemId] <= 0) delete inventory[itemId];

    // Apply effect
    _petNeeds.feedPet(item.effect.amount, item.effect.type);

    saveArcadeData();
    broadcastArcadeUpdate();

    return { success: true, item: itemId, remaining: inventory[itemId] || 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Shop
// ═══════════════════════════════════════════════════════════════════════════

function getShopItems() {
    return Object.entries(SHOP_ITEMS).map(([id, item]) => ({
        id,
        ...item,
    }));
}

function buyItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return { success: false, reason: 'invalid-item' };

    const xpData = _xpSystem.getXpData();
    if (xpData.totalXp < item.cost) {
        return { success: false, reason: 'insufficient-xp', need: item.cost, have: xpData.totalXp };
    }

    _xpSystem.removeXp(item.cost, 'shop-purchase');
    inventory[itemId] = (inventory[itemId] || 0) + 1;

    saveArcadeData();
    broadcastArcadeUpdate();

    return { success: true, item: itemId, count: inventory[itemId], xpSpent: item.cost };
}

// ═══════════════════════════════════════════════════════════════════════════
// Coinflip
// ═══════════════════════════════════════════════════════════════════════════

function playCoinflip(bet, choice) {
    bet = Math.floor(Number(bet));
    if (!bet || bet < COINFLIP_MIN_BET || bet > COINFLIP_MAX_BET) {
        return { success: false, reason: 'invalid-bet', min: COINFLIP_MIN_BET, max: COINFLIP_MAX_BET };
    }

    const xpData = _xpSystem.getXpData();
    if (xpData.totalXp < bet) {
        return { success: false, reason: 'insufficient-xp', need: bet, have: xpData.totalXp };
    }

    // Normalize choice
    const playerChoice = (choice === 'heads' || choice === 'h') ? 'heads' : 'tails';
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = playerChoice === result;

    gameStats.totalWagered += bet;

    if (won) {
        const winnings = Math.floor(bet * COINFLIP_PAYOUT);
        const profit = winnings - bet;
        _xpSystem.addXp(profit, 'coinflip-win');
        gameStats.coinflipWins++;
        gameStats.coinflipProfit += profit;
        gameStats.totalWon += winnings;
        saveArcadeData();
        broadcastArcadeUpdate();
        return { success: true, won: true, result, choice: playerChoice, bet, winnings, profit };
    } else {
        _xpSystem.removeXp(bet, 'coinflip-loss');
        gameStats.coinflipLosses++;
        gameStats.coinflipProfit -= bet;
        saveArcadeData();
        broadcastArcadeUpdate();
        return { success: true, won: false, result, choice: playerChoice, bet, winnings: 0, profit: -bet };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Blackjack
// ═══════════════════════════════════════════════════════════════════════════

function _createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function _cardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value, 10);
}

function _handValue(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
        total += _cardValue(card);
        if (card.value === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function _cardStr(card) {
    return card.value + card.suit;
}

function _handStr(hand) {
    return hand.map(_cardStr);
}

function startBlackjack(bet) {
    if (activeBlackjack) {
        return { success: false, reason: 'game-in-progress' };
    }

    bet = Math.floor(Number(bet));
    if (!bet || bet < BLACKJACK_MIN_BET || bet > BLACKJACK_MAX_BET) {
        return { success: false, reason: 'invalid-bet', min: BLACKJACK_MIN_BET, max: BLACKJACK_MAX_BET };
    }

    const xpData = _xpSystem.getXpData();
    if (xpData.totalXp < bet) {
        return { success: false, reason: 'insufficient-xp', need: bet, have: xpData.totalXp };
    }

    const deck = _createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    activeBlackjack = { deck, playerHand, dealerHand, bet, doubledDown: false };
    gameStats.totalWagered += bet;

    const playerValue = _handValue(playerHand);
    const dealerValue = _handValue(dealerHand);

    // Check natural blackjack
    if (playerValue === 21 && dealerValue === 21) {
        // Push
        return _endBlackjack('push');
    }
    if (playerValue === 21) {
        // Player blackjack — 3:2 payout
        return _endBlackjack('blackjack');
    }

    return {
        success: true,
        state: 'playing',
        player: _handStr(playerHand),
        playerValue,
        dealer: [_cardStr(dealerHand[0]), '??'],
        dealerShowing: _cardValue(dealerHand[0]),
        bet,
        canDouble: xpData.totalXp >= bet * 2 && playerHand.length === 2,
    };
}

function blackjackHit() {
    if (!activeBlackjack) return { success: false, reason: 'no-game' };

    const { deck, playerHand } = activeBlackjack;
    playerHand.push(deck.pop());
    const value = _handValue(playerHand);

    if (value > 21) {
        return _endBlackjack('bust');
    }
    if (value === 21) {
        // Auto-stand at 21
        return _blackjackDealerPlay();
    }

    return {
        success: true,
        state: 'playing',
        player: _handStr(playerHand),
        playerValue: value,
        dealer: [_cardStr(activeBlackjack.dealerHand[0]), '??'],
        canDouble: false, // Can only double on first action
    };
}

function blackjackStand() {
    if (!activeBlackjack) return { success: false, reason: 'no-game' };
    return _blackjackDealerPlay();
}

function blackjackDouble() {
    if (!activeBlackjack) return { success: false, reason: 'no-game' };

    const game = activeBlackjack;
    if (game.playerHand.length !== 2) {
        return { success: false, reason: 'cannot-double' };
    }

    const xpData = _xpSystem.getXpData();
    if (xpData.totalXp < game.bet) {
        return { success: false, reason: 'insufficient-xp' };
    }

    game.bet *= 2;
    game.doubledDown = true;
    gameStats.totalWagered += game.bet / 2; // Additional wager

    // Draw exactly one card, then stand
    game.playerHand.push(game.deck.pop());
    const value = _handValue(game.playerHand);

    if (value > 21) return _endBlackjack('bust');
    return _blackjackDealerPlay();
}

function _blackjackDealerPlay() {
    const { deck, dealerHand, playerHand } = activeBlackjack;
    let dealerValue = _handValue(dealerHand);

    // Dealer hits on soft 17 and below
    while (dealerValue < 17) {
        dealerHand.push(deck.pop());
        dealerValue = _handValue(dealerHand);
    }

    const playerValue = _handValue(playerHand);

    if (dealerValue > 21) return _endBlackjack('dealer-bust');
    if (playerValue > dealerValue) return _endBlackjack('win');
    if (playerValue < dealerValue) return _endBlackjack('lose');
    return _endBlackjack('push');
}

function _endBlackjack(outcome) {
    const game = activeBlackjack;
    if (!game) return { success: false, reason: 'no-game' };

    const { bet, playerHand, dealerHand } = game;
    const playerValue = _handValue(playerHand);
    const dealerValue = _handValue(dealerHand);

    let payout = 0;
    let profit = 0;

    switch (outcome) {
        case 'blackjack':
            payout = Math.floor(bet * 2.5); // 3:2
            profit = payout - bet;
            _xpSystem.addXp(profit, 'blackjack-win');
            gameStats.blackjackWins++;
            break;
        case 'win':
        case 'dealer-bust':
            payout = bet * 2;
            profit = bet;
            _xpSystem.addXp(profit, 'blackjack-win');
            gameStats.blackjackWins++;
            break;
        case 'push':
            payout = bet; // Return bet
            profit = 0;
            gameStats.blackjackPushes++;
            break;
        case 'bust':
        case 'lose':
            payout = 0;
            profit = -bet;
            _xpSystem.removeXp(bet, 'blackjack-loss');
            gameStats.blackjackLosses++;
            break;
    }

    gameStats.blackjackProfit += profit;
    if (profit > 0) gameStats.totalWon += payout;

    activeBlackjack = null;
    saveArcadeData();
    broadcastArcadeUpdate();

    return {
        success: true,
        state: 'complete',
        outcome,
        player: _handStr(playerHand),
        playerValue,
        dealer: _handStr(dealerHand),
        dealerValue,
        bet,
        payout,
        profit,
    };
}

function getBlackjackState() {
    if (!activeBlackjack) return null;
    const { playerHand, dealerHand, bet } = activeBlackjack;
    return {
        player: _handStr(playerHand),
        playerValue: _handValue(playerHand),
        dealer: [_cardStr(dealerHand[0]), '??'],
        dealerShowing: _cardValue(dealerHand[0]),
        bet,
        canDouble: activeBlackjack.playerHand.length === 2,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// State & Broadcast
// ═══════════════════════════════════════════════════════════════════════════

function getArcadeState() {
    return {
        inventory: { ...inventory },
        gameStats: { ...gameStats },
        shopItems: getShopItems(),
        blackjackActive: !!activeBlackjack,
        blackjackState: getBlackjackState(),
    };
}

function broadcastArcadeUpdate() {
    broadcastToWindows('arcade-update', {
        inventory: { ...inventory },
        gameStats: { ...gameStats },
    });
}

module.exports = {
    SHOP_ITEMS,
    init,
    getInventory,
    useItem,
    getShopItems,
    buyItem,
    playCoinflip,
    startBlackjack,
    blackjackHit,
    blackjackStand,
    blackjackDouble,
    getBlackjackState,
    getArcadeState,
};

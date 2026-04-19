'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Network Discovery — thin adapter over RadMesh
//
// Maintains backward-compatible API for all consumers (windows.js,
// web-server.js, main.js) while delegating to the RadMesh module for
// reliable peer discovery and messaging.
// ═══════════════════════════════════════════════════════════════════════════

const RadMesh = require('./rad-mesh');
const broadcast = require('./broadcast');

const mesh = new RadMesh();

// Callbacks set during init
let _getXpData = null;
let _getLlmConfig = null;
let _getRank = null;
let _getIsSleeping = null;
let _getIsVibing = null;
let _getPomodoroState = null;
let _getNeeds = null;
let _getColor = null;

function init({ getXpData, getLlmConfig, getRank, getIsSleeping, getIsVibing, getPomodoroState, getNeeds, getColor }) {
    _getXpData = getXpData;
    _getLlmConfig = getLlmConfig;
    _getRank = getRank;
    _getIsSleeping = getIsSleeping;
    _getIsVibing = getIsVibing;
    _getPomodoroState = getPomodoroState;
    _getNeeds = getNeeds;
    _getColor = getColor || (() => '#ff3344');

    // Wire up presence builder — RadMesh calls this every heartbeat
    mesh.setPresenceBuilder(() => {
        const xpData = _getXpData();
        const llmConfig = _getLlmConfig();
        const level = xpData?.level || 1;
        const rank = _getRank(level)?.name || 'TRAINEE';

        let activity = 'idle';
        if (_getIsSleeping && _getIsSleeping()) activity = 'sleeping';
        else if (_getPomodoroState && _getPomodoroState().active) activity = _getPomodoroState().mode === 'work' ? 'grinding' : 'break';
        else if (_getIsVibing && _getIsVibing()) activity = 'vibing';

        const needs = _getNeeds ? _getNeeds() : {};

        return {
            level,
            rank,
            operatorName: llmConfig?.operatorName || 'OPERATOR',
            activity,
            hunger: typeof needs.hunger === 'number' ? Math.round(needs.hunger) : 100,
            energy: typeof needs.energy === 'number' ? Math.round(needs.energy) : 100,
            color: _getColor(),
        };
    });

    // Wire mesh events → IPC broadcasts to renderer windows
    mesh.on('peer-online', (node) => broadcastNetworkUpdate('node-online', node));
    mesh.on('peer-update', (node) => broadcastNetworkUpdate('node-update', node));
    mesh.on('peer-stale', (node) => broadcastNetworkUpdate('node-stale', node));
    mesh.on('peer-offline', (node) => broadcastNetworkUpdate('node-offline', node));
    mesh.on('message', (data) => broadcastNetworkUpdate('mesh-message', data));
    mesh.on('error', (err) => console.error('RadMesh error:', err.message));
}

function broadcastNetworkUpdate(eventType, nodeData) {
    const payload = {
        type: eventType,
        node: nodeData,
        totalNodes: mesh.getPeers().length,
    };
    broadcast.broadcastToWindows('network-update', payload);
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — same signatures as before
// ═══════════════════════════════════════════════════════════════════════════

function startNetworkDiscovery() {
    mesh.start();
}

function stopNetworkDiscovery() {
    mesh.stop();
}

function getDiscoveredNodes() {
    return mesh.getPeers();
}

function getNetworkStatus() {
    return mesh.getStatus();
}

function sendMeshMessage(text) {
    const llmConfig = _getLlmConfig();
    const operatorName = llmConfig?.operatorName || 'OPERATOR';
    return !!mesh.sendMessage(text, operatorName);
}

function getLocalNodeId() {
    return mesh.nodeId;
}

module.exports = {
    init,
    startNetworkDiscovery,
    stopNetworkDiscovery,
    getDiscoveredNodes,
    getNetworkStatus,
    sendMeshMessage,
    getLocalNodeId,
};

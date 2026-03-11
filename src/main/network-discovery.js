'use strict';

const os = require('os');
const dgram = require('dgram');

const NETWORK_CONFIG = {
    PORT: 47823,
    BROADCAST_INTERVAL_MS: 5000,
    STALE_THRESHOLD_MS: 15000,
    CLEANUP_INTERVAL_MS: 10000,
    PROTOCOL_VERSION: 'SIGINT-1.0',
};

let networkDiscoveryEnabled = false;
let udpSocket = null;
let broadcastInterval = null;
let cleanupInterval = null;
let discoveredNodes = new Map();
let localNodeId = null;

// Callbacks set during init
let _getXpData = null;
let _getLlmConfig = null;
let _getRank = null;
let _getChatWindow = null;

function init({ getXpData, getLlmConfig, getRank, getChatWindow }) {
    _getXpData = getXpData;
    _getLlmConfig = getLlmConfig;
    _getRank = getRank;
    _getChatWindow = getChatWindow;
}

function generateNodeId() {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RG-${randomPart}`;
}

function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    ip: iface.address,
                    broadcast: calculateBroadcastAddress(iface.address, iface.netmask)
                });
            }
        }
    }
    return addresses;
}

function calculateBroadcastAddress(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcast = ipParts.map((octet, i) => octet | (~maskParts[i] & 255));
    return broadcast.join('.');
}

function startNetworkDiscovery() {
    if (networkDiscoveryEnabled) return;

    localNodeId = generateNodeId();

    try {
        udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        udpSocket.on('error', (err) => {
            console.error('Network discovery socket error:', err);
            stopNetworkDiscovery();
        });

        udpSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.protocol !== NETWORK_CONFIG.PROTOCOL_VERSION) return;
                if (data.nodeId === localNodeId) return;

                const nodeData = {
                    nodeId: data.nodeId,
                    hostname: data.hostname,
                    ip: rinfo.address,
                    port: rinfo.port,
                    level: data.level || 1,
                    rank: data.rank || 'TRAINEE',
                    operatorName: data.operatorName || 'UNKNOWN',
                    lastSeen: Date.now(),
                    signalStrength: calculateSignalStrength(rinfo.address),
                };

                const isNew = !discoveredNodes.has(data.nodeId);
                discoveredNodes.set(data.nodeId, nodeData);
                broadcastNetworkUpdate(isNew ? 'node-online' : 'node-update', nodeData);
            } catch (e) {
                // Invalid message, ignore
            }
        });

        udpSocket.on('listening', () => {
            udpSocket.setBroadcast(true);
            networkDiscoveryEnabled = true;
            broadcastInterval = setInterval(broadcastPresence, NETWORK_CONFIG.BROADCAST_INTERVAL_MS);
            broadcastPresence();
            cleanupInterval = setInterval(cleanupStaleNodes, NETWORK_CONFIG.CLEANUP_INTERVAL_MS);
            console.log(`Network discovery active on port ${NETWORK_CONFIG.PORT}`);
        });

        udpSocket.bind(NETWORK_CONFIG.PORT);
    } catch (err) {
        console.error('Failed to start network discovery:', err);
    }
}

function stopNetworkDiscovery() {
    networkDiscoveryEnabled = false;

    if (broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
    }
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    if (udpSocket) {
        try { udpSocket.close(); } catch (e) {}
        udpSocket = null;
    }

    discoveredNodes.forEach((node) => {
        broadcastNetworkUpdate('node-offline', node);
    });
    discoveredNodes.clear();
}

function broadcastPresence() {
    if (!udpSocket || !networkDiscoveryEnabled) return;

    const xpData = _getXpData();
    const llmConfig = _getLlmConfig();
    const level = xpData?.level || 1;
    const rank = _getRank(level)?.name || 'TRAINEE';

    const message = JSON.stringify({
        protocol: NETWORK_CONFIG.PROTOCOL_VERSION,
        nodeId: localNodeId,
        hostname: os.hostname(),
        level: level,
        rank: rank,
        operatorName: llmConfig?.operatorName || 'OPERATOR',
        timestamp: Date.now(),
    });

    const buffer = Buffer.from(message);
    const addresses = getLocalIpAddresses();

    addresses.forEach(addr => {
        try {
            udpSocket.send(buffer, 0, buffer.length, NETWORK_CONFIG.PORT, addr.broadcast);
        } catch (e) {
            // Ignore send errors
        }
    });
}

function cleanupStaleNodes() {
    const now = Date.now();
    const staleThreshold = now - NETWORK_CONFIG.STALE_THRESHOLD_MS;

    discoveredNodes.forEach((node, nodeId) => {
        if (node.lastSeen < staleThreshold) {
            discoveredNodes.delete(nodeId);
            broadcastNetworkUpdate('node-offline', node);
        }
    });
}

function calculateSignalStrength(remoteIp) {
    const localAddresses = getLocalIpAddresses();
    let strength = 'WEAK';

    for (const local of localAddresses) {
        const localParts = local.ip.split('.');
        const remoteParts = remoteIp.split('.');
        if (localParts[0] === remoteParts[0] && localParts[1] === remoteParts[1]) {
            if (localParts[2] === remoteParts[2]) {
                strength = 'STRONG';
            } else {
                strength = 'MODERATE';
            }
        }
    }
    return strength;
}

function broadcastNetworkUpdate(eventType, nodeData) {
    const chatWindow = _getChatWindow();
    if (chatWindow && chatWindow.webContents) {
        chatWindow.webContents.send('network-update', {
            type: eventType,
            node: nodeData,
            totalNodes: discoveredNodes.size,
        });
    }
}

function getDiscoveredNodes() {
    return Array.from(discoveredNodes.values());
}

function getNetworkStatus() {
    return {
        enabled: networkDiscoveryEnabled,
        localNodeId: localNodeId,
        nodeCount: discoveredNodes.size,
        nodes: getDiscoveredNodes(),
    };
}

module.exports = {
    init,
    startNetworkDiscovery,
    stopNetworkDiscovery,
    getDiscoveredNodes,
    getNetworkStatus,
};

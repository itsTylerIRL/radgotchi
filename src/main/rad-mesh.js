'use strict';

const os = require('os');
const dgram = require('dgram');
const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════════════
// RAD MESH — Reliable peer discovery & messaging over UDP broadcast
// ═══════════════════════════════════════════════════════════════════════════
//
// Events emitted:
//   'peer-online'  (peerData)       — new peer discovered
//   'peer-update'  (peerData)       — existing peer heartbeat
//   'peer-stale'   (peerData)       — peer missed heartbeats, connection shaky
//   'peer-offline' (peerData)       — peer timed out, removed
//   'message'      (messageData)    — mesh message received
//   'started'      ()               — mesh is up and listening
//   'stopped'      ()               — mesh has shut down
//   'error'        (err)            — non-fatal socket error
//
// Peer states: ONLINE → STALE → OFFLINE (removed)

const MESH_CONFIG = {
    PORT: 47823,
    PROTOCOL_VERSION: 'SIGINT-1.0',

    // Heartbeat timing
    HEARTBEAT_INTERVAL_MS: 3000,        // broadcast presence every 3s (was 5s)
    HEARTBEAT_JITTER_MS: 500,           // ±500ms random jitter to prevent sync storms

    // Peer state thresholds (multiples of heartbeat interval)
    STALE_AFTER_MISSED: 3,              // 3 missed = ~9s → mark stale
    OFFLINE_AFTER_MISSED: 6,            // 6 missed = ~18s → mark offline
    CLEANUP_INTERVAL_MS: 3000,          // check for stale peers every 3s

    // Messages
    MESSAGE_MAX_LENGTH: 200,
    MESSAGE_RETRY_COUNT: 2,             // 2 retries = 3 total sends
    MESSAGE_RETRY_DELAY_MS: 150,        // 150ms between retries

    // Dedup (TTL-based instead of size-based)
    DEDUP_TTL_MS: 60000,               // expire dedup entries after 60s
    DEDUP_CLEANUP_INTERVAL_MS: 30000,  // purge expired entries every 30s

    // Socket recovery
    SOCKET_MAX_RECOVERY_ATTEMPTS: 5,
    SOCKET_RECOVERY_DELAY_MS: 2000,
};

class RadMesh extends EventEmitter {
    constructor(config = {}) {
        super();
        this._config = { ...MESH_CONFIG, ...config };
        this._running = false;
        this._socket = null;
        this._heartbeatTimer = null;
        this._cleanupTimer = null;
        this._dedupCleanupTimer = null;
        this._recoveryAttempts = 0;
        this._recovering = false;

        // Identity
        this._nodeId = null;

        // Peer tracking
        this._peers = new Map();  // nodeId → PeerEntry

        // Message dedup: msgId → timestamp
        this._seenMessages = new Map();

        // Presence payload builder — set via setPresenceBuilder()
        this._buildPresence = null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Set a function that returns the presence payload fields to broadcast.
     * Called every heartbeat. Should return an object with app-specific fields
     * (hostname, level, rank, operatorName, activity, hunger, energy, color, etc.)
     */
    setPresenceBuilder(fn) {
        this._buildPresence = fn;
    }

    /**
     * Start the mesh — bind socket, begin heartbeats and peer cleanup.
     */
    start() {
        if (this._running) return;
        this._nodeId = this._generateNodeId();
        this._recoveryAttempts = 0;
        this._createSocket();
    }

    /**
     * Stop the mesh — close socket, notify peers offline, clean up.
     */
    stop() {
        if (!this._running && !this._recovering) return;
        this._running = false;
        this._recovering = false;

        this._clearTimers();

        if (this._socket) {
            try { this._socket.close(); } catch (e) { /* ignore */ }
            this._socket = null;
        }

        // Emit offline for all known peers
        for (const [nodeId, peer] of this._peers) {
            this.emit('peer-offline', this._peerData(peer));
        }
        this._peers.clear();
        this._seenMessages.clear();

        this.emit('stopped');
    }

    /**
     * Send a text message to the mesh. Returns the msgId or false on failure.
     */
    sendMessage(text, senderName) {
        if (!this._running || !this._socket || !this._nodeId) return false;

        const sanitized = typeof text === 'string' ? text.slice(0, this._config.MESSAGE_MAX_LENGTH) : '';
        if (!sanitized) return false;

        const msgId = `${this._nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const payload = JSON.stringify({
            protocol: this._config.PROTOCOL_VERSION,
            type: 'message',
            nodeId: this._nodeId,
            operatorName: senderName || 'OPERATOR',
            text: sanitized,
            msgId,
            timestamp: Date.now(),
        });

        // Mark own message as seen so we don't process our own broadcast
        this._seenMessages.set(msgId, Date.now());

        // Send with retries for reliability
        this._sendWithRetry(payload, this._config.MESSAGE_RETRY_COUNT);

        return msgId;
    }

    /**
     * Get all currently tracked peers as an array.
     */
    getPeers() {
        return Array.from(this._peers.values()).map(p => this._peerData(p));
    }

    /**
     * Get mesh status.
     */
    getStatus() {
        return {
            enabled: this._running,
            localNodeId: this._nodeId,
            nodeCount: this._peers.size,
            nodes: this.getPeers(),
        };
    }

    /**
     * The local node ID (null if not started).
     */
    get nodeId() {
        return this._nodeId;
    }

    /**
     * Whether the mesh is running.
     */
    get running() {
        return this._running;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Socket lifecycle
    // ═══════════════════════════════════════════════════════════════════

    _createSocket() {
        try {
            this._socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this._socket.on('error', (err) => {
                this.emit('error', err);
                this._attemptRecovery();
            });

            this._socket.on('message', (msg, rinfo) => {
                this._handleIncoming(msg, rinfo);
            });

            this._socket.on('listening', () => {
                this._socket.setBroadcast(true);
                this._running = true;
                this._recovering = false;
                this._recoveryAttempts = 0;
                this._startTimers();
                this._broadcastPresence();
                this.emit('started');
            });

            this._socket.bind(this._config.PORT);
        } catch (err) {
            this.emit('error', err);
            this._attemptRecovery();
        }
    }

    _attemptRecovery() {
        if (this._recovering) return;

        // Tear down current socket
        this._running = false;
        this._clearTimers();

        if (this._socket) {
            try { this._socket.close(); } catch (e) { /* ignore */ }
            this._socket = null;
        }

        this._recoveryAttempts++;
        if (this._recoveryAttempts > this._config.SOCKET_MAX_RECOVERY_ATTEMPTS) {
            this.emit('error', new Error(`Mesh socket recovery failed after ${this._config.SOCKET_MAX_RECOVERY_ATTEMPTS} attempts`));
            // Emit offline for all peers
            for (const [, peer] of this._peers) {
                this.emit('peer-offline', this._peerData(peer));
            }
            this._peers.clear();
            this.emit('stopped');
            return;
        }

        this._recovering = true;
        setTimeout(() => {
            if (!this._recovering) return; // stop() was called during recovery
            this._recovering = false;
            this._createSocket();
        }, this._config.SOCKET_RECOVERY_DELAY_MS);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Timers
    // ═══════════════════════════════════════════════════════════════════

    _startTimers() {
        // Heartbeat with jitter
        this._scheduleNextHeartbeat();

        // Peer cleanup
        this._cleanupTimer = setInterval(() => this._cleanupPeers(), this._config.CLEANUP_INTERVAL_MS);

        // Dedup cleanup
        this._dedupCleanupTimer = setInterval(() => this._cleanupDedup(), this._config.DEDUP_CLEANUP_INTERVAL_MS);
    }

    _clearTimers() {
        if (this._heartbeatTimer) {
            clearTimeout(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        if (this._dedupCleanupTimer) {
            clearInterval(this._dedupCleanupTimer);
            this._dedupCleanupTimer = null;
        }
    }

    _scheduleNextHeartbeat() {
        if (!this._running) return;
        const jitter = (Math.random() - 0.5) * 2 * this._config.HEARTBEAT_JITTER_MS;
        const delay = this._config.HEARTBEAT_INTERVAL_MS + jitter;
        this._heartbeatTimer = setTimeout(() => {
            this._broadcastPresence();
            this._scheduleNextHeartbeat();
        }, Math.max(delay, 1000)); // floor at 1s
    }

    // ═══════════════════════════════════════════════════════════════════
    // Broadcast presence
    // ═══════════════════════════════════════════════════════════════════

    _broadcastPresence() {
        if (!this._socket || !this._running) return;

        const appFields = this._buildPresence ? this._buildPresence() : {};

        const payload = JSON.stringify({
            protocol: this._config.PROTOCOL_VERSION,
            nodeId: this._nodeId,
            hostname: os.hostname(),
            ...appFields,
            timestamp: Date.now(),
        });

        const buffer = Buffer.from(payload);
        const addresses = this._getBroadcastAddresses();

        for (const addr of addresses) {
            try {
                this._socket.send(buffer, 0, buffer.length, this._config.PORT, addr);
            } catch (e) {
                // Transient send failure — not fatal
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Incoming message handler
    // ═══════════════════════════════════════════════════════════════════

    _handleIncoming(msg, rinfo) {
        let data;
        try {
            data = JSON.parse(msg.toString());
        } catch (e) {
            return; // malformed — ignore
        }

        if (data.protocol !== this._config.PROTOCOL_VERSION) return;
        if (data.nodeId === this._nodeId) return;

        // Mesh message
        if (data.type === 'message') {
            this._handleMessage(data);
            return;
        }

        // Presence heartbeat
        this._handlePresence(data, rinfo);
    }

    _handleMessage(data) {
        const text = typeof data.text === 'string' ? data.text.slice(0, this._config.MESSAGE_MAX_LENGTH) : '';
        if (!text) return;

        const msgId = data.msgId;
        if (!msgId) return;

        // Dedup
        if (this._seenMessages.has(msgId)) return;
        this._seenMessages.set(msgId, Date.now());

        this.emit('message', {
            nodeId: data.nodeId,
            operatorName: data.operatorName || 'UNKNOWN',
            text,
            msgId,
            timestamp: data.timestamp,
        });
    }

    _handlePresence(data, rinfo) {
        const nodeId = data.nodeId;
        const now = Date.now();

        const peerEntry = {
            nodeId,
            hostname: data.hostname,
            ip: rinfo.address,
            port: rinfo.port,
            level: data.level || 1,
            rank: data.rank || 'TRAINEE',
            operatorName: data.operatorName || 'UNKNOWN',
            lastSeen: now,
            signalStrength: this._calculateSignalStrength(rinfo.address),
            activity: data.activity || 'idle',
            hunger: typeof data.hunger === 'number' ? data.hunger : 100,
            energy: typeof data.energy === 'number' ? data.energy : 100,
            color: typeof data.color === 'string' ? data.color : null,
            state: 'ONLINE',
        };

        const existing = this._peers.get(nodeId);
        const isNew = !existing;

        // If peer was stale, it's back online — reset state
        if (existing && existing.state === 'STALE') {
            peerEntry.state = 'ONLINE';
        }

        this._peers.set(nodeId, peerEntry);

        if (isNew) {
            this.emit('peer-online', this._peerData(peerEntry));
        } else {
            this.emit('peer-update', this._peerData(peerEntry));
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Peer lifecycle
    // ═══════════════════════════════════════════════════════════════════

    _cleanupPeers() {
        const now = Date.now();
        const staleThreshold = this._config.HEARTBEAT_INTERVAL_MS * this._config.STALE_AFTER_MISSED;
        const offlineThreshold = this._config.HEARTBEAT_INTERVAL_MS * this._config.OFFLINE_AFTER_MISSED;

        for (const [nodeId, peer] of this._peers) {
            const elapsed = now - peer.lastSeen;

            if (elapsed > offlineThreshold) {
                // Gone — remove
                this._peers.delete(nodeId);
                peer.state = 'OFFLINE';
                this.emit('peer-offline', this._peerData(peer));
            } else if (elapsed > staleThreshold && peer.state !== 'STALE') {
                // Shaky — mark stale but keep tracking
                peer.state = 'STALE';
                this.emit('peer-stale', this._peerData(peer));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Dedup cleanup (TTL-based)
    // ═══════════════════════════════════════════════════════════════════

    _cleanupDedup() {
        const cutoff = Date.now() - this._config.DEDUP_TTL_MS;
        for (const [msgId, ts] of this._seenMessages) {
            if (ts < cutoff) {
                this._seenMessages.delete(msgId);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Send with retry
    // ═══════════════════════════════════════════════════════════════════

    _sendWithRetry(payload, retriesLeft) {
        this._sendRaw(payload);

        if (retriesLeft > 0 && this._running) {
            setTimeout(() => {
                if (this._running && this._socket) {
                    this._sendWithRetry(payload, retriesLeft - 1);
                }
            }, this._config.MESSAGE_RETRY_DELAY_MS);
        }
    }

    _sendRaw(payload) {
        if (!this._socket || !this._running) return;

        const buffer = Buffer.from(payload);
        const addresses = this._getBroadcastAddresses();

        for (const addr of addresses) {
            try {
                this._socket.send(buffer, 0, buffer.length, this._config.PORT, addr);
            } catch (e) {
                // Transient — not fatal
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Network helpers
    // ═══════════════════════════════════════════════════════════════════

    _getBroadcastAddresses() {
        const interfaces = os.networkInterfaces();
        const addresses = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push(this._calcBroadcast(iface.address, iface.netmask));
                }
            }
        }
        return addresses;
    }

    _calcBroadcast(ip, netmask) {
        const ipParts = ip.split('.').map(Number);
        const maskParts = netmask.split('.').map(Number);
        return ipParts.map((octet, i) => octet | (~maskParts[i] & 255)).join('.');
    }

    _calculateSignalStrength(remoteIp) {
        const interfaces = os.networkInterfaces();
        let best = 'WEAK';

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family !== 'IPv4' || iface.internal) continue;

                // Use actual subnet mask to determine if peer is on the same subnet
                const localIp = iface.address.split('.').map(Number);
                const mask = iface.netmask.split('.').map(Number);
                const remoteOctets = remoteIp.split('.').map(Number);

                const localSubnet = localIp.map((o, i) => o & mask[i]);
                const remoteSubnet = remoteOctets.map((o, i) => o & mask[i]);

                const sameSubnet = localSubnet.every((o, i) => o === remoteSubnet[i]);

                if (sameSubnet) {
                    // Same subnet = STRONG — this is the correct check using actual netmask
                    return 'STRONG';
                }

                // Same /16 = MODERATE
                if (localIp[0] === remoteOctets[0] && localIp[1] === remoteOctets[1]) {
                    best = 'MODERATE';
                }
            }
        }

        return best;
    }

    _generateNodeId() {
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `RG-${randomPart}`;
    }

    _peerData(peer) {
        return {
            nodeId: peer.nodeId,
            hostname: peer.hostname,
            ip: peer.ip,
            port: peer.port,
            level: peer.level,
            rank: peer.rank,
            operatorName: peer.operatorName,
            lastSeen: peer.lastSeen,
            signalStrength: peer.signalStrength,
            activity: peer.activity,
            hunger: peer.hunger,
            energy: peer.energy,
            color: peer.color,
            state: peer.state,
        };
    }
}

module.exports = RadMesh;

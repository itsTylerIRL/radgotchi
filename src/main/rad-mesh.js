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

        // Cached broadcast addresses — refreshed periodically by _getBroadcastAddresses
        this._interfaceCache = null;
        this._interfaceCacheAt = 0;
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
        // Already running, or recovery is pending — don't double-bind.
        if (this._running || this._recovering) return;
        this._nodeId = this._generateNodeId();
        this._recoveryAttempts = 0;
        // Reset interface cache so a fresh start re-detects current NICs
        this._interfaceCache = null;
        this._interfaceCacheAt = 0;
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

        // Validate sender ID — same hardening as _handlePresence so a malformed
        // message can't poison downstream state with undefined fields.
        if (typeof data.nodeId !== 'string' || !data.nodeId || data.nodeId.length > 64) return;

        const msgId = data.msgId;
        if (typeof msgId !== 'string' || !msgId || msgId.length > 128) return;

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
        // Validate node ID — a malformed packet with no nodeId would otherwise
        // poison the peers Map with an `undefined` key.
        if (typeof nodeId !== 'string' || !nodeId || nodeId.length > 64) return;

        const now = Date.now();
        const existing = this._peers.get(nodeId);

        const peerEntry = {
            nodeId,
            hostname: typeof data.hostname === 'string' ? data.hostname.slice(0, 64) : (existing?.hostname || ''),
            ip: rinfo.address,
            port: rinfo.port,
            level: Number(data.level) || (existing?.level || 1),
            rank: typeof data.rank === 'string' ? data.rank.slice(0, 32) : (existing?.rank || 'TRAINEE'),
            operatorName: typeof data.operatorName === 'string' ? data.operatorName.slice(0, 32) : (existing?.operatorName || 'UNKNOWN'),
            lastSeen: now,
            signalStrength: this._calculateSignalStrength(rinfo.address),
            activity: typeof data.activity === 'string' ? data.activity : (existing?.activity || 'idle'),
            hunger: typeof data.hunger === 'number' ? data.hunger : (existing?.hunger ?? 100),
            energy: typeof data.energy === 'number' ? data.energy : (existing?.energy ?? 100),
            color: typeof data.color === 'string' ? data.color : (existing?.color || null),
            state: 'ONLINE',
            // Internal: when we last emitted a peer-update for this peer (throttle).
            _lastEmit: existing?._lastEmit || 0,
        };

        this._peers.set(nodeId, peerEntry);

        if (!existing) {
            peerEntry._lastEmit = now;
            this.emit('peer-online', this._peerData(peerEntry));
            return;
        }

        // Detect meaningful changes that should always emit immediately so the
        // UI reflects them without waiting for the throttle window.
        const stateChanged = existing.state !== 'ONLINE'; // STALE → ONLINE recovery
        const dataChanged = existing.level !== peerEntry.level
                         || existing.rank !== peerEntry.rank
                         || existing.activity !== peerEntry.activity
                         || existing.operatorName !== peerEntry.operatorName
                         || existing.color !== peerEntry.color;

        const sinceLast = now - (existing._lastEmit || 0);
        if (stateChanged || dataChanged || sinceLast >= this._config.PEER_UPDATE_MIN_INTERVAL_MS) {
            peerEntry._lastEmit = now;
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
        // Cache results for 30s — NICs rarely change, walking them on every
        // heartbeat (and again per message retry) is wasteful and contributed
        // to noticeable jitter on machines with many adapters.
        const now = Date.now();
        if (this._interfaceCache && (now - this._interfaceCacheAt) < 30000) {
            return this._interfaceCache;
        }

        const interfaces = os.networkInterfaces();
        const addresses = [];
        const skip = this._config.SKIP_INTERFACE_PATTERNS;

        for (const name of Object.keys(interfaces)) {
            const lname = name.toLowerCase();
            // Skip virtual / VPN / container interfaces that flood links
            if (skip.some(pat => lname.includes(pat))) continue;

            for (const iface of interfaces[name]) {
                if (iface.family !== 'IPv4' || iface.internal) continue;
                // Skip APIPA / link-local 169.254/16 (no real LAN there)
                if (iface.address.startsWith('169.254.')) continue;
                // Skip /32 (point-to-point, no broadcast domain)
                if (iface.netmask === '255.255.255.255') continue;
                addresses.push(this._calcBroadcast(iface.address, iface.netmask));
            }
        }

        // Always include 255.255.255.255 as a fallback so single-NIC hosts
        // without a calculable subnet still reach peers.
        if (addresses.length === 0) addresses.push('255.255.255.255');

        // Deduplicate
        this._interfaceCache = Array.from(new Set(addresses));
        this._interfaceCacheAt = now;
        return this._interfaceCache;
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
        // Use cryptographic randomness — 6 chars of Math.random() base36 only
        // gives ~36^6 = 2.2B IDs but with poor entropy; collisions on a small
        // mesh were possible. crypto.randomBytes is collision-free for our scale.
        const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
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
            // Note: _lastEmit is intentionally NOT exposed to consumers.
        };
    }
}

module.exports = RadMesh;

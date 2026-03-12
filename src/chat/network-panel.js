// Network discovery panel (RAD MESH) — asset list, mesh chat, activity broadcasting

import SoundSystem from '../renderer/sounds.js';
import { networkTranslations, getCurrentLang } from './translations.js';
import { addMessage } from './messages.js';

const networkBar = document.getElementById('network-bar');
const networkHeader = document.getElementById('network-header');
const networkToggleBtn = document.getElementById('network-toggle-btn');
const networkExpandBtn = document.getElementById('network-expand-btn');
const networkNodes = document.getElementById('network-nodes');
const networkNodeCount = document.getElementById('network-node-count');
const networkTitleText = document.getElementById('network-title-text');
const meshChat = document.getElementById('mesh-chat');
const meshMessages = document.getElementById('mesh-messages');
const meshInput = document.getElementById('mesh-input');
const meshSendBtn = document.getElementById('mesh-send-btn');

let networkEnabled = false;
const discoveredNodesMap = new Map();
const MESH_MSG_MAX = 50;
let meshMessageHistory = [];

const ACTIVITY_ICONS = {
    idle: '💤',
    vibing: '🎵',
    sleeping: '😴',
    grinding: '🍅',
    break: '☕',
};

const ACTIVITY_CLASSES = {
    idle: '',
    vibing: 'activity-vibing',
    sleeping: 'activity-sleeping',
    grinding: 'activity-grinding',
    break: 'activity-break',
};

export function updateNetworkTranslations() {
    const t = networkTranslations[getCurrentLang()];
    networkTitleText.textContent = t.title;
    if (discoveredNodesMap.size === 0) {
        const emptyEl = networkNodes.querySelector('.network-empty');
        if (emptyEl) emptyEl.textContent = networkEnabled ? t.noAssets : t.scanning;
    }
}

function renderNetworkNodes() {
    const t = networkTranslations[getCurrentLang()];
    const count = discoveredNodesMap.size;
    networkNodeCount.textContent = `${count} ${t.assets}`;
    networkNodes.innerHTML = '';

    if (count === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'network-empty';
        emptyDiv.textContent = networkEnabled ? t.noAssets : t.scanning;
        networkNodes.appendChild(emptyDiv);
        return;
    }

    Array.from(discoveredNodesMap.values())
        .sort((a, b) => b.level - a.level)
        .forEach(node => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'network-node';
            nodeEl.dataset.nodeId = node.nodeId;
            const signalClass = node.signalStrength ? node.signalStrength.toLowerCase() : 'weak';
            const actClass = ACTIVITY_CLASSES[node.activity] || '';
            const actIcon = ACTIVITY_ICONS[node.activity] || '';
            const hunger = typeof node.hunger === 'number' ? Math.round(node.hunger) : 100;
            const energy = typeof node.energy === 'number' ? Math.round(node.energy) : 100;
            const nodeColor = node.color || 'var(--term-green)';

            nodeEl.innerHTML = `
                <div class="node-signal ${signalClass}" title="Signal: ${node.signalStrength || 'UNKNOWN'}"></div>
                <div class="node-info">
                    <div class="node-top-row">
                        <span class="node-id" style="color: ${nodeColor}">${node.nodeId}</span>
                        <span class="node-operator">${node.operatorName || 'UNKNOWN'}</span>
                        <span class="node-rank">${node.rank || 'TRAINEE'}</span>
                        <span class="node-level">LV${node.level || 1}</span>
                        <span class="node-activity ${actClass}" title="${node.activity || 'idle'}">${actIcon}</span>
                    </div>
                    <div class="node-bars">
                        <div class="node-bar-track"><div class="node-bar-fill hunger" style="width:${hunger}%"></div></div>
                        <div class="node-bar-track"><div class="node-bar-fill energy" style="width:${energy}%"></div></div>
                    </div>
                </div>
            `;
            if (nodeColor && nodeColor !== 'var(--term-green)') {
                nodeEl.style.borderColor = nodeColor + '33';
            }
            if (actClass) nodeEl.classList.add(actClass);
            networkNodes.appendChild(nodeEl);
        });
}

export function addNetworkNode(node) {
    discoveredNodesMap.set(node.nodeId, node);
    renderNetworkNodes();
    const t = networkTranslations[getCurrentLang()];
    addMessage('system', `📡 ${t.nodeOnline}: ${node.nodeId} [${node.operatorName}]`);
    SoundSystem.play('hover');
}

export function updateNetworkNode(node) {
    discoveredNodesMap.set(node.nodeId, node);
    renderNetworkNodes();
}

export function removeNetworkNode(node) {
    if (!discoveredNodesMap.has(node.nodeId)) return;
    const nodeEl = networkNodes.querySelector(`[data-node-id="${node.nodeId}"]`);
    if (nodeEl) {
        nodeEl.classList.add('fading');
        setTimeout(() => { discoveredNodesMap.delete(node.nodeId); renderNetworkNodes(); }, 500);
    } else {
        discoveredNodesMap.delete(node.nodeId);
        renderNetworkNodes();
    }
    const t = networkTranslations[getCurrentLang()];
    addMessage('system', `📡 ${t.nodeOffline}: ${node.nodeId}`);
}

// === Mesh Chat ===

function addMeshMessage(nodeId, operatorName, text, timestamp = null) {
    const msgEl = document.createElement('div');
    msgEl.className = 'mesh-msg';
    const ts = timestamp ? new Date(timestamp) : new Date();
    const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const safeOp = (operatorName || 'UNKNOWN').replace(/</g, '&lt;');
    const safeText = (text || '').replace(/</g, '&lt;');
    msgEl.innerHTML = `<span class="mesh-msg-time">${time}</span><span class="mesh-msg-sender">${safeOp}</span><span class="mesh-msg-text">${safeText}</span>`;
    meshMessages.appendChild(msgEl);

    // Trim old messages
    while (meshMessages.children.length > MESH_MSG_MAX) meshMessages.removeChild(meshMessages.firstChild);
    meshMessages.scrollTop = meshMessages.scrollHeight;

    // Pulse the header when a message arrives
    networkBar.classList.add('mesh-pulse');
    setTimeout(() => networkBar.classList.remove('mesh-pulse'), 600);
}

function persistMeshMessage(nodeId, operatorName, text) {
    meshMessageHistory.push({ nodeId, operatorName, text, timestamp: Date.now() });
    if (meshMessageHistory.length > MESH_MSG_MAX) meshMessageHistory = meshMessageHistory.slice(-MESH_MSG_MAX);
    if (window.electronAPI && window.electronAPI.saveMeshMessages) {
        window.electronAPI.saveMeshMessages(meshMessageHistory);
    }
}

export function handleMeshMessage(data) {
    if (!data || !data.text) return;
    addMeshMessage(data.nodeId, data.operatorName, data.text);
    persistMeshMessage(data.nodeId, data.operatorName, data.text);
    SoundSystem.play('hover');
}

function sendMeshMsg() {
    const text = meshInput.value.trim();
    if (!text) return;
    if (window.electronAPI && window.electronAPI.sendMeshMessage) {
        window.electronAPI.sendMeshMessage(text);
        addMeshMessage('local', 'YOU', text);
        persistMeshMessage('local', 'YOU', text);
        meshInput.value = '';
        SoundSystem.play('click');
    }
}

meshSendBtn.addEventListener('click', sendMeshMsg);
meshInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendMeshMsg(); }
    e.stopPropagation(); // prevent chat input from stealing keystrokes
});

// Toggle network discovery
networkToggleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    networkEnabled = !networkEnabled;
    networkToggleBtn.classList.toggle('active', networkEnabled);
    if (window.electronAPI && window.electronAPI.networkDiscoveryToggle) {
        await window.electronAPI.networkDiscoveryToggle(networkEnabled);
        if (networkEnabled) {
            networkBar.classList.add('visible');
            networkBar.classList.remove('collapsed');
            SoundSystem.play('click');
        } else {
            discoveredNodesMap.clear();
            renderNetworkNodes();
            meshMessages.innerHTML = '';
            meshMessageHistory = [];
        }
    }
});

// Collapse/expand
networkHeader.addEventListener('click', () => { networkBar.classList.toggle('collapsed'); SoundSystem.play('hover'); });
networkExpandBtn.addEventListener('click', (e) => { e.stopPropagation(); networkBar.classList.toggle('collapsed'); });

// Default: visible but collapsed
networkBar.classList.add('visible');
networkBar.classList.add('collapsed');

// Load persisted mesh messages
export async function loadMeshHistory() {
    if (window.electronAPI && window.electronAPI.getMeshMessages) {
        try {
            const saved = await window.electronAPI.getMeshMessages();
            if (Array.isArray(saved) && saved.length > 0) {
                meshMessageHistory = saved;
                saved.forEach(msg => addMeshMessage(msg.nodeId, msg.operatorName, msg.text, msg.timestamp));
            }
        } catch (e) { console.error('Failed to load mesh history:', e); }
    }
}

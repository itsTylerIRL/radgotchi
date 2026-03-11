// Network discovery panel (RAD MESH)

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

let networkEnabled = false;
const discoveredNodesMap = new Map();

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
            nodeEl.innerHTML = `
                <div class="node-signal ${signalClass}" title="Signal: ${node.signalStrength || 'UNKNOWN'}"></div>
                <span class="node-id">${node.nodeId}</span>
                <span class="node-operator">${node.operatorName || 'UNKNOWN'}</span>
                <span class="node-rank">${node.rank || 'TRAINEE'}</span>
                <span class="node-level">LV${node.level || 1}</span>
            `;
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
        }
    }
});

// Collapse/expand
networkHeader.addEventListener('click', () => { networkBar.classList.toggle('collapsed'); SoundSystem.play('hover'); });
networkExpandBtn.addEventListener('click', (e) => { e.stopPropagation(); networkBar.classList.toggle('collapsed'); });

// Default: visible but collapsed
networkBar.classList.add('visible');
networkBar.classList.add('collapsed');

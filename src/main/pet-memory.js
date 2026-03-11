'use strict';

// Pet Memory — extracts and persists facts about the operator across sessions

const MAX_FACTS = 50;
const MIN_MESSAGE_LENGTH = 20;
const EXTRACT_EVERY_N_TURNS = 3;

let _persistence = null;
let _llm = null;
let turnsSinceExtract = 0;

let memoryData = {
    facts: [],
    enabled: true,
};

function init({ persistence, llm }) {
    _persistence = persistence;
    _llm = llm;
}

function loadMemory() {
    const saved = _persistence.loadPetMemoryFromDisk();
    if (saved) {
        memoryData = { ...memoryData, ...saved };
    }
}

function saveMemory() {
    _persistence.savePetMemoryToDisk(memoryData);
}

function getFacts() {
    return memoryData.facts;
}

function isEnabled() {
    return memoryData.enabled;
}

function setEnabled(enabled) {
    memoryData.enabled = enabled;
    saveMemory();
}

function clearMemory() {
    memoryData.facts = [];
    turnsSinceExtract = 0;
    saveMemory();
}

function buildMemoryBlock() {
    if (!memoryData.enabled || memoryData.facts.length === 0) return '';
    const factLines = memoryData.facts.map(f => '- ' + f.fact).join('\n');
    return `LONG-TERM MEMORY (things you remember about the operator):\n${factLines}\n\nReference these naturally when relevant. Don't force them into every response.`;
}

// Call after the LLM responds to attempt memory extraction
function afterResponse(userMessage, assistantMessage) {
    if (!memoryData.enabled) return;
    if (!userMessage || userMessage.length < MIN_MESSAGE_LENGTH) return;

    turnsSinceExtract++;
    if (turnsSinceExtract < EXTRACT_EVERY_N_TURNS) return;
    turnsSinceExtract = 0;

    // Fire and forget — don't block the chat flow
    extractFacts(userMessage, assistantMessage).catch(() => {});
}

async function extractFacts(userMessage, assistantMessage) {
    const config = _llm.getLlmConfig();
    if (!config.enabled || !config.apiUrl) return;

    const existingFacts = memoryData.facts.map(f => f.fact).join('; ');

    const extractPrompt = `Extract key facts worth remembering about the user from this exchange. Only include personal details, preferences, project names, goals, or important context. Return a JSON array of strings. Return [] if nothing notable or new.

${existingFacts ? 'Already known: ' + existingFacts + '\nDo NOT repeat known facts.' : ''}

User: ${userMessage.substring(0, 500)}
Assistant: ${assistantMessage.substring(0, 300)}

Respond ONLY with a JSON array of short fact strings, e.g. ["works on a game called Stardust","prefers dark themes"]. No other text.`;

    try {
        const https = require('https');
        const http = require('http');
        const url = new URL(config.apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const requestBody = JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: extractPrompt }],
            max_tokens: 150,
            temperature: 0.3,
        });

        const response = await new Promise((resolve, reject) => {
            const req = protocol.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
                },
                timeout: 15000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Invalid JSON response')); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(requestBody);
            req.end();
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) return;

        // Parse the JSON array from the response, handling markdown fences
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        const newFacts = JSON.parse(cleaned);
        if (!Array.isArray(newFacts) || newFacts.length === 0) return;

        const now = Date.now();
        for (const fact of newFacts) {
            if (typeof fact !== 'string' || fact.length < 3 || fact.length > 200) continue;
            // Skip if substantially similar to existing fact
            const isDuplicate = memoryData.facts.some(f =>
                f.fact.toLowerCase().includes(fact.toLowerCase()) ||
                fact.toLowerCase().includes(f.fact.toLowerCase())
            );
            if (!isDuplicate) {
                memoryData.facts.push({ fact, timestamp: now });
            }
        }

        // Prune oldest if over limit
        if (memoryData.facts.length > MAX_FACTS) {
            memoryData.facts = memoryData.facts.slice(-MAX_FACTS);
        }

        saveMemory();
    } catch (e) {
        // Silent fail — memory extraction is best-effort
    }
}

module.exports = {
    init,
    loadMemory,
    saveMemory,
    getFacts,
    isEnabled,
    setEnabled,
    clearMemory,
    buildMemoryBlock,
    afterResponse,
};

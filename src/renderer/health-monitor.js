// Health monitor — assessHealth(), handleSystemEvent()

import { setMood } from './mood-engine.js';
import { getSystemEventStatus, pick } from './status-text.js';

let systemHealth = 'good';

export function assessHealth(data) {
    if (!data) return;
    const cpu = data.cpu?.usage_total || 0;
    const mem = data.memory?.percent || 0;
    const temps = data.temperatures || [];
    const maxTemp = temps.length > 0 ? Math.max(...temps.map(t => t.current || 0)) : 0;

    let newHealth = 'good';
    if (cpu > 90 || mem > 92 || maxTemp > 85) newHealth = 'crit';
    else if (cpu > 75 || mem > 80) newHealth = 'warn';

    if (newHealth !== systemHealth) {
        const oldHealth = systemHealth;
        systemHealth = newHealth;
        if (newHealth === 'crit') {
            setMood('intense', { duration: 4000, anim: 'rg-shake', status: 'THREAT LVL CRITICAL' });
        } else if (newHealth === 'warn' && oldHealth === 'good') {
            setMood('intense', { duration: 2500, anim: 'rg-pulse', status: 'ESCALATION DETECTED' });
        } else if (newHealth === 'good' && (oldHealth === 'crit' || oldHealth === 'warn')) {
            setMood('happy', { duration: 2000, anim: 'rg-bounce', status: 'THREAT NEUTRALIZED' });
        }
    }
}

export function handleSystemEvent(event) {
    if (!event || !event.type) return;
    const type = event.type;
    const value = event.value;
    const ses = getSystemEventStatus();
    const statusPool = ses[type] || [];
    const status = statusPool.length > 0 ? pick(statusPool) : type.toUpperCase();

    switch (type) {
        case 'cpu-spike':
            setMood('intense', { duration: 3000, anim: 'rg-shake', status: `${status} ${value}%` });
            break;
        case 'cpu-high':
            setMood('smart', { duration: 2500, anim: 'rg-pulse', status: `${status} ${value}%` });
            break;
        case 'cpu-normal':
            setMood('cool', { duration: 2000, anim: 'rg-wiggle', status });
            break;
        case 'memory-high':
            setMood('intense', { duration: 2500, anim: 'rg-shake', status: `${status} ${value}%` });
            break;
        case 'memory-normal':
            setMood('happy', { duration: 2000, anim: 'rg-bounce', status });
            break;
        case 'network-connected':
            setMood('excited', { duration: 3000, anim: 'rg-bounce', status });
            break;
        case 'network-disconnected':
            setMood('lonely', { duration: 4000, anim: 'rg-sad-wobble', status });
            break;
        case 'window-opened':
            if (Math.random() > 0.5) setMood('look_r', { duration: 1500, anim: 'rg-peek-r', status });
            break;
        case 'window-closed':
            if (Math.random() > 0.6) setMood(pick(['look_l','bored','awake']), { duration: 1500, status });
            break;
        case 'app-not-responding':
            setMood('debug', { duration: 4000, anim: 'rg-glitch',
                status: `${status}: ${event.app || 'UNKNOWN'}`.slice(0, 20) });
            break;
    }
}

export function getSystemHealth() { return systemHealth; }

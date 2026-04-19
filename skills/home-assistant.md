---
name: home_assistant
description: Control and query Home Assistant — get entity states, call services (lights, switches, climate, etc.), or list devices. Set HASS_URL and HASS_TOKEN environment variables.
icon: 🏠
parameters:
  action:
    type: string
    description: "One of: states, state, call_service, services, history"
    required: true
  entity_id:
    type: string
    description: "Entity ID, e.g. 'light.living_room', 'switch.office_fan'. Required for state, call_service, history."
    required: false
  domain:
    type: string
    description: "Service domain, e.g. 'light', 'switch', 'climate', 'script'. Required for call_service."
    required: false
  service:
    type: string
    description: "Service name, e.g. 'turn_on', 'turn_off', 'toggle', 'set_temperature'. Required for call_service."
    required: false
  service_data:
    type: string
    description: "JSON string of extra service data, e.g. '{\"brightness\": 128}' or '{\"temperature\": 22}'."
    required: false
  filter:
    type: string
    description: "For 'states' action: filter entities by domain prefix, e.g. 'light', 'sensor', 'switch'."
    required: false
---

# Home Assistant

Interact with a Home Assistant instance via its REST API.

**Setup:** Set environment variables `HASS_URL` (e.g. `http://homeassistant.local:8123`) and `HASS_TOKEN` (a Long-Lived Access Token from your HA profile).

Actions:
- **states** — List all entities (optionally filtered by domain with `filter`)
- **state** — Get the current state of a single entity (requires `entity_id`)
- **call_service** — Call a service like turn_on/turn_off (requires `domain`, `service`, `entity_id`)
- **services** — List available service domains
- **history** — Get recent state history for an entity (requires `entity_id`)

```js
const http = require('http');
const https = require('https');

const HASS_URL = process.env.HASS_URL || '';
const HASS_TOKEN = process.env.HASS_TOKEN || '';

if (!HASS_URL) {
    return { error: 'HASS_URL environment variable not set. Set it to your Home Assistant URL (e.g. http://homeassistant.local:8123).' };
}
if (!HASS_TOKEN) {
    return { error: 'HASS_TOKEN environment variable not set. Create a Long-Lived Access Token in your HA profile.' };
}

const action = (args.action || '').toLowerCase();
const baseUrl = HASS_URL.replace(/\/+$/, '');

function hassRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const proto = url.protocol === 'https:' ? https : http;
        const opts = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + HASS_TOKEN,
            },
            timeout: 15000,
        };
        const req = proto.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', e => reject(e));
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

if (action === 'states') {
    const res = await hassRequest('GET', '/api/states');
    if (res.status !== 200) return { error: 'HA returned status ' + res.status };
    let entities = Array.isArray(res.data) ? res.data : [];
    const filter = (args.filter || '').toLowerCase();
    if (filter) {
        entities = entities.filter(e => e.entity_id.startsWith(filter + '.') || e.entity_id.includes(filter));
    }
    if (entities.length === 0) return { result: 'No entities found' + (filter ? ' matching "' + filter + '"' : '') + '.' };
    // Group by domain
    const grouped = {};
    for (const e of entities) {
        const domain = e.entity_id.split('.')[0];
        if (!grouped[domain]) grouped[domain] = [];
        grouped[domain].push(e);
    }
    const lines = [];
    for (const [domain, ents] of Object.entries(grouped).sort()) {
        lines.push(`\n[${domain}] (${ents.length})`);
        for (const e of ents.slice(0, 15)) {
            const name = e.attributes?.friendly_name || e.entity_id;
            lines.push(`  • ${name}: ${e.state}${e.attributes?.unit_of_measurement ? ' ' + e.attributes.unit_of_measurement : ''}`);
        }
        if (ents.length > 15) lines.push(`  ... and ${ents.length - 15} more`);
    }
    return { result: lines.join('\n') };
}

if (action === 'state') {
    if (!args.entity_id) return { error: 'entity_id is required for state action.' };
    const res = await hassRequest('GET', '/api/states/' + encodeURIComponent(args.entity_id));
    if (res.status === 404) return { error: 'Entity not found: ' + args.entity_id };
    if (res.status !== 200) return { error: 'HA returned status ' + res.status };
    const e = res.data;
    const attrs = e.attributes || {};
    const name = attrs.friendly_name || e.entity_id;
    let info = `${name}: ${e.state}`;
    if (attrs.unit_of_measurement) info += ' ' + attrs.unit_of_measurement;
    // Add useful attributes
    const extras = [];
    if (attrs.brightness !== undefined) extras.push('brightness: ' + Math.round(attrs.brightness / 2.55) + '%');
    if (attrs.color_temp !== undefined) extras.push('color_temp: ' + attrs.color_temp);
    if (attrs.temperature !== undefined) extras.push('temperature: ' + attrs.temperature);
    if (attrs.current_temperature !== undefined) extras.push('current_temp: ' + attrs.current_temperature);
    if (attrs.humidity !== undefined) extras.push('humidity: ' + attrs.humidity + '%');
    if (attrs.battery_level !== undefined) extras.push('battery: ' + attrs.battery_level + '%');
    if (attrs.device_class) extras.push('class: ' + attrs.device_class);
    if (extras.length > 0) info += '\n  ' + extras.join(', ');
    info += '\n  Last changed: ' + (e.last_changed || 'unknown');
    return { result: info };
}

if (action === 'call_service') {
    if (!args.domain) return { error: 'domain is required (e.g. light, switch, climate).' };
    if (!args.service) return { error: 'service is required (e.g. turn_on, turn_off, toggle).' };
    const serviceData = {};
    if (args.entity_id) serviceData.entity_id = args.entity_id;
    if (args.service_data) {
        try {
            Object.assign(serviceData, JSON.parse(args.service_data));
        } catch {
            return { error: 'Invalid service_data JSON: ' + args.service_data };
        }
    }
    const path = '/api/services/' + encodeURIComponent(args.domain) + '/' + encodeURIComponent(args.service);
    const res = await hassRequest('POST', path, serviceData);
    if (res.status >= 400) return { error: 'Service call failed: status ' + res.status + ' — ' + JSON.stringify(res.data).substring(0, 300) };
    const affected = Array.isArray(res.data) ? res.data.length : 0;
    return { result: `Service ${args.domain}.${args.service} called successfully. ${affected} entity(ies) affected.` };
}

if (action === 'services') {
    const res = await hassRequest('GET', '/api/services');
    if (res.status !== 200) return { error: 'HA returned status ' + res.status };
    const domains = Array.isArray(res.data) ? res.data : [];
    const lines = domains.map(d => {
        const services = Object.keys(d.services || {}).slice(0, 8).join(', ');
        const more = Object.keys(d.services || {}).length > 8 ? '...' : '';
        return `• ${d.domain}: ${services}${more}`;
    });
    return { result: lines.join('\n') };
}

if (action === 'history') {
    if (!args.entity_id) return { error: 'entity_id is required for history action.' };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const path = '/api/history/period/' + since + '?filter_entity_id=' + encodeURIComponent(args.entity_id) + '&minimal_response&no_attributes';
    const res = await hassRequest('GET', path);
    if (res.status !== 200) return { error: 'History fetch failed: status ' + res.status };
    const entries = Array.isArray(res.data) && Array.isArray(res.data[0]) ? res.data[0] : [];
    if (entries.length === 0) return { result: 'No history found for ' + args.entity_id + ' in the last 24h.' };
    const lines = entries.slice(-20).map(e => {
        const time = new Date(e.last_changed).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `  ${time}: ${e.state}`;
    });
    return { result: `${args.entity_id} — last 24h (${entries.length} changes):\n${lines.join('\n')}` };
}

return { error: 'Unknown action: ' + action + '. Valid actions: states, state, call_service, services, history' };
```

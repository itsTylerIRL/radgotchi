---
name: grafana_query
description: Query a Grafana instance — list dashboards, get alerts, or query a datasource. Set GRAFANA_URL and GRAFANA_API_KEY environment variables.
icon: 📊
parameters:
  action:
    type: string
    description: "One of: dashboards, alerts, query, health"
    required: true
  query:
    type: string
    description: "For 'query' action: a PromQL/InfluxQL expression. For 'dashboards': optional search term."
    required: false
  datasource_uid:
    type: string
    description: "UID of the datasource to query (required for 'query' action)"
    required: false
  from:
    type: string
    description: "Start time for queries, e.g. 'now-1h', 'now-24h' (default: now-1h)"
    required: false
  to:
    type: string
    description: "End time for queries, e.g. 'now' (default: now)"
    required: false
---

# Grafana Query

Interact with a Grafana instance via its HTTP API.

**Setup:** Set environment variables `GRAFANA_URL` (e.g. `http://grafana.local:3000`) and `GRAFANA_API_KEY` (a Service Account token or API key).

Actions:
- **health** — Check if Grafana is reachable
- **dashboards** — List dashboards (optionally filtered by `query`)
- **alerts** — Get current firing/pending alerts
- **query** — Run a datasource query (requires `datasource_uid` and `query`)

```js
const http = require('http');
const https = require('https');

const GRAFANA_URL = process.env.GRAFANA_URL || '';
const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY || '';

if (!GRAFANA_URL) {
    return { error: 'GRAFANA_URL environment variable not set. Set it to your Grafana base URL (e.g. http://grafana.local:3000).' };
}

const action = (args.action || '').toLowerCase();
const baseUrl = GRAFANA_URL.replace(/\/+$/, '');

function grafanaRequest(method, path, body) {
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
                'Accept': 'application/json',
            },
            timeout: 15000,
        };
        if (GRAFANA_API_KEY) {
            opts.headers['Authorization'] = 'Bearer ' + GRAFANA_API_KEY;
        }
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

if (action === 'health') {
    const res = await grafanaRequest('GET', '/api/health');
    return { result: JSON.stringify(res.data) };
}

if (action === 'dashboards') {
    const search = args.query ? '?query=' + encodeURIComponent(args.query) : '';
    const res = await grafanaRequest('GET', '/api/search' + search + (search ? '&' : '?') + 'type=dash-db&limit=25');
    if (res.status !== 200) return { error: 'Grafana returned status ' + res.status };
    const list = Array.isArray(res.data) ? res.data : [];
    if (list.length === 0) return { result: 'No dashboards found.' };
    const lines = list.map(d => `• ${d.title} (uid: ${d.uid}, url: ${d.url})`);
    return { result: lines.join('\n') };
}

if (action === 'alerts') {
    const res = await grafanaRequest('GET', '/api/prometheus/grafana/api/v1/alerts');
    if (res.status !== 200) {
        // Fallback to legacy alerts API
        const legacy = await grafanaRequest('GET', '/api/alerts?state=alerting&state=pending');
        if (legacy.status !== 200) return { error: 'Failed to fetch alerts: status ' + legacy.status };
        const alerts = Array.isArray(legacy.data) ? legacy.data : [];
        if (alerts.length === 0) return { result: 'No active alerts.' };
        const lines = alerts.map(a => `⚠️ ${a.name} — state: ${a.state}, since: ${a.newStateDate || 'unknown'}`);
        return { result: lines.join('\n') };
    }
    const alerts = res.data?.data?.alerts || [];
    if (alerts.length === 0) return { result: 'No active alerts — all clear.' };
    const lines = alerts.map(a => `⚠️ [${a.state}] ${a.labels?.alertname || 'unnamed'}: ${(a.annotations?.summary || a.annotations?.description || '').substring(0, 120)}`);
    return { result: lines.join('\n') };
}

if (action === 'query') {
    if (!args.datasource_uid) return { error: 'datasource_uid is required for query action. Use action=dashboards to find available datasources.' };
    if (!args.query) return { error: 'query parameter is required (e.g. a PromQL expression).' };
    const from = args.from || 'now-1h';
    const to = args.to || 'now';
    const body = {
        queries: [{
            refId: 'A',
            datasource: { uid: args.datasource_uid },
            expr: args.query,
            rawSql: args.query,
            queryType: '',
            intervalMs: 60000,
            maxDataPoints: 30,
        }],
        from,
        to,
    };
    const res = await grafanaRequest('POST', '/api/ds/query', body);
    if (res.status !== 200) return { error: 'Query failed: ' + JSON.stringify(res.data).substring(0, 500) };
    const frames = res.data?.results?.A?.frames || [];
    if (frames.length === 0) return { result: 'Query returned no data.' };
    // Summarise the first frame
    const frame = frames[0];
    const fields = frame.schema?.fields || [];
    const values = frame.data?.values || [];
    const fieldNames = fields.map(f => f.name || f.type).join(', ');
    const rowCount = values[0]?.length || 0;
    let summary = `Fields: ${fieldNames}\nRows: ${rowCount}`;
    // Show last few values
    if (rowCount > 0 && values.length >= 2) {
        const lastN = Math.min(5, rowCount);
        const samples = [];
        for (let i = rowCount - lastN; i < rowCount; i++) {
            const row = values.map(col => col[i]);
            samples.push(row.join(' | '));
        }
        summary += '\nLatest:\n' + samples.join('\n');
    }
    return { result: summary };
}

return { error: 'Unknown action: ' + action + '. Valid actions: health, dashboards, alerts, query' };
```

---
name: web_search
description: Search the internet for current information — news, weather, scores, prices, facts, recent events. Returns short text snippets from top results.
icon: 🔍
timeout: 35s
parameters:
  query:
    type: string
    description: The search query
    required: true
---

# Web Search

Searches the internet via Brave first, falling back to DuckDuckGo if Brave
fails or returns no useful snippets. Both engines are scraped from their
public HTML SERPs — no API keys required.

```js
const https = require('https');
const query = (args.query || '').trim();
if (!query) return { error: 'Empty search query' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function fetchHtml(opts, perRequestTimeoutMs) {
    return new Promise((resolve, reject) => {
        const req = https.get(opts, (res) => {
            // Follow one redirect (DDG sometimes 30x to its own domain)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && !opts._redirected) {
                res.resume();
                const next = new URL(res.headers.location, `https://${opts.hostname}`);
                fetchHtml({
                    hostname: next.hostname,
                    path: next.pathname + next.search,
                    headers: opts.headers,
                    _redirected: true,
                }, perRequestTimeoutMs).then(resolve, reject);
                return;
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(perRequestTimeoutMs, () => { req.destroy(new Error('timeout')); });
    });
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s+/g, ' ')
            .trim();
}

async function brave(q) {
    const html = await fetchHtml({
        hostname: 'search.brave.com',
        path: '/search?q=' + encodeURIComponent(q) + '&source=web',
        headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    }, 12000);

    const snippets = [];
    let m;
    const descRe = /<div class="snippet[^"]*svelte[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = descRe.exec(html)) && snippets.length < 8) {
        const t = stripTags(m[1]);
        if (t.length > 20) snippets.push(t);
    }
    const genRe = /<div class="generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = genRe.exec(html)) && snippets.length < 12) {
        const t = stripTags(m[1]);
        if (t.length > 15) snippets.push(t);
    }
    return snippets;
}

async function duck(q) {
    // DuckDuckGo HTML endpoint — no JS required, stable for a long time.
    const html = await fetchHtml({
        hostname: 'html.duckduckgo.com',
        path: '/html/?q=' + encodeURIComponent(q),
        headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    }, 12000);

    const snippets = [];
    let m;
    // Result snippets live in <a class="result__snippet">…</a>
    const re = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = re.exec(html)) && snippets.length < 10) {
        const t = stripTags(m[1]);
        if (t.length > 15) snippets.push(t);
    }
    return snippets;
}

async function tryEngine(name, fn) {
    try {
        const out = await fn(query);
        return { name, snippets: out, error: null };
    } catch (e) {
        return { name, snippets: [], error: e.message };
    }
}

// Try Brave first; on failure or empty result, fall back to DuckDuckGo.
const b = await tryEngine('brave', brave);
let snippets = b.snippets;
let used = 'brave';
let lastError = b.error;

if (snippets.length === 0) {
    const d = await tryEngine('ddg', duck);
    if (d.snippets.length > 0) {
        snippets = d.snippets;
        used = 'ddg';
        lastError = null;
    } else if (d.error) {
        lastError = `brave: ${b.error || 'no results'} | ddg: ${d.error}`;
    }
}

if (snippets.length === 0) {
    return { error: lastError ? `Search failed (${lastError})` : `No results for: ${query}` };
}

return { result: `[${used}] ${snippets.join('\n')}` };
```

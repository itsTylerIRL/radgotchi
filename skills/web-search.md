---
name: web_search
description: Search the internet for current information — news, weather, scores, prices, facts, etc.
icon: 🔍
parameters:
  query:
    type: string
    description: The search query
    required: true
---

# Web Search

Searches the internet using Brave Search and returns text snippets from the top results.

```js
const query = args.query || '';
const https = require('https');

return new Promise((resolve) => {
    const searchPath = '/search?q=' + encodeURIComponent(query) + '&source=web';
    const req = https.get({
        hostname: 'search.brave.com',
        path: searchPath,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000
    }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const snippets = [];
            let m;
            // Brave snippet descriptions (contain dates + content)
            const descRe = /<div class="snippet[^"]*svelte[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            while ((m = descRe.exec(data)) && snippets.length < 8) {
                const text = m[1].replace(/<[^>]+>/g, '').trim();
                if (text && text.length > 20) snippets.push(text);
            }
            // Generic snippet divs
            const genRe = /<div class="generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            while ((m = genRe.exec(data)) && snippets.length < 12) {
                const text = m[1].replace(/<[^>]+>/g, '').trim();
                if (text && text.length > 15) snippets.push(text);
            }
            if (snippets.length === 0) {
                resolve({ result: 'No search results found for: ' + query });
            } else {
                resolve({ result: snippets.join('\n') });
            }
        });
    });
    req.on('error', (e) => resolve({ error: 'Search failed: ' + e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'Search timed out' }); });
});
```

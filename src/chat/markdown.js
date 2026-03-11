// Markdown parser and code copy utility

import { translations, getCurrentLang } from './translations.js';

export function parseMarkdown(text) {
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<div class="code-block-wrapper"><button class="copy-btn">COPY</button><pre><code>$1</code></pre></div>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Blockquotes
    html = html.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');
    // Unordered lists
    html = html.replace(/^[\-\*] (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Ordered lists
    html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    // Clean line breaks inside pre
    html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        return '<pre><code>' + code.replace(/<br>/g, '\n') + '</code></pre>';
    });

    return html;
}

export function copyCode(btn) {
    const codeEl = btn.parentElement.querySelector('code');
    const text = codeEl.textContent || codeEl.innerText;
    const t = translations[getCurrentLang()];

    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = t.copied;
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = t.copy; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {
        btn.textContent = t.error;
        setTimeout(() => { btn.textContent = t.copy; }, 1500);
    });
}

export function getHueRotation(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
        const d = max - min;
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    const baseHue = 120;
    const targetHue = h * 360;
    let hueRotate = targetHue - baseHue;
    if (hueRotate < 0) hueRotate += 360;
    return hueRotate;
}

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { blockRemoteContent } from '../remote-content-policy';

const T = 'https://tracker.example/p.png';

function leaks(html) {
    const host = document.createElement('div');
    host.innerHTML = html;
    const f = [];
    for (const el of host.querySelectorAll('*')) {
        for (const a of el.attributes) {
            if (a.name.startsWith('data-blocked-')) continue;
            if (/tracker\.example/i.test(a.value)) f.push(`${el.tagName}[${a.name}]`);
        }
        if (el.tagName === 'STYLE' && /tracker\.example/i.test(el.textContent || '')) f.push('STYLE-text');
    }
    if (/tracker\.example/i.test(host.innerHTML) && !f.length) f.push('RAW');
    return f;
}

const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(1);

const V = [
    ['noscript 突破', `<p>hi</p><noscript><b title="</noscript><img src=${T}>"></noscript>`],
    ['base href', `<base href="https://tracker.example/"><img src="/logo.png">`],
    ['iframe srcdoc', `<iframe srcdoc="&lt;img src=${T}&gt;"></iframe>`],
    ['script src', `<script src="${T}"></script>`],
    ['meta refresh', `<meta http-equiv="refresh" content="0;url=${T}">`],
    ['link preload', `<link rel="preload" as="image" href="${T}">`],
    ['link imagesrcset', `<link rel="preload" as="image" imagesrcset="${T} 1x">`],
    ['frame src', `<frameset><frame src="${T}"></frameset>`],
    ['style @import 註解', `<style>@import/**/"${T}";</style>`],
    ['style @import url', `<style>@import url(${T});</style>`],
    ['style background', `<style>.a{background:url("${T}")}</style><div class="a"></div>`],
    ['style image-set', `<style>.a{background:image-set('${T}' 1x)}</style>`],
    ['style 誘餌 url(', `<style>.a{content:"url(";background:url(${T})}</style>`],
    ['attr image-set', `<div style="background:image-set('${T}' 1x)">x</div>`],
    ['attr CSS 跳脫', `<div style="background:url(\\68 ttps://tracker.example/p.png)">x</div>`],
    ['attr CSS 函式名稱跳脫', `<div style="background:u\\72l(${T})">x</div>`],
    ['style CSS 函式名稱跳脫', `<style>.a{background:u\\72l(${T})}</style>`],
    ['style CSS at-rule 跳脫', `<style>@im\\70ort "${T}";</style>`],
    ['URL 反斜線', `<img src="https:\\\\tracker.example\\p.png">`],
    ['scheme 無斜線', `<img src="https:tracker.example/p.png">`],
    ['data:text/html iframe', `<iframe src="data:text/html,&lt;img src=${T}&gt;"></iframe>`],
    ['quoted src', `<img src="${T}">`],
    ['unquoted src', `<img src=${T}>`],
    ['srcset', `<img srcset="${T} 1x">`],
    ['src+srcset', `<img src="${T}" srcset="https://tracker.example/2x.png 2x">`],
    ['source srcset', `<picture><source srcset="${T}"><img src="cid:x"></picture>`],
    ['td background', `<table><tr><td background="${T}">x</td></tr></table>`],
    ['svg image href', `<svg><image href="${T}"/></svg>`],
    ['video poster', `<video poster="${T}"></video>`],
    ['tab 分割 scheme', `<img src="ht${TAB}tps://tracker.example/p.png">`],
    ['C0 控制字元前綴', `<img src="${NUL}${T}">`],
    ['entity scheme', `<img src="https&#58;//tracker.example/p.png">`],
    ['protocol-relative', `<img src="//tracker.example/p.png">`],
];

const KEEP = [
    ['cid', '<img src="cid:p@x">', 'cid:p@x'],
    ['data image', '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7">', 'data:image/gif'],
    ['blob', '<img src="blob:https://app.example/8f2c">', 'blob:'],
    ['相對路徑', '<img src="/assets/logo.png">', '/assets/logo.png'],
    ['排版 CSS', '<table><tr><td style="padding:8px;color:#333">hi</td></tr></table>', 'padding:8px'],
    ['style 區塊排版', '<style>.a{color:red;font-size:14px}</style><p class="a">x</p>', 'font-size:14px'],
    ['data: 於 CSS', '<div style="background:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7)">x</div>', 'data:image/gif'],
    ['外部 a 連結', `<a href="${T}">open</a>`, T],
    ['外部 area 連結', `<map name="m"><area href="${T}" coords="0,0,1,1"></map>`, T],
];

describe('攻擊向量', () => {
    it.each(V)('%s', (n, html) => {
        const r = blockRemoteContent(html);
        expect({ v: n, leaks: leaks(r.html) }).toEqual({ v: n, leaks: [] });
    });
});

describe('必須保留', () => {
    it.each(KEEP)('%s', (n, html, needle) => {
        const r = blockRemoteContent(html);
        expect({ v: n, kept: r.html.includes(needle), blocked: r.blocked })
            .toEqual({ v: n, kept: true, blocked: 0 });
    });
});

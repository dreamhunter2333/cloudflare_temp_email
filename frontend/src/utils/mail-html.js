const EXTERNAL_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
  <rect width="320" height="80" rx="8" fill="#f3f4f6"/>
  <text x="160" y="45" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">External image blocked</text>
</svg>
`)}`;

const isExternalImageUrl = (value) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith('http://')
        || normalized.startsWith('https://')
        || normalized.startsWith('//');
};

const srcsetHasExternalUrl = (value) => {
    if (!value) return false;
    return value.split(',').some((item) => isExternalImageUrl(item.trim().split(/\s+/)[0]));
};

const blockSourceSet = (element) => {
    const srcset = element.getAttribute('srcset') || '';
    if (!srcsetHasExternalUrl(srcset)) return;

    element.setAttribute('data-blocked-srcset', srcset);
    element.setAttribute('srcset', `${EXTERNAL_IMAGE_PLACEHOLDER} 1x`);
};

const blockStyleExternalImages = (element) => {
    const style = element.getAttribute('style') || '';
    if (!/url\(\s*(['"]?)(https?:|\/\/)/i.test(style)) return;

    element.setAttribute('data-blocked-style', style);
    element.removeAttribute('style');
};

const blockExternalHref = (element) => {
    const href = element.getAttribute('href') || element.getAttribute('xlink:href') || '';
    if (!isExternalImageUrl(href)) return;

    element.setAttribute('data-blocked-href', href);
    element.removeAttribute('href');
    element.removeAttribute('xlink:href');
};

export const applyExternalImagePolicy = (html, autoLoadExternalImages) => {
    if (autoLoadExternalImages || !html) {
        return html || '';
    }

    if (typeof DOMParser !== 'function') {
        return html;
    }

    const hasDocumentShell = /<!doctype|<html[\s>]/i.test(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const base of doc.querySelectorAll('base')) {
        base.remove();
    }

    for (const source of doc.querySelectorAll('source[srcset]')) {
        blockSourceSet(source);
    }

    for (const element of doc.querySelectorAll('[style]')) {
        blockStyleExternalImages(element);
    }

    for (const element of doc.querySelectorAll('image[href], image[xlink\\:href], use[href], use[xlink\\:href]')) {
        blockExternalHref(element);
    }

    for (const image of doc.querySelectorAll('img')) {
        const src = image.getAttribute('src') || '';

        blockSourceSet(image);

        if (!isExternalImageUrl(src) && !image.getAttribute('data-blocked-srcset')) {
            continue;
        }

        if (src) image.setAttribute('data-blocked-src', src);
        image.setAttribute('src', EXTERNAL_IMAGE_PLACEHOLDER);
        image.setAttribute('loading', 'lazy');
        image.style.maxWidth = '100%';
        image.style.height = 'auto';
        image.style.border = '1px solid #d1d5db';
        image.style.borderRadius = '8px';
    }

    if (hasDocumentShell) {
        return `<!doctype html>\n${doc.documentElement.outerHTML}`;
    }

    return doc.body.innerHTML;
};

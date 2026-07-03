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

export const applyExternalImagePolicy = (html, autoLoadExternalImages) => {
    if (autoLoadExternalImages || !html) {
        return html || '';
    }

    if (typeof DOMParser !== 'function') {
        return html;
    }

    const hasDocumentShell = /<!doctype|<html[\s>]/i.test(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const image of doc.querySelectorAll('img')) {
        const src = image.getAttribute('src') || '';
        const srcset = image.getAttribute('srcset') || '';

        if (!isExternalImageUrl(src) && !srcsetHasExternalUrl(srcset)) {
            continue;
        }

        if (src) image.setAttribute('data-blocked-src', src);
        if (srcset) image.setAttribute('data-blocked-srcset', srcset);
        image.removeAttribute('srcset');
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

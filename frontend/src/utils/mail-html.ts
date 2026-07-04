const REMOTE_CONTENT_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
  <rect width="320" height="80" rx="8" fill="#f3f4f6"/>
  <text x="160" y="45" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#6b7280">Remote content blocked</text>
</svg>
`)}`;

const REMOTE_URL_PATTERN = /^(?:https?:)?\/\//i;
const DOCUMENT_SHELL_PATTERN = /<!doctype|<html[\s>]/i;

const isRemoteUrl = (value: string | null) => {
    return REMOTE_URL_PATTERN.test(value?.trim() || '');
};

const hasRemoteSrcset = (value: string | null) => {
    if (!value) return false;

    return value.split(',')
        .some((candidate) => isRemoteUrl(candidate.trim().split(/\s+/)[0] || null));
};

const shouldBlockImage = (image: HTMLImageElement) => {
    return isRemoteUrl(image.getAttribute('src'))
        || hasRemoteSrcset(image.getAttribute('srcset'));
};

const blockImage = (image: HTMLImageElement) => {
    const src = image.getAttribute('src');
    const srcset = image.getAttribute('srcset');

    if (src) image.setAttribute('data-blocked-src', src);
    if (srcset) image.setAttribute('data-blocked-srcset', srcset);

    image.removeAttribute('srcset');
    image.setAttribute('src', REMOTE_CONTENT_PLACEHOLDER);
    image.setAttribute('loading', 'lazy');
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
    image.style.border = '1px solid #d1d5db';
    image.style.borderRadius = '8px';
};

const serializeMailHtml = (doc: Document, hasDocumentShell: boolean) => {
    if (hasDocumentShell) {
        return `<!doctype html>\n${doc.documentElement.outerHTML}`;
    }

    return doc.body.innerHTML;
};

export const applyRemoteContentPolicy = (html: string | null | undefined, loadRemoteContent: boolean) => {
    const mailHtml = html || '';
    if (loadRemoteContent || !mailHtml) return mailHtml;
    if (typeof DOMParser !== 'function') return mailHtml;

    const hasDocumentShell = DOCUMENT_SHELL_PATTERN.test(mailHtml);
    const doc = new DOMParser().parseFromString(mailHtml, 'text/html');

    for (const image of doc.querySelectorAll('img')) {
        if (shouldBlockImage(image)) {
            blockImage(image);
        }
    }

    return serializeMailHtml(doc, hasDocumentShell);
};

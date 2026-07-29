import DOMPurify from 'dompurify';

// 1x1 transparent GIF, substituted for blocked remote images.
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7';

// Attributes whose value the browser resolves into a request.
const URL_ATTRIBUTES = new Set([
    'src', 'srcset', 'imagesrcset', 'href', 'xlink:href',
    'poster', 'background', 'data', 'action', 'formaction',
]);
const NAVIGATION_HREF_ELEMENTS = new Set(['A', 'AREA']);

// Elements that fetch on their own, redirect the frame, or re-base every
// relative URL in the document. None of them belong in a mail body, and
// <base> in particular would turn the relative paths we deliberately keep
// into requests to whatever host it names.
const FORBIDDEN = [
    'base', 'meta', 'script', 'link', 'iframe', 'frame', 'frameset',
    'object', 'embed', 'noscript', 'template', 'portal',
];

// DOMPurify's default scheme list has no blob:, but email-parser.js rewrites
// cid: attachments into blob: URLs -- without this every inline image would be
// stripped along with the trackers.
const ALLOWED_URI_REGEXP =
    /^(?:(?:https?|mailto|tel|callto|sms|cid|xmpp|blob|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// CSS constructs that can load a resource. @import is listed because it also
// accepts a bare string -- `@import "https://..."` fetches without any url().
const CSS_FETCHES = /url\(|image-set|image\(|cross-fade|element\(|@import/i;
// A url(...) token or a bare string, either of which can name a resource.
const CSS_TOKEN = /url\(\s*(['"]?)([^'")]*)\1\s*\)|(['"])([^'"]*)\3/g;
const CSS_ESCAPE = /\\([0-9a-f]{1,6})[ \t\r\n\f]?|\\([^\r\n\f0-9a-f])/gi;
const CSS_ESCAPED_IDENTIFIER =
    /@?(?:[-_a-z0-9]|\\(?:[0-9a-f]{1,6}[ \t\r\n\f]?|[^\r\n\f0-9a-f]))+/gi;
const CSS_FETCH_IDENTIFIERS = new Set([
    'url', 'image-set', '-webkit-image-set', 'image', 'cross-fade',
    '-webkit-cross-fade', 'element', '-moz-element', '@import',
]);

function decodeCssEscapes(value) {
    return value.replace(CSS_ESCAPE, (_match, hex, escaped) => {
        if (!hex) {
            return escaped;
        }
        const codePoint = Number.parseInt(hex, 16);
        if (codePoint === 0 || codePoint > 0x10FFFF ||
            (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
            return '\uFFFD';
        }
        return String.fromCodePoint(codePoint);
    });
}

function normalizeCssFetchIdentifiers(value) {
    return value.replace(CSS_ESCAPED_IDENTIFIER, (identifier) => {
        if (!identifier.includes('\\')) {
            return identifier;
        }
        const decoded = decodeCssEscapes(identifier);
        return CSS_FETCH_IDENTIFIERS.has(decoded.toLowerCase()) ? decoded : identifier;
    });
}

/**
 * Whether a URL can be *proven* to stay off the network.
 *
 * This is deliberately an allowlist. Asking "does this look remote?" means
 * enumerating every way a scheme can be disguised -- backslashes, tabs and
 * control characters the URL parser strips, CSS escapes, schemes with no
 * slashes -- and losing to the first one not thought of. Asking "can I prove
 * this is local?" fails closed instead: anything unrecognised is blocked.
 *
 * Relative paths qualify only because <base> is removed above, so they can
 * resolve to nothing but our own origin.
 */
function provablyLocal(value) {
    const url = String(value ?? '').trim();
    if (url === '') {
        return true;
    }
    if (/^(?:cid:|blob:|data:image\/)/i.test(url)) {
        return true;
    }
    // Relative: starts with a path/query/fragment marker and is not the
    // protocol-relative "//host" form (or its backslash equivalent).
    if (/^[/.?#]/.test(url)) {
        return !/^[/\\]{2}/.test(url);
    }
    // No scheme separator and no backslash at all -- a bare relative filename.
    return !/[:\\]/.test(url);
}

/** srcset holds several candidates; every one of them has to be local. */
function srcsetIsLocal(value) {
    return String(value ?? '')
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/)[0])
        .filter(Boolean)
        .every(provablyLocal);
}

/**
 * Replaces every resource reference in a chunk of CSS that cannot be proven
 * local. Tokens are substituted in place rather than whole declarations
 * dropped, so the surrounding rule structure survives.
 */
function blockCssUrls(cssText, onBlocked) {
    const normalizedCssText = normalizeCssFetchIdentifiers(cssText);
    if (!CSS_FETCHES.test(normalizedCssText)) {
        return cssText;
    }
    return normalizedCssText.replace(CSS_TOKEN, (match, urlQuote, urlValue, strQuote, strValue) => {
        const isUrlToken = urlValue !== undefined;
        const token = isUrlToken ? urlValue : strValue;
        if (provablyLocal(token)) {
            return match;
        }
        onBlocked();
        return isUrlToken
            ? `url(${urlQuote}${TRANSPARENT_PIXEL}${urlQuote})`
            : `${strQuote}${TRANSPARENT_PIXEL}${strQuote}`;
    });
}

let purifier = null;
let blockedCount = 0;

/**
 * An isolated DOMPurify instance. The hooks below must not reach the shared
 * singleton, which mail-actions.js uses when building replies -- quoting a
 * mail should keep its images.
 */
function getPurifier() {
    if (purifier) {
        return purifier;
    }
    purifier = DOMPurify(window);

    purifier.addHook('uponSanitizeAttribute', (node, data) => {
        if (!URL_ATTRIBUTES.has(data.attrName)) {
            return;
        }
        if (data.attrName === 'href' && NAVIGATION_HREF_ELEMENTS.has(node.tagName)) {
            return;
        }
        const isSrcset = data.attrName === 'srcset' || data.attrName === 'imagesrcset';
        if (isSrcset ? srcsetIsLocal(data.attrValue) : provablyLocal(data.attrValue)) {
            return;
        }

        blockedCount += 1;
        data.keepAttr = false;
        // The original URL is dropped rather than parked in a data-* attribute:
        // "the cleaned body contains no remote URL at all" is an invariant that
        // can be asserted directly, and restoring images re-renders from the
        // untouched source anyway. <img> keeps a placeholder so layout holds.
        if (data.attrName === 'src' && node.tagName === 'IMG') {
            node.setAttribute('src', TRANSPARENT_PIXEL);
        }
    });

    purifier.addHook('afterSanitizeElements', (node) => {
        if (node.tagName === 'STYLE') {
            const cleaned = blockCssUrls(node.textContent || '', () => { blockedCount += 1; });
            if (cleaned !== node.textContent) {
                node.textContent = cleaned;
            }
        }
    });

    purifier.addHook('afterSanitizeAttributes', (node) => {
        const style = node.getAttribute && node.getAttribute('style');
        if (!style) {
            return;
        }
        const cleaned = blockCssUrls(style, () => { blockedCount += 1; });
        if (cleaned !== style) {
            node.setAttribute('style', cleaned);
        }
    });

    return purifier;
}

/**
 * Strips everything in an email body that would make the browser fetch from a
 * third party, so opening the mail cannot be used to confirm it was read.
 *
 * Sanitising is delegated to DOMPurify rather than hand-rolled: the hard part
 * is not enumerating attributes but surviving the parser, and mutation-XSS is
 * DOMPurify's specialty. A hand-written pass over a DOMParser tree missed, for
 * one example, that <noscript> is parsed as markup where scripting is off and
 * as raw text where it is on -- so a `</noscript>` smuggled into an attribute
 * value reopens the document at render time and revives an <img> that the
 * cleaner never saw.
 *
 * @param {string} html
 * @returns {{ html: string, blocked: number }} blocked counts the references removed
 */
export function blockRemoteContent(html) {
    if (!html || typeof html !== 'string') {
        return { html: html || '', blocked: 0 };
    }

    blockedCount = 0;
    const sanitised = getPurifier().sanitize(html, {
        FORBID_TAGS: FORBIDDEN,
        // Mail layout leans on <style> blocks, so they are kept and their
        // url() references filtered instead of dropping the tag wholesale.
        // FORCE_BODY is what makes a leading <style> survive: without it the
        // parser hoists it into <head> and DOMPurify discards it.
        ADD_TAGS: ['style'],
        FORCE_BODY: true,
        ALLOWED_URI_REGEXP,
        ALLOW_DATA_ATTR: true,
    });

    return { html: sanitised, blocked: blockedCount };
}

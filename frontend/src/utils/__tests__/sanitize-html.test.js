// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitize-html';

describe('sanitizeHtml', () => {
    it('preserves safe announcement markup', () => {
        expect(sanitizeHtml('<strong>Notice</strong>')).toBe('<strong>Notice</strong>');
    });

    it('removes executable markup and unsafe attributes', () => {
        const sanitized = sanitizeHtml(
            '<script>alert(1)</script><img src="x" onerror="alert(1)">'
        );

        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).toContain('<img src="x">');
    });

    it('returns an empty string for non-string values', () => {
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml({ value: '<strong>unsafe ref</strong>' })).toBe('');
    });
});

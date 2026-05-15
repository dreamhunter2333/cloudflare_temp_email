import { describe, it, expect } from 'vitest';
import { safeHeaderValue, safeBearerHeader } from '../headers';

describe('safeHeaderValue', () => {
    it('returns the trimmed value for safe input', () => {
        expect(safeHeaderValue('abc123')).toBe('abc123');
        expect(safeHeaderValue('  abc123  ')).toBe('abc123');
    });

    it('skips null / undefined / non-string inputs', () => {
        expect(safeHeaderValue(null)).toBeUndefined();
        expect(safeHeaderValue(undefined)).toBeUndefined();
        expect(safeHeaderValue(123)).toBeUndefined();
        expect(safeHeaderValue({})).toBeUndefined();
    });

    it('skips empty / whitespace-only / sentinel strings (issue #1000)', () => {
        expect(safeHeaderValue('')).toBeUndefined();
        expect(safeHeaderValue('   ')).toBeUndefined();
        expect(safeHeaderValue('undefined')).toBeUndefined();
        expect(safeHeaderValue('null')).toBeUndefined();
    });

    it('skips values containing control characters (issue #1000)', () => {
        // \n inside a JWT-shaped value would otherwise trigger
        // "Invalid character in header content" from axios/undici.
        expect(safeHeaderValue('eyJhbGc\nxyz')).toBeUndefined();
        expect(safeHeaderValue('foo\rbar')).toBeUndefined();
        expect(safeHeaderValue('foo\tbar')).toBeUndefined();
        expect(safeHeaderValue('foo\x00bar')).toBeUndefined();
        expect(safeHeaderValue('foo\x1fbar')).toBeUndefined();
        expect(safeHeaderValue('foo\x7fbar')).toBeUndefined();
    });

    it('preserves printable ASCII and the typical JWT alphabet', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.x';
        expect(safeHeaderValue(jwt)).toBe(jwt);
    });
});

describe('safeBearerHeader', () => {
    it('wraps a safe JWT in a Bearer prefix', () => {
        expect(safeBearerHeader('abc123')).toBe('Bearer abc123');
    });

    it('returns undefined when the JWT is empty so the header is dropped', () => {
        // This is the central guard for #1000: a fresh client with no JWT
        // must not send "Bearer " (trailing space) — which some HTTP stacks
        // reject as "Invalid character in header content".
        expect(safeBearerHeader('')).toBeUndefined();
        expect(safeBearerHeader(null)).toBeUndefined();
        expect(safeBearerHeader(undefined)).toBeUndefined();
        expect(safeBearerHeader('undefined')).toBeUndefined();
    });

    it('returns undefined when the JWT carries control characters', () => {
        expect(safeBearerHeader('eyJhbGc\nxyz')).toBeUndefined();
        expect(safeBearerHeader('eyJhbGc\rxyz')).toBeUndefined();
    });

    it('trims surrounding whitespace before building the header', () => {
        expect(safeBearerHeader('  abc123  ')).toBe('Bearer abc123');
    });
});

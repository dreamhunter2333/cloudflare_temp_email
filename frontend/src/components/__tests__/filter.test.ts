import { describe, expect, it } from 'vitest';
import { isFilterExpression } from '../filter';

describe('filter operator variants', () => {
    it.each(['equals', 'contains', 'startsWith', 'endsWith'])('accepts both %s operators without translation', operator => {
        for (const value of [operator, `${operator}CaseSensitive`]) {
            const node = { field: 'subject', operator: value, value: 'DOWN' };
            expect(isFilterExpression(node)).toBe(true);
            expect(JSON.parse(JSON.stringify(node))).toEqual(node);
        }
    });
    it('accepts regex options and extensible operators but not a null expression', () => {
        expect(isFilterExpression({ field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'i' } })).toBe(true);
        expect(isFilterExpression(null)).toBe(false);
        expect(isFilterExpression({ field: 'subject', operator: 'future', value: '' })).toBe(true);
    });
});

describe('filter editor JSON structure', () => {
    const leaf = { field: 'subject', operator: 'contains', value: 'test' };
    it('accepts extensible operators and nested logical expressions', () => {
        expect(isFilterExpression({ field: 'future', operator: 'future', value: '', options: { custom: true } })).toBe(true);
        expect(isFilterExpression({ operator: 'and', children: [leaf, { operator: 'not', children: [leaf] }] })).toBe(true);
    });
    it.each([null, [], false, {}, { operator: 'and', children: [] }, { operator: 'not', children: [leaf, leaf] },
        { ...leaf, children: [] }, { ...leaf, options: [] }, { ...leaf, value: 'a'.repeat(501) }])('rejects invalid structure %j', value => {
        expect(isFilterExpression(value)).toBe(false);
    });
    it('bounds depth and total nodes before rendering recursion', () => {
        let node: any = leaf;
        for (let i = 0; i < 8; i++) node = { operator: 'not', children: [node] };
        expect(isFilterExpression(node)).toBe(false);
        expect(isFilterExpression({ operator: 'and', children: Array(100).fill(leaf) })).toBe(false);
    });
});

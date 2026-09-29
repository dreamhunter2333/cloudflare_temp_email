import { describe, expect, it } from 'vitest';
import { getFilterOperator, isFilterExpression } from '../filter';

describe('filter operator variants', () => {
    it.each(['equals', 'contains', 'startsWith', 'endsWith'])('restores both %s variants from existing rules', operator => {
        const operators = [
            { value: operator, label: operator },
            { value: `${operator}CaseSensitive`, label: operator, operator, presetOptions: { caseSensitive: true } },
        ];
        const node = { field: 'subject', operator, value: 'DOWN' };
        expect(getFilterOperator(node, operators)?.value).toBe(operator);
        expect(getFilterOperator({ ...node, options: { caseSensitive: false } }, operators)?.value).toBe(operator);
        expect(getFilterOperator({ ...node, options: { caseSensitive: true } }, operators)?.value).toBe(`${operator}CaseSensitive`);
    });
    it('preserves regular operators and handles unset or unknown rules', () => {
        const operators = [{ value: 'regex', label: 'Regex' }];
        expect(getFilterOperator({ field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'i' } }, operators)?.value).toBe('regex');
        expect(getFilterOperator(null, operators)).toBeUndefined();
        expect(getFilterOperator({ field: 'subject', operator: 'future', value: '' }, operators)).toBeUndefined();
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

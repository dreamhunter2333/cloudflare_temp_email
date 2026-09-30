import { describe, expect, it } from 'vitest';
import { isFilterExpression, isValidFilterExpression, validateRegex } from '../filter';

describe('filter editor semantic validation', () => {
    const operators = [
        ...['equals', 'contains', 'startsWith', 'endsWith'].flatMap(value => [
            { value, label: value }, { value: `${value}CaseSensitive`, label: value },
        ]),
        { value: 'regex', label: 'regex', options: [{ key: 'flags', label: 'flags' }], validate: validateRegex },
    ];
    const leaf = { field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'ims' } };
    it('accepts supported operators, flags, nested rules and absent filters', () => {
        for (const operator of operators) {
            expect(isValidFilterExpression({ field: 'subject', operator: operator.value, value: 'DOWN' }, operators)).toBe(true);
        }
        expect(isValidFilterExpression({ operator: 'not', children: [leaf] }, operators)).toBe(true);
        expect(isValidFilterExpression(null, operators)).toBe(true);
        expect(isValidFilterExpression(undefined, operators)).toBe(true);
    });
    it.each([
        { ...leaf, operator: 'unknown' },
        { ...leaf, operator: 'contains' },
        { ...leaf, value: '[' },
        { ...leaf, value: '(a)\\1' },
        { ...leaf, value: '(?=a)' },
        { ...leaf, options: { flags: 'g' } },
        { ...leaf, options: { flags: 'ii' } },
        { ...leaf, options: { flags: false } },
        { ...leaf, options: { unsupported: true } },
    ])('rejects invalid operators, options and RE2 expressions: %j', invalid => {
        expect(isValidFilterExpression(invalid, operators)).toBe(false);
        expect(isValidFilterExpression({ operator: 'or', children: [leaf, invalid] }, operators)).toBe(false);
    });
    it('allows consumers to supply validators for new operators', () => {
        const custom = { value: 'future', label: 'future', validate: (value: string) => {
            if (value !== 'valid') throw new Error('Invalid value');
        } };
        expect(isValidFilterExpression({ field: 'subject', operator: 'future', value: 'valid' }, [custom])).toBe(true);
        expect(isValidFilterExpression({ field: 'subject', operator: 'future', value: 'invalid' }, [custom])).toBe(false);
    });
    it('uses the consumer field validator for every nested condition', () => {
        const allowed = (field: string) => field === 'subject' || /^header\.[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/.test(field);
        for (const [field, valid] of [['subject', true], ['header.List-ID', true], ['headerFrom', false],
            ['envelopeFrom', false], ['header.', false], ['header.Bad Header', false], ['', false]] as const) {
            expect(isValidFilterExpression({ operator: 'or', children: [leaf, { ...leaf, field }] }, operators, allowed)).toBe(valid);
        }
    });
});

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

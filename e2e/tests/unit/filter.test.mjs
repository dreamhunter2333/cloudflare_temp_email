import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileFilter, filterOperators } from '../../../worker/src/utils/filter.ts';

const rule = (operator, value, options) => ({ field: 'subject', operator, value, ...(options ? { options } : {}) });
const compile = expression => compileFilter(expression, field => ['subject', 'from'].includes(field));

test('old configurations and null filters match without data', () => {
  assert.equal(compile(undefined)({}), true);
  assert.equal(compile(null)({}), true);
});

for (const [operator, value, input, matched] of [
  ['equals', 'DOWN', 'down', true], ['equals', 'DOWN', 'DOWN service', false],
  ['contains', '告警', '服务告警！', true], ['contains', 'DOWN', 'UP', false],
  ['startsWith', 'down', 'DOWN service', true], ['startsWith', 'down', 'service down', false],
  ['endsWith', 'down', 'service DOWN', true], ['endsWith', 'down', 'DOWN service', false],
  ['regex', '^(DOWN|ALERT)\\b', 'DOWN service', true], ['regex', '^DOWN', 'down', false],
  ['equals', '', '', true], ['contains', 'x', '', false],
]) {
  test(`${operator}: ${JSON.stringify(value)} / ${JSON.stringify(input)}`, () => {
    assert.equal(compile(rule(operator, value))({ subject: input }), matched);
  });
}

test('text options and regex flags', () => {
  assert.equal(compile(rule('contains', 'DOWN', { caseSensitive: true }))({ subject: 'down' }), false);
  assert.equal(compile(rule('regex', '^down.$', { flags: 'ims' }))({ subject: 'first\nDOWN\n' }), true);
  assert.equal(compile(rule('regex', '告警|故障'))({ subject: '发生故障' }), true);
});

test('nested AND OR NOT and list values', () => {
  const match = compile({ operator: 'and', children: [
    { field: 'from', operator: 'endsWith', value: '@example.com' },
    { operator: 'or', children: [rule('contains', 'DOWN'), rule('contains', 'ALERT')] },
    { operator: 'not', children: [rule('contains', 'maintenance')] },
  ] });
  assert.equal(match({ from: ['bounce@other.com', 'sender@example.com'], subject: 'ALERT now' }), true);
  assert.equal(match({ from: ['sender@example.com'], subject: 'ALERT maintenance' }), false);
  assert.equal(match({ from: [], subject: 'ALERT now' }), false);
  const not = compile({ operator: 'not', children: [{ field: 'from', operator: 'contains', value: 'blocked' }] });
  assert.equal(not({ from: ['allowed@example.com', 'blocked@example.com'] }), false);
  assert.equal(not({ from: ['allowed@example.com'] }), true);
  assert.equal(not({ from: [] }), true);
});

test('empty known strings differ from unavailable fields, including under NOT or short circuit', () => {
  assert.throws(() => compile({ operator: 'not', children: [rule('contains', 'a')] })({}), /Unavailable/);
  assert.throws(() => compile(rule('equals', 'a'))({ subject: [undefined] }), /Unavailable/);
  assert.throws(() => compile({ operator: 'or', children: [rule('contains', ''), { field: 'from', operator: 'equals', value: '' }] })({ subject: '' }), /Unavailable/);
});

for (const expression of [
  false, 1, [], 'text', {},
  { operator: 'and', children: [] }, { operator: 'or', children: [] },
  { operator: 'not', children: [] }, { operator: 'not', children: [rule('equals', 'a'), rule('equals', 'b')] },
  { operator: 'and', children: [rule('equals', 'a')], field: 'subject' },
  { field: 'unknown', operator: 'contains', value: 'a' },
  rule('constructor', 'a'), rule('toString', 'a'), rule('unknown', 'a'),
  rule('equals', 1), rule('equals', 'x'.repeat(501)),
  rule('equals', 'x', { caseSensitive: 'yes' }), rule('equals', 'x', { flags: 'i' }),
  rule('regex', '['), rule('regex', '(a)\\1'), rule('regex', '(?=a)'),
  rule('regex', 'x', { flags: 'g' }), rule('regex', 'x', { flags: 'ii' }),
  { ...rule('contains', 'a'), children: [] },
]) {
  test(`reject invalid expression: ${JSON.stringify(expression).slice(0, 100)}`, () => {
    assert.throws(() => compile(expression));
  });
}

test('validate branches before short circuit', () => {
  assert.throws(() => compile({ operator: 'or', children: [rule('contains', ''), rule('unknown', 'x')] }));
});

test('bound node count and nesting', () => {
  assert.throws(() => compile({ operator: 'or', children: Array.from({ length: 100 }, () => rule('equals', 'a')) }));
  let nested = rule('equals', 'a');
  for (let i = 0; i < 7; i++) nested = { operator: 'not', children: [nested] };
  assert.doesNotThrow(() => compile(nested));
  assert.throws(() => compile({ operator: 'not', children: [nested] }));
});

test('custom fields and operators do not require engine changes', () => {
  const match = compileFilter({ field: 'name', operator: 'lengthEquals', value: '3' }, field => field === 'name', {
    ...filterOperators, lengthEquals: value => input => input.length === Number(value),
  });
  assert.equal(match({ name: 'abc' }), true);
  assert.equal(match({ name: 'ab' }), false);
});

test('RE2 handles nested quantifiers without catastrophic backtracking', () => {
  const start = performance.now();
  assert.equal(compile(rule('regex', '^(a+)+$'))({ subject: 'a'.repeat(100000) + '!' }), false);
  assert.ok(performance.now() - start < 3000);
});

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
  ['regex', '(?=DOWN)DOWN', 'DOWN service', true], ['regex', '(?=DOWN)DOWN', 'UP service', false],
  ['regex', '^(a)\\1$', 'aa', true], ['regex', '^(a)\\1$', 'ab', false],
  ['regex', '(?<code>\\d{4})', 'Code 1234', true], ['regex', '(?<code>\\d{4})', 'No code', false],
  ['equals', '', '', true], ['contains', 'x', '', false],
]) {
  test(`${operator}: ${JSON.stringify(value)} / ${JSON.stringify(input)}`, () => {
    assert.equal(compile(rule(operator, value))({ subject: input }), matched);
  });
}

test('text options and regex flags', () => {
  assert.equal(compile(rule('containsCaseSensitive', 'DOWN'))({ subject: 'down' }), false);
  assert.equal(compile(rule('regex', '^down.$', { flags: 'ims' }))({ subject: 'first\nDOWN\n' }), true);
  assert.equal(compile(rule('regex', '告警|故障'))({ subject: '发生故障' }), true);
});

for (const operator of ['equals', 'contains', 'startsWith', 'endsWith']) {
  test(`${operator}: separate case-sensitive operator`, () => {
    assert.equal(compile(rule(operator, 'down'))({ subject: 'DOWN' }), true);
    assert.equal(compile(rule(`${operator}CaseSensitive`, 'down'))({ subject: 'DOWN' }), false);
    assert.equal(compile(rule(`${operator}CaseSensitive`, 'DOWN'))({ subject: 'DOWN' }), true);
    assert.throws(() => compile(rule(operator, 'down', { caseSensitive: true })));
    assert.throws(() => compile(rule(`${operator}CaseSensitive`, 'down', { flags: 'i' })));
  });
}

test('nested AND OR NOT and list values', () => {
  const match = compile({ operator: 'and', children: [
    { field: 'from', operator: 'endsWith', value: '@example.com' },
    { operator: 'and', children: [
      { operator: 'or', children: [rule('contains', 'DOWN'), rule('contains', 'ALERT')] },
      { operator: 'not', children: [rule('contains', 'maintenance')] },
    ] },
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
  { operator: 'and', children: [rule('equals', 'a')] },
  { operator: 'or', children: [rule('equals', 'a')] },
  { operator: 'and', children: [rule('equals', 'a'), rule('equals', 'b'), rule('equals', 'c')] },
  { operator: 'or', children: [rule('equals', 'a'), rule('equals', 'b'), rule('equals', 'c')] },
  { operator: 'and', children: [rule('equals', 'a'), null] },
  { operator: 'not', children: [] }, { operator: 'not', children: [rule('equals', 'a'), rule('equals', 'b')] },
  { operator: 'and', children: [rule('equals', 'a')], field: 'subject' },
  { field: 'unknown', operator: 'contains', value: 'a' },
  rule('constructor', 'a'), rule('toString', 'a'), rule('unknown', 'a'),
  rule('equals', 1), rule('equals', 'x'.repeat(501)),
  rule('equals', 'x', { caseSensitive: 'yes' }), rule('equals', 'x', { flags: 'i' }),
  rule('regex', '['), rule('regex', '('), rule('regex', '*a'),
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
  const tree = count => count === 1 ? rule('equals', 'a') : { operator: 'and', children: [
    tree(Math.floor(count / 2)), tree(Math.ceil(count / 2)),
  ] };
  assert.doesNotThrow(() => compile(tree(50)));
  assert.doesNotThrow(() => compile({ operator: 'not', children: [tree(50)] }));
  assert.throws(() => compile(tree(51)), /100 nodes/);
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

test('native regex matches long input with a simple anchored pattern', () => {
  const start = performance.now();
  assert.equal(compile(rule('regex', '^a+$'))({ subject: 'a'.repeat(100000) + '!' }), false);
  assert.ok(performance.now() - start < 3000);
});

test('regex matching follows native JavaScript semantics across patterns and flags', () => {
  const patterns = ['', '^$', 'error|warning', '^DOWN', 'DOWN$', 'a.*b', 'a.*?b',
    'a+$', 'a{0,20}', '\\b[0-9]{6}\\b', 'https?://[^\\s"<>]+', '[A-Za-z]+',
    '😀|告警', '(?=DOWN)DOWN', '[ab]{20}$', '(?<code>[0-9]{4})'];
  const inputs = ['', 'DOWN service', 'down', 'UP\nDOWN', 'a\nb', 'aaaaaaaaaaaaaaa!',
    'Notification 123456 received', '通知：验证码1234', '😀', 'Warning ERROR',
    'line1\nline2\n', 'See https://example.com/test'];
  for (const flags of ['', 'i', 'm', 's', 'im', 'is', 'ms', 'ims']) {
    for (const pattern of patterns) {
      const match = compile(rule('regex', pattern, { flags }));
      const expression = new RegExp(pattern, flags);
      for (const input of inputs) {
        assert.equal(match({ subject: input }), expression.test(input), JSON.stringify({ pattern, input, flags }));
      }
    }
  }
});

test('native regex captures and repeated evaluations remain stateless', () => {
  const match = compile(rule('regex', '^([A-Z]+)-(\\d+)$'));
  assert.equal(match({ subject: 'A'.repeat(10000) + '-1234' }), true);
  assert.equal(match({ subject: '' }), false);
  assert.equal(match({ subject: 'ABC' }), false);
  assert.equal(match({ subject: 'ID-1234' }), true);
});

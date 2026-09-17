import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractCode } from '../../../worker/src/email/extract_code.ts';
import { resolveExtractMode } from '../../../worker/src/email/extract_mode.ts';

const codeCases = [
  // Chinese
  ['您的验证码是 123456，5分钟内有效', '123456'],
  ['【某某】验证码：839201，请勿泄露', '839201'],
  ['验证码123456，10分钟内有效', '123456'],
  ['您的登录动态码为 4821', '4821'],
  ['123456 是您的验证码，请勿转发', '123456'],
  ['驗證碼：556677', '556677'],
  // Japanese / Korean
  ['認証コードは 482913 です。', '482913'],
  ['인증번호 [736251]를 입력해 주세요.', '736251'],
  ['인증 코드: 918273', '918273'],
  // English
  ['Your verification code is: 482913', '482913'],
  ['123456 is your Instagram code', '123456'],
  ['G-482913 is your Google verification code', '482913'],
  ['Your code: 123-456', '123456'],
  ['Your one-time passcode is 12 34 56', '123456'],
  ['Your code is\n\n  839201\n\nIt expires in 10 minutes', '839201'],
  ['Enter this code to sign in\n 591 204\n', '591204'],
  ['Order #20391 shipped. Call 400-820-1234. Your login code: 7F3K9Q', '7F3K9Q'],
  ['Use 4821 to verify your account', '4821'],
  ['Please verify your email.\n\n706215\n\nThanks', '706215'],
  ['Hello,\n\nUse the following code to log in:\n\n  274019\n\nIf you did not request this, ignore.', '274019'],
  ['Your Microsoft account security code\nSecurity code: 3721\nAccount: a***@x.com', '3721'],
  ['Here is your GitHub launch code: 12345678\n\n© 2026 GitHub, Inc. San Francisco, CA 94107', '12345678'],
];

const noCodeCases = [
  'Hi, invoice total 3500 yuan, see attachment',
  'Your order #582910 has shipped',
  'Meeting moved to 2026-09-18 15:30, room 1203',
  'Use promo code: SAVE2026 at checkout',
  'Sign in to see your order, total $1299.00',
  'verification code is: Your account',
  'Your verification code is 2026',
  'Security notice for account created on 20260411',
  'Please verify your email by clicking the link below.\n© 2026 GitHub, Inc. San Francisco, CA 94107',
  'Confirm your subscription. Reply STOP to 10086',
  'Sign in attempt from 192.168.1.1 at 12:30. Ref 88213',
  '登录提醒：您的账号于 2026年9月17日 在北京登录，如非本人操作请致电 95588',
  '',
];

for (const [text, expected] of codeCases) {
  test(`extracts ${expected} from ${JSON.stringify(text)}`, () => {
    assert.equal(extractCode(text), expected);
  });
}

for (const text of noCodeCases) {
  test(`extracts nothing from ${JSON.stringify(text)}`, () => {
    assert.equal(extractCode(text), null);
  });
}

test('extract mode defaults to local when unset', () => {
  assert.equal(resolveExtractMode(undefined), 'local');
  assert.equal(resolveExtractMode(''), 'local');
  assert.equal(resolveExtractMode('  '), 'local');
});

test('extract mode accepts explicit ai and local', () => {
  assert.equal(resolveExtractMode('ai'), 'ai');
  assert.equal(resolveExtractMode(' AI '), 'ai');
  assert.equal(resolveExtractMode('local'), 'local');
});

test('extract mode rejects unknown values', () => {
  assert.equal(resolveExtractMode('auto'), null);
  assert.equal(resolveExtractMode('regex'), null);
  assert.equal(resolveExtractMode(true), null);
});

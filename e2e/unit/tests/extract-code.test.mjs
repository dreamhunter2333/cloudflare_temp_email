import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractCode, joinSubjectAndBody } from '../../../worker/src/email/extract_code.ts';
import { ExtractMode, resolveExtractMode } from '../../../worker/src/email/extract_mode.ts';

// Messages marked "2FHey" are adapted from https://github.com/SoFriendly/2fhey tests (CC0-1.0).
const codeCases = [
  // Chinese
  ['您的验证码是 123456，5分钟内有效', '123456'],
  ['【某某】验证码：839201，请勿泄露', '839201'],
  ['验证码123456，10分钟内有效', '123456'],
  ['您的登录动态码为 4821', '4821'],
  ['123456 是您的验证码，请勿转发', '123456'],
  ['驗證碼：556677', '556677'],
  ['【必胜客】116352（动态验证码），请在30分钟内填写', '116352'], // 2FHey
  ['【APPLE】Apple ID代码为：724818。请勿与他人共享。', '724818'], // 2FHey
  ['【某视频】654321短信登录验证码，5分钟内有效', '654321'],
  ['校验码：１２３４５６，请勿告诉他人', '123456'],
  ['您的动态口令为 918273', '918273'],
  ['支付宝校验码 4096，付款金额 169.00 元', '4096'],
  // Japanese / Korean
  ['認証コードは 482913 です。', '482913'],
  ['ワンタイムパスコード「736251」を入力してください', '736251'],
  ['인증번호 [736251]를 입력해 주세요.', '736251'],
  ['인증 코드: 918273', '918273'],
  // Other languages
  ['Ваш код: 123456', '123456'],
  ['123-456 — код для входа', '123456'],
  ['Su código de verificación es 482913', '482913'],
  ['PayPal : 551234 est votre code de sécurité', '551234'],
  ["Code d'authentification : AAAA1A", 'AAAA1A'],
  ['Ihr Bestätigungscode ist: AB3C45', 'AB3C45'], // 2FHey
  ['קוד האימות שלך הוא 123456', '123456'], // 2FHey
  // English
  ['Your verification code is: 482913', '482913'],
  ['123456 is your Instagram code', '123456'],
  ['G-482913 is your Google verification code', '482913'],
  ['ABC123 is your verification code', 'ABC123'], // 2FHey
  ['Your code: 123-456', '123456'],
  ['Your one-time passcode is 12 34 56', '123456'],
  ['Your confirmation code is 8 4 9 2 0 1. Enter this to finish signing up.', '849201'],
  ['Your security verification code is: 7​4‌9‍1﻿8⁠3. Use it to complete sign-in.', '749183'],
  ['Here is your one-time verification passcode: K9X-4B2. Valid for 10 minutes.', 'K9X4B2'],
  ["Code is: RKJ-YP6 We'll NEVER call or text for this code.", 'RKJYP6'], // 2FHey
  ['Your code is\n\n  839201\n\nIt expires in 10 minutes', '839201'],
  ['Enter this code to sign in\n 591 204\n', '591204'],
  ['Please enter the code below:\nAB12CD\n', 'AB12CD'],
  ['Order #20391 shipped. Call 400-820-1234. Your login code: 7F3K9Q', '7F3K9Q'],
  ['Use 4821 to verify your account', '4821'],
  ['Please use SGD-123456 within 3 minutes to authorize this transaction.', '123456'], // 2FHey
  ['Please verify your email.\n\n706215\n\nThanks', '706215'],
  ['Please confirm your email address\n\n706215\n', '706215'],
  ['Email verification\n\n582013\n\nThis code expires soon.', '582013'],
  ['请验证您的邮箱\n\n662817\n', '662817'],
  ['706215\n\nPlease verify your email address to continue.', '706215'],
  ['[ 706215 ]\nPlease confirm your account', '706215'],
  ['Hello,\n\nUse the following code to log in:\n\n  274019\n\nIf you did not request this, ignore.', '274019'],
  ['Your Microsoft account security code\nSecurity code: 3721\nAccount: a***@x.com', '3721'],
  ['Here is your GitHub launch code: 12345678\n\n© 2026 GitHub, Inc. San Francisco, CA 94107', '12345678'],
  ['Your PIN is 4821', '4821'],
  ['Your OTP for payment of Rs 5000 is 482913', '482913'], // 2FHey
  ['OTP for txn of Rs 5000.00 is 482913', '482913'],
  ['Your verification code for order 99887766 is 123456', '123456'],
  ['This output contains a captcha with non-alphanumeric characters: ABCD123', 'ABCD123'], // 2FHey
  ['Login code: 12345. Do not give this code to anyone', '12345'],
  ['Your code for mark.kennedy.5561@example.com is 902113', '902113'],
  ['123456 is OTP for your fund transfer, valid for 5 mins.', '123456'],
  ['123456 ist dein Amazon-Einmalkennwort. Teile es nicht mit anderen Personen.', '123456'],
  ['222222 ist der Google Pay Aktivierungscode für deine Karte.', '222222'],
  ['Il tuo codice di sicurezza è: 123456', '123456'],
  ['Le code à saisir pour votre achat de 200,00 EUR est 12345678.', '12345678'],
  ['[Binance TR] Doğrulama Kodu: 123456. Lütfen paylaşmayın', '123456'],
  ['【銀行轉帳】OTP密碼1234567，密碼勿告知他人', '1234567'],
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
  'code: 4155552671', // 2FHey
  'Your verification code is 1234.56',
  'Your verification code is EXPIRED',
  'Do not share this code. Code: NEVER',
  'Tracking code: 58291034',
  'Order code: 582910',
  'Reference code: 48291',
  'Voucher code: 123456',
  'Sign in to your account\n\n90210\n',
  'Please verify. Account ID:\n884211\n',
  'Order confirmation\n123456',
  '706215\n\nThanks for your order',
  'Please verify your email. Account ID:\n\n884211\n',
  'Order confirmation\n\nOrder number\n582910\n',
  'Your payment is confirmed.\n\n482910\n',
  'Booking confirmed\n\n77120\n\nSee you soon',
  'Your purchase was verified\n\n558812\n',
  'Transaction authorized\n\n904411\n',
  'Ihre Bestellbestätigung\n\n448812\n',
  'Подтверждение заказа\n\n551203\n',
  '订单已确认\n\n772019\n',
  'Verify your email: https://example.com/verify?token=123456&id=998877',
  'Your footprint report for 2026: 58291 steps',
  'Welcome to our service. Enjoy a 30% discount with code SUMMER2026!',
  'Your order 5000 is the total, see the code of conduct',
  'We sent a code to your phone number ending 5678',
  'Your kod verification: see attached, amount 1,234 PLN',
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

test('subject and body are combined like the Worker does', () => {
  assert.equal(extractCode(joinSubjectAndBody('482913 is your Acme verification code', 'Hi, thanks for signing up.')), '482913');
  assert.equal(extractCode(joinSubjectAndBody(undefined, 'Your verification code: 551203')), '551203');
  assert.equal(extractCode(joinSubjectAndBody('Welcome', '')), null);
});

test('a very long subject cannot push the body code out of the analyzed text', () => {
  const text = joinSubjectAndBody('x'.repeat(30000), 'Your verification code: 123456');
  assert.equal(extractCode(text), '123456');
});

// Guards against catastrophic regex backtracking on large or hostile mails.
const hostileInputs = {
  spaces: ' '.repeat(200000) + 'x',
  newlines: '\n'.repeat(200000) + 'verify',
  keywordAndSpaces: ('code' + ' '.repeat(1000)).repeat(200),
  letters: 'a'.repeat(200000) + ' code',
  digits: '1'.repeat(200000),
  atSigns: 'a'.repeat(100000) + '@' + 'b.'.repeat(50000),
  hyphens: 'code: ' + 'abc-'.repeat(50000),
  cjk: '验证码的的的的的的'.repeat(20000),
};

for (const [name, text] of Object.entries(hostileInputs)) {
  test(`stays fast on hostile input: ${name}`, () => {
    const start = performance.now();
    extractCode(text);
    assert.ok(performance.now() - start < 500, `took ${performance.now() - start}ms`);
  });
}

test('extract mode defaults to local when unset', () => {
  assert.equal(resolveExtractMode(undefined), ExtractMode.Local);
  assert.equal(resolveExtractMode(''), ExtractMode.Local);
  assert.equal(resolveExtractMode('  '), ExtractMode.Local);
});

test('extract mode accepts explicit ai and local', () => {
  assert.equal(resolveExtractMode('ai'), ExtractMode.Ai);
  assert.equal(resolveExtractMode(' AI '), ExtractMode.Ai);
  assert.equal(resolveExtractMode('local'), ExtractMode.Local);
});

test('extract mode rejects unknown values', () => {
  assert.equal(resolveExtractMode('auto'), null);
  assert.equal(resolveExtractMode('regex'), null);
  assert.equal(resolveExtractMode(true), null);
});

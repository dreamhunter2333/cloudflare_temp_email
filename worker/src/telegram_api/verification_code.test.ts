import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSearchableMailText, extractVerificationCode, htmlToPlainText } from "./verification_code.ts";

describe("verification code extraction", () => {
    it("extracts a ChatGPT code from HTML-only mail", () => {
        const html = `<html><body><p>Your temporary ChatGPT login code is:</p><div style="font-size:32px">123456</div><p>This code expires in 10 minutes.</p></body></html>`;
        const body = buildSearchableMailText("Your temporary ChatGPT login code", "", html);

        assert.equal(extractVerificationCode(body), "123456");
    });

    it("extracts spaced and separated numeric codes", () => {
        const text = "您的验证码为 1 2 3-4_5.6，请勿泄露。";

        assert.equal(extractVerificationCode(text), "123456");
    });

    it("supports 4 and 8 digit verification codes", () => {
        assert.equal(extractVerificationCode("Login PIN: 0428. It expires soon."), "0428");
        assert.equal(extractVerificationCode("安全验证码：87654321，5分钟内有效"), "87654321");
    });

    it("prefers code-related context over unrelated numbers", () => {
        const text = "订单 987654 于 2026-05-04 创建。验证码是 135790，请在 10 分钟内输入。";

        assert.equal(extractVerificationCode(text), "135790");
    });

    it("converts HTML entities and basic tags to readable text", () => {
        const html = "<div>验证码：&#49;&#50;&#51;&#52;&#53;&#54;</div><br><span>请勿泄露&nbsp;code</span>";

        assert.match(htmlToPlainText(html), /验证码：123456/);
        assert.match(htmlToPlainText(html), /请勿泄露 code/);
    });
});

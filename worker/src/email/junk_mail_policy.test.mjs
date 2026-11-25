import assert from "node:assert/strict";
import test from "node:test";

import { isJunkMailByHeaders } from "./junk_mail_policy.ts";

const authenticationResultsHeader = (results) => [{
    key: "Authentication-Results",
    value: `mx.example; ${results}`,
}];

test("issue #1084: dmarc=none does not reject an otherwise passing message", () => {
    const headers = authenticationResultsHeader(
        "spf=pass smtp.mailfrom=sender.example; " +
        "dkim=pass header.d=sender.example; " +
        "dmarc=none; arc=pass"
    );

    assert.equal(
        isJunkMailByHeaders(
            headers,
            ["spf", "dkim", "dmarc"],
            ["spf"],
        ),
        false,
    );
});

for (const [method, result] of [
    ["spf", "none"],
    ["spf", "neutral"],
    ["dkim", "none"],
    ["dkim", "neutral"],
    ["dmarc", "none"],
    ["dmarc", "neutral"],
]) {
    test(`${method}=${result} is absent for JUNK_MAIL_CHECK_LIST`, () => {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`${method}=${result}`),
                [method],
                [],
            ),
            false,
        );
    });
}

for (const method of ["spf", "dkim", "dmarc"]) {
    test(`${method}=fail is junk when the method is checked`, () => {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`${method}=fail`),
                [method],
                [],
            ),
            true,
        );
    });
}

test("JUNK_MAIL_FORCE_PASS_LIST requires an explicit pass result", () => {
    for (const result of ["none", "neutral", "fail"]) {
        assert.equal(
            isJunkMailByHeaders(
                authenticationResultsHeader(`spf=${result}`),
                [],
                ["spf"],
            ),
            true,
        );
    }

    assert.equal(
        isJunkMailByHeaders(
            authenticationResultsHeader("spf=pass"),
            [],
            ["spf"],
        ),
        false,
    );
});

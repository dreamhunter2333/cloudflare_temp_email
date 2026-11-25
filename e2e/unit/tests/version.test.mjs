import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions } from '../../../worker/src/utils/version.ts';

for (const [left, right, expected] of [
  ['v0.0.9', 'v0.0.10', -1],
  ['v0.0.2', 'v0.0.10', -1],
  ['v0.0.10', 'v0.0.10', 0],
  ['0.0.10', 'v0.0.10', 0],
  ['v0.0.99', 'v0.1.0', -1],
  ['v0.9.99', 'v0.10.0', -1],
  ['v0.99.99', 'v1.0.0', -1],
  ['v9.99.99', 'v10.0.0', -1],
  ['v1.0.0', 'v0.0.2', 1],
  ['v0.1.0', 'v0.0.10', 1],
]) {
  test(`compare database versions: ${left} / ${right}`, () => {
    assert.equal(compareVersions(left, right), expected);
    assert.equal(compareVersions(right, left), expected === 0 ? 0 : -expected);
  });
}

for (const version of ['', 'unknown', 'v0.0', 'v0.0.1.2', 'v0.0.x', 'v-1.0.0', 'v0.0.10-beta', 'v9007199254740992.0.0']) {
  test(`reject invalid database version: ${JSON.stringify(version)}`, () => {
    assert.throws(() => compareVersions(version, 'v0.0.10'), /Invalid database version/);
    assert.throws(() => compareVersions('v0.0.10', version), /Invalid database version/);
  });
}

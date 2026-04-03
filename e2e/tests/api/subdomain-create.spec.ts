import { test, expect } from '@playwright/test';
import { TEST_DOMAIN, WORKER_URL, WORKER_URL_ENV_OFF, WORKER_URL_SUBDOMAIN } from '../../fixtures/test-helpers';

const SUBDOMAIN = `team.${TEST_DOMAIN}`;
const NESTED_SUBDOMAIN = `deep.team.${TEST_DOMAIN}`;
const MIXED_CASE_SUBDOMAIN = `TeAm.${TEST_DOMAIN.toUpperCase()}`;
const INVALID_LOOKALIKE_DOMAIN = `bad${TEST_DOMAIN}`;
const INVALID_EMPTY_PREFIX_DOMAIN = `.${TEST_DOMAIN}`;
const INVALID_EMPTY_LABEL_DOMAIN = `a..b.${TEST_DOMAIN}`;
const CREATE_ADDRESS_WORKER_URL = WORKER_URL_SUBDOMAIN || WORKER_URL;
let originalCreateAddressStoredEnabled: boolean | undefined;
let originalEnvOffStoredEnabled: boolean | undefined;

async function getAccountSettings(request: any, workerUrl: string) {
  const res = await request.get(`${workerUrl}/admin/account_settings`);
  expect(res.ok()).toBe(true);
  return await res.json();
}

async function saveSubdomainMatchSetting(
  request: any,
  workerUrl: string,
  enableSubdomainMatch: boolean
) {
  const current = await getAccountSettings(request, workerUrl);
  const res = await request.post(`${workerUrl}/admin/account_settings`, {
    data: {
      blockList: current.blockList || [],
      sendBlockList: current.sendBlockList || [],
      verifiedAddressList: current.verifiedAddressList || [],
      fromBlockList: current.fromBlockList || [],
      noLimitSendAddressList: current.noLimitSendAddressList || [],
      emailRuleSettings: current.emailRuleSettings || {},
      addressCreationSettings: {
        enableSubdomainMatch,
      },
    },
  });
  expect(res.ok()).toBe(true);
}

async function resetSubdomainMatchSetting(
  request: any,
  workerUrl: string
) {
  const res = await request.post(`${workerUrl}/admin/test/reset_address_creation_settings`);
  expect(res.ok()).toBe(true);
}

async function restoreSubdomainMatchSetting(
  request: any,
  workerUrl: string,
  originalValue: boolean | undefined
) {
  if (typeof originalValue === 'boolean') {
    await saveSubdomainMatchSetting(request, workerUrl, originalValue);
    return;
  }
  await resetSubdomainMatchSetting(request, workerUrl);
}

test.describe('Create Address Subdomain Match', () => {
  test.beforeAll(async ({ request }) => {
    const createAddressSettings = await getAccountSettings(request, CREATE_ADDRESS_WORKER_URL);
    originalCreateAddressStoredEnabled = createAddressSettings.addressCreationSubdomainMatchStatus?.storedEnabled;

    if (WORKER_URL_ENV_OFF) {
      const envOffSettings = await getAccountSettings(request, WORKER_URL_ENV_OFF);
      originalEnvOffStoredEnabled = envOffSettings.addressCreationSubdomainMatchStatus?.storedEnabled;
    }
  });

  test.afterEach(async ({ request }) => {
    await restoreSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, originalCreateAddressStoredEnabled);
    if (WORKER_URL_ENV_OFF) {
      await restoreSubdomainMatchSetting(request, WORKER_URL_ENV_OFF, originalEnvOffStoredEnabled);
    }
  });

  test('falls back to env value when subdomain setting is not persisted', async ({ request }) => {
    await resetSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL);

    const res = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `subenvfb${Date.now()}`, domain: SUBDOMAIN },
    });

    expect(res.ok()).toBe(false);
    expect(await res.text()).toContain('Invalid domain');
  });

  test('persisted false still keeps exact match only', async ({ request }) => {
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, false);

    const uniqueName = `subdomain-default-${Date.now()}`;
    const res = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: SUBDOMAIN },
    });

    expect(res.ok()).toBe(false);
    expect(await res.text()).toContain('Invalid domain');
  });

  test('admin switch enables suffix subdomain match for both admin and user create APIs', async ({ request }) => {
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, true);

    const adminName = `subdomain-admin-${Date.now()}`;
    const adminRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: adminName, domain: SUBDOMAIN },
    });
    expect(adminRes.ok()).toBe(true);
    const adminBody = await adminRes.json();
    expect(adminBody.address).toContain(`@${SUBDOMAIN}`);
    expect(adminBody.address_id).toBeGreaterThan(0);

    const userName = `subdomain-user-${Date.now()}`;
    const userRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/api/new_address`, {
      data: { name: userName, domain: NESTED_SUBDOMAIN },
    });
    expect(userRes.ok()).toBe(true);
    const userBody = await userRes.json();
    expect(userBody.address).toContain(`@${NESTED_SUBDOMAIN}`);
    expect(userBody.address_id).toBeGreaterThan(0);

    const mixedCaseRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `subcase${Date.now()}`, domain: MIXED_CASE_SUBDOMAIN },
    });
    expect(mixedCaseRes.ok()).toBe(true);
    const mixedCaseBody = await mixedCaseRes.json();
    expect(mixedCaseBody.address).toContain(`@${SUBDOMAIN}`);

    const invalidRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `subinvalid${Date.now()}`, domain: INVALID_LOOKALIKE_DOMAIN },
    });
    expect(invalidRes.ok()).toBe(false);
    expect(await invalidRes.text()).toContain('Invalid domain');

    const invalidEmptyPrefixRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `subempty${Date.now()}`, domain: INVALID_EMPTY_PREFIX_DOMAIN },
    });
    expect(invalidEmptyPrefixRes.ok()).toBe(false);
    expect(await invalidEmptyPrefixRes.text()).toContain('Invalid domain');

    const invalidEmptyLabelRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `sublabel${Date.now()}`, domain: INVALID_EMPTY_LABEL_DOMAIN },
    });
    expect(invalidEmptyLabelRes.ok()).toBe(false);
    expect(await invalidEmptyLabelRes.text()).toContain('Invalid domain');
  });

  test('env false works as hard kill switch even if admin setting is enabled', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF is not configured');

    await saveSubdomainMatchSetting(request, WORKER_URL_ENV_OFF, true);

    const res = await request.post(`${WORKER_URL_ENV_OFF}/admin/new_address`, {
      data: { name: `subdomain-env-off-${Date.now()}`, domain: SUBDOMAIN },
    });
    expect(res.ok()).toBe(false);
    expect(await res.text()).toContain('Invalid domain');
  });
});

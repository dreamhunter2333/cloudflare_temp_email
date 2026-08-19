import { test, expect } from '@playwright/test';
import { TEST_DOMAIN, WORKER_URL, WORKER_URL_ENV_OFF, WORKER_URL_SUBDOMAIN } from '../../fixtures/test-helpers';

const MANUAL_BASE_DOMAIN = 'manual.example.com';
const SUBDOMAIN = `team.${MANUAL_BASE_DOMAIN}`;
const NESTED_SUBDOMAIN = `deep.team.${MANUAL_BASE_DOMAIN}`;
const MIXED_CASE_SUBDOMAIN = `TeAm.${MANUAL_BASE_DOMAIN.toUpperCase()}`;
const INVALID_LOOKALIKE_DOMAIN = `bad${MANUAL_BASE_DOMAIN}`;
const INVALID_EMPTY_PREFIX_DOMAIN = `.${MANUAL_BASE_DOMAIN}`;
const INVALID_EMPTY_LABEL_DOMAIN = `a..b.${MANUAL_BASE_DOMAIN}`;
const INVALID_OVERLONG_DOMAIN = `${'a.'.repeat(119)}${MANUAL_BASE_DOMAIN}`;
const RANDOM_SUBDOMAIN = `team.${TEST_DOMAIN}`;
const CREATE_ADDRESS_WORKER_URL = WORKER_URL_SUBDOMAIN || WORKER_URL;
let originalCreateAddressStoredEnabled: boolean | undefined;
let originalEnvOffStoredEnabled: boolean | undefined;

async function getAccountSettings(request: any, workerUrl: string) {
  const res = await request.get(`${workerUrl}/admin/account_settings`);
  expect(res.ok()).toBe(true);
  return await res.json();
}

function buildAccountSettingsPayload(
  current: any,
  addressCreationSettings?: { enableSubdomainMatch?: boolean | null },
  overrides: Record<string, unknown> = {}
) {
  return {
    blockList: current.blockList || [],
    sendBlockList: current.sendBlockList || [],
    verifiedAddressList: current.verifiedAddressList || [],
    fromBlockList: current.fromBlockList || [],
    noLimitSendAddressList: current.noLimitSendAddressList || [],
    emailRuleSettings: current.emailRuleSettings || {},
    ...(typeof addressCreationSettings !== 'undefined'
      ? { addressCreationSettings }
      : {}),
    ...overrides,
  };
}

async function saveSubdomainMatchSetting(
  request: any,
  workerUrl: string,
  enableSubdomainMatch: boolean | null
) {
  const current = await getAccountSettings(request, workerUrl);
  const res = await request.post(`${workerUrl}/admin/account_settings`, {
    data: buildAccountSettingsPayload(current, {
      enableSubdomainMatch,
    }),
  });
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
  await saveSubdomainMatchSetting(request, workerUrl, null);
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

  test('admin can clear override and return to env fallback', async ({ request }) => {
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, true);
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, null);

    const settings = await getAccountSettings(request, CREATE_ADDRESS_WORKER_URL);
    expect(settings.addressCreationSubdomainMatchStatus?.storedEnabled).toBeUndefined();

    const res = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `subenvfb${Date.now()}`, domain: SUBDOMAIN },
    });

    expect(res.ok()).toBe(false);
    expect(await res.text()).toContain('Invalid domain');
  });

  test('invalid addressCreationSettings payload does not partially persist earlier settings', async ({ request }) => {
    const current = await getAccountSettings(request, CREATE_ADDRESS_WORKER_URL);
    const uniqueBlockedKeyword = `should-not-persist-${Date.now()}`;

    const res = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/account_settings`, {
      data: buildAccountSettingsPayload(
        current,
        { enableSubdomainMatch: 'invalid-value' as any },
        {
          blockList: [...(current.blockList || []), uniqueBlockedKeyword],
        }
      ),
    });

    expect(res.status()).toBe(400);

    const after = await getAccountSettings(request, CREATE_ADDRESS_WORKER_URL);
    expect(after.blockList || []).toEqual(current.blockList || []);
    expect(after.addressCreationSubdomainMatchStatus?.storedEnabled).toBe(
      current.addressCreationSubdomainMatchStatus?.storedEnabled
    );
  });

  test('random subdomain scope allows a manually entered subdomain', async ({ request }) => {
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, false);

    const uniqueName = `subdomain-default-${Date.now()}`;
    const res = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: uniqueName, domain: RANDOM_SUBDOMAIN },
    });

    expect(res.ok()).toBe(true);
    expect((await res.json()).address).toContain(`@${RANDOM_SUBDOMAIN}`);
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

    const invalidOverlongRes = await request.post(`${CREATE_ADDRESS_WORKER_URL}/admin/new_address`, {
      data: { name: `sublong${Date.now()}`, domain: INVALID_OVERLONG_DOMAIN },
    });
    expect(invalidOverlongRes.ok()).toBe(false);
    expect(await invalidOverlongRes.text()).toContain('Invalid domain');
  });

  test('deleted random subdomain address can be recreated manually', async ({ request }) => {
    await saveSubdomainMatchSetting(request, CREATE_ADDRESS_WORKER_URL, false);

    const name = `subreuse${Date.now()}`;
    const firstCreate = await request.post(`${CREATE_ADDRESS_WORKER_URL}/api/new_address`, {
      data: { name, domain: TEST_DOMAIN, enableRandomSubdomain: true },
    });
    expect(firstCreate.ok()).toBe(true);
    const firstAddress = await firstCreate.json();
    const generatedDomain = firstAddress.address.split('@')[1];
    expect(generatedDomain).not.toBe(TEST_DOMAIN);

    const firstDelete = await request.delete(`${CREATE_ADDRESS_WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${firstAddress.jwt}` },
    });
    expect(firstDelete.ok()).toBe(true);

    const secondCreate = await request.post(`${CREATE_ADDRESS_WORKER_URL}/api/new_address`, {
      data: { name, domain: generatedDomain },
    });
    expect(secondCreate.ok()).toBe(true);
    const secondAddress = await secondCreate.json();
    expect(secondAddress.address).toBe(firstAddress.address);

    const secondDelete = await request.delete(`${CREATE_ADDRESS_WORKER_URL}/api/delete_address`, {
      headers: { Authorization: `Bearer ${secondAddress.jwt}` },
    });
    expect(secondDelete.ok()).toBe(true);
  });

  test('env false works as hard kill switch even if admin setting is enabled', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF is not configured');

    await saveSubdomainMatchSetting(request, WORKER_URL_ENV_OFF, true);

    const res = await request.post(`${WORKER_URL_ENV_OFF}/admin/new_address`, {
      data: { name: `subdomain-env-off-${Date.now()}`, domain: RANDOM_SUBDOMAIN },
    });
    expect(res.ok()).toBe(false);
    expect(await res.text()).toContain('Invalid domain');
  });
});

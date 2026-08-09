import { test, expect, type APIRequestContext } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const listMails = async (request: APIRequestContext, address: string) => {
  const response = await request.get(`${WORKER_URL}/admin/mails`, {
    params: { address, limit: '200', offset: '0' },
  });
  expect(response.ok()).toBe(true);
  return response.json();
};

test.describe('Bounded cleanup', () => {
  test('cleans at most one batch and continues on the next run', async ({ request }) => {
    const address = `cleanup-batch-${Date.now()}@test.example.com`;

    const oldMailResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
      data: {
        address,
        raw: 'old cleanup mail',
        message_id: `<cleanup-old-${Date.now()}@test>`,
        age_days: 2,
        count: 100,
      },
    });
    expect(oldMailResponse.ok()).toBe(true);

    const extraOldMailResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
      data: {
        address,
        raw: 'old cleanup mail',
        message_id: `<cleanup-extra-old-${Date.now()}@test>`,
        age_days: 2,
      },
    });
    expect(extraOldMailResponse.ok()).toBe(true);

    const recentMailResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
      data: {
        address,
        raw: 'recent cleanup mail',
        message_id: `<cleanup-recent-${Date.now()}@test>`,
      },
    });
    expect(recentMailResponse.ok()).toBe(true);

    const firstCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'mails', cleanDays: 1 },
    });
    expect(firstCleanup.ok()).toBe(true);

    const afterFirstCleanup = await listMails(request, address);
    expect(afterFirstCleanup.count).toBe(2);
    expect(afterFirstCleanup.results.some((mail: any) => mail.raw === 'recent cleanup mail')).toBe(true);

    const secondCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'mails', cleanDays: 1 },
    });
    expect(secondCleanup.ok()).toBe(true);

    const afterSecondCleanup = await listMails(request, address);
    expect(afterSecondCleanup.count).toBe(1);
    expect(afterSecondCleanup.results[0].raw).toBe('recent cleanup mail');

    await request.delete(`${WORKER_URL}/admin/mails/${afterSecondCleanup.results[0].id}`);
  });

  test('deletes one address snapshot and its related data', async ({ request }) => {
    const oldAddress = await createTestAddress(request, 'cleanup-old-address');
    const recentAddress = await createTestAddress(request, 'cleanup-recent-address');

    try {
      const seedResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
        data: {
          address: oldAddress.address,
          raw: 'address cleanup mail',
          message_id: `<cleanup-address-${Date.now()}@test>`,
        },
      });
      expect(seedResponse.ok()).toBe(true);

      const backdateResponse = await request.post(`${WORKER_URL}/admin/test/backdate_address`, {
        data: { id: oldAddress.address_id, age_days: 2 },
      });
      expect(backdateResponse.ok()).toBe(true);

      const cleanupResponse = await request.post(`${WORKER_URL}/admin/cleanup`, {
        data: { cleanType: 'addressCreated', cleanDays: 1 },
      });
      expect(cleanupResponse.ok()).toBe(true);

      const oldAddressResponse = await request.get(`${WORKER_URL}/admin/address`, {
        params: { query: oldAddress.address, limit: '20', offset: '0' },
      });
      expect(oldAddressResponse.ok()).toBe(true);
      expect((await oldAddressResponse.json()).count).toBe(0);
      expect((await listMails(request, oldAddress.address)).count).toBe(0);

      const recentAddressResponse = await request.get(`${WORKER_URL}/admin/address`, {
        params: { query: recentAddress.address, limit: '20', offset: '0' },
      });
      expect(recentAddressResponse.ok()).toBe(true);
      expect((await recentAddressResponse.json()).count).toBe(1);
    } finally {
      await deleteAddress(request, recentAddress.jwt);
    }
  });
});

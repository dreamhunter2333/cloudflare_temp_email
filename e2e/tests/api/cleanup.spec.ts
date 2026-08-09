import { test, expect, type APIRequestContext } from '@playwright/test';
import { WORKER_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';

const listMails = async (request: APIRequestContext, address: string) => {
  const response = await request.get(`${WORKER_URL}/admin/mails`, {
    params: { address, limit: '100', offset: '0' },
  });
  expect(response.ok()).toBe(true);
  return response.json();
};

test.describe('Bounded cleanup', () => {
  test('cleans at most one batch and continues on the next run', async ({ request }) => {
    const address = `cleanup-batch-${Date.now()}@test.example.com`;
    const seedResponses = await Promise.all(Array.from({ length: 11 }, (_, index) =>
      request.post(`${WORKER_URL}/admin/test/seed_mail`, {
        data: {
          address,
          raw: 'old cleanup mail',
          message_id: `<cleanup-old-${Date.now()}-${index}@test>`,
        },
      })
    ));
    expect(seedResponses.every((response) => response.ok())).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const firstCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'mails', cleanDays: 0 },
    });
    expect(firstCleanup.ok()).toBe(true);

    const afterFirstCleanup = await listMails(request, address);
    expect(afterFirstCleanup.count).toBe(1);

    const secondCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'mails', cleanDays: 0 },
    });
    expect(secondCleanup.ok()).toBe(true);

    const afterSecondCleanup = await listMails(request, address);
    expect(afterSecondCleanup.count).toBe(0);

    const recentMailResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
      data: {
        address,
        raw: 'recent cleanup mail',
        message_id: `<cleanup-recent-${Date.now()}@test>`,
      },
    });
    expect(recentMailResponse.ok()).toBe(true);

    const recentCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'mails', cleanDays: 1 },
    });
    expect(recentCleanup.ok()).toBe(true);

    const recentMails = await listMails(request, address);
    expect(recentMails.count).toBe(1);
    expect(recentMails.results[0].raw).toBe('recent cleanup mail');
    await request.delete(`${WORKER_URL}/admin/mails/${recentMails.results[0].id}`);
  });

  test('deletes one address batch and its related data', async ({ request }) => {
    const oldAddress = await createTestAddress(request, 'cleanup-old');

    const seedResponse = await request.post(`${WORKER_URL}/admin/test/seed_mail`, {
      data: {
        address: oldAddress.address,
        raw: 'address cleanup mail',
        message_id: `<cleanup-address-${Date.now()}@test>`,
      },
    });
    expect(seedResponse.ok()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const cleanupResponse = await request.post(`${WORKER_URL}/admin/cleanup`, {
      data: { cleanType: 'addressCreated', cleanDays: 0 },
    });
    expect(cleanupResponse.ok()).toBe(true);

    const oldAddressResponse = await request.get(`${WORKER_URL}/admin/address`, {
      params: { query: oldAddress.address, limit: '20', offset: '0' },
    });
    expect(oldAddressResponse.ok()).toBe(true);
    expect((await oldAddressResponse.json()).count).toBe(0);
    expect((await listMails(request, oldAddress.address)).count).toBe(0);

    const recentAddress = await createTestAddress(request, 'cleanup-recent');
    try {
      const recentCleanup = await request.post(`${WORKER_URL}/admin/cleanup`, {
        data: { cleanType: 'addressCreated', cleanDays: 1 },
      });
      expect(recentCleanup.ok()).toBe(true);

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

import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN, createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

test.describe('Mail Deletion', () => {
  test('delete a single mail by ID', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'del-single');

    // Seed 3 emails
    for (let i = 1; i <= 3; i++) {
      await seedTestMail(request, address, { subject: `Mail ${i}` });
    }

    // List mails — should have 3
    const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(listRes.ok()).toBe(true);
    const { results } = await listRes.json();
    expect(results).toHaveLength(3);

    // Delete the second mail
    const targetId = results[1].id;
    const delRes = await request.delete(`${WORKER_URL}/api/mails/${targetId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(delRes.ok()).toBe(true);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    // List again — should have 2, and the deleted ID should be gone
    const afterRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const after = await afterRes.json();
    expect(after.results).toHaveLength(2);
    expect(after.results.every((m: any) => m.id !== targetId)).toBe(true);

    await deleteAddress(request, jwt);
  });

  test('clear entire inbox', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'del-clear');

    // Seed 3 emails
    for (let i = 1; i <= 3; i++) {
      await seedTestMail(request, address, { subject: `Mail ${i}` });
    }

    // Verify 3 mails exist
    const listRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const { results } = await listRes.json();
    expect(results).toHaveLength(3);

    // Clear inbox
    const clearRes = await request.delete(`${WORKER_URL}/api/clear_inbox`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(clearRes.ok()).toBe(true);
    const clearBody = await clearRes.json();
    expect(clearBody.success).toBe(true);

    // Verify inbox is empty
    const afterRes = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const after = await afterRes.json();
    expect(after.results).toHaveLength(0);

    await deleteAddress(request, jwt);
  });
});

import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  hashPassword,
  onMailpitMessage,
} from '../../fixtures/test-helpers';

async function createUser(request: APIRequestContext) {
  const email = `user-send-${Date.now()}@test.example.com`;
  const password = hashPassword('test-password-123');
  const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
    data: { email, password },
  });
  expect(registerRes.ok()).toBe(true);

  const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBe(true);
  const { jwt } = await loginRes.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { jwt, userId: payload.user_id as number };
}

async function bindAddress(
  request: APIRequestContext,
  userJwt: string,
  addressJwt: string,
) {
  const response = await request.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: {
      Authorization: `Bearer ${addressJwt}`,
      'x-user-token': userJwt,
    },
  });
  expect(response.ok()).toBe(true);
}

test.describe('User send mail API', () => {
  test('sends and manages sent items for a bound address only', async ({ request }) => {
    const addresses: Awaited<ReturnType<typeof createTestAddress>>[] = [];
    let userId: number | undefined;
    let originalUserSettings: Record<string, unknown> | undefined;

    try {
      const settingsRes = await request.get(`${WORKER_URL}/admin/user_settings`);
      expect(settingsRes.ok()).toBe(true);
      originalUserSettings = await settingsRes.json();
      const enableUserRes = await request.post(`${WORKER_URL}/admin/user_settings`, {
        data: {
          ...originalUserSettings,
          enable: true,
          enableMailVerify: false,
          maxAddressCount: 0,
        },
      });
      expect(enableUserRes.ok()).toBe(true);

      const user = await createUser(request);
      userId = user.userId;
      const bound = await createTestAddress(request, 'user-send-bound-');
      const accessRequest = await createTestAddress(request, 'user-send-access-');
      const outsider = await createTestAddress(request, 'user-send-outsider-');
      addresses.push(bound, accessRequest, outsider);
      await bindAddress(request, user.jwt, bound.jwt);
      await bindAddress(request, user.jwt, accessRequest.jwt);

      const outsiderSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${outsider.address_id}/settings`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderSettingsRes.status()).toBe(400);

      const requestAccessRes = await request.post(
        `${WORKER_URL}/user_api/address/${accessRequest.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(requestAccessRes.ok()).toBe(true);

      const addressSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${bound.address_id}/settings`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(addressSettingsRes.ok()).toBe(true);
      const addressSettings = await addressSettingsRes.json();
      expect(addressSettings.address).toBe(bound.address);
      expect(addressSettings.send_balance).toBe(10);

      await deleteAllMailpitMessages(request);
      const subject = `User API send ${Date.now()}`;
      const listener = onMailpitMessage((mail) => mail.Subject === subject);
      await listener.ready;

      const sendRes = await request.post(
        `${WORKER_URL}/user_api/address/${bound.address_id}/send_mail`,
        {
          headers: { 'x-user-token': user.jwt },
          data: {
            from_name: 'User Sender',
            from_mail: outsider.address,
            to_name: 'Recipient',
            to_mail: 'recipient@test.example.com',
            subject,
            content: 'Sent through the user API',
            is_html: false,
          },
        },
      );
      expect(sendRes.ok()).toBe(true);
      const delivered = await listener.message;
      expect(delivered.From.Address).toBe(bound.address);

      const outsiderSubject = `Outsider send ${Date.now()}`;
      const outsiderSendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${outsider.jwt}` },
        data: {
          to_mail: 'recipient@test.example.com',
          subject: outsiderSubject,
          content: 'This sent item must remain inaccessible to the user',
          is_html: false,
        },
      });
      expect(outsiderSendRes.ok()).toBe(true);
      const outsiderAddressSendboxRes = await request.get(
        `${WORKER_URL}/api/sendbox?limit=20&offset=0`,
        { headers: { Authorization: `Bearer ${outsider.jwt}` } },
      );
      const outsiderAddressSendbox = await outsiderAddressSendboxRes.json();
      const outsiderMail = outsiderAddressSendbox.results.find((item: { raw: string }) => (
        JSON.parse(item.raw).subject === outsiderSubject
      ));
      expect(outsiderMail).toBeTruthy();

      const unauthorizedDeleteRes = await request.delete(
        `${WORKER_URL}/user_api/sendbox/${outsiderMail.id}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(unauthorizedDeleteRes.ok()).toBe(true);
      const outsiderSendboxAfterDeleteRes = await request.get(
        `${WORKER_URL}/api/sendbox?limit=20&offset=0`,
        { headers: { Authorization: `Bearer ${outsider.jwt}` } },
      );
      expect((await outsiderSendboxAfterDeleteRes.json()).count).toBe(1);

      const updatedSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${bound.address_id}/settings`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect((await updatedSettingsRes.json()).send_balance).toBe(9);

      const sendboxRes = await request.get(
        `${WORKER_URL}/user_api/address/${bound.address_id}/sendbox?limit=20&offset=0`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(sendboxRes.ok()).toBe(true);
      const sendbox = await sendboxRes.json();
      expect(sendbox.count).toBe(1);
      expect(sendbox.results).toHaveLength(1);
      expect(JSON.parse(sendbox.results[0].raw).subject).toBe(subject);

      const userSendboxRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(userSendboxRes.ok()).toBe(true);
      const userSendbox = await userSendboxRes.json();
      expect(userSendbox.count).toBe(1);
      expect(userSendbox.results).toHaveLength(1);

      const filteredSendboxRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0&address=${encodeURIComponent(bound.address)}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(filteredSendboxRes.ok()).toBe(true);
      expect((await filteredSendboxRes.json()).count).toBe(1);

      const outsiderFilterRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0&address=${encodeURIComponent(outsider.address)}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderFilterRes.ok()).toBe(true);
      expect((await outsiderFilterRes.json()).count).toBe(0);

      const outsiderSendboxRes = await request.get(
        `${WORKER_URL}/user_api/address/${outsider.address_id}/sendbox?limit=20&offset=0`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderSendboxRes.status()).toBe(400);

      const deleteRes = await request.delete(
        `${WORKER_URL}/user_api/sendbox/${sendbox.results[0].id}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(deleteRes.ok()).toBe(true);

      const emptySendboxRes = await request.get(
        `${WORKER_URL}/user_api/address/${bound.address_id}/sendbox?limit=20&offset=0`,
        { headers: { 'x-user-token': user.jwt } },
      );
      const emptySendbox = await emptySendboxRes.json();
      expect(emptySendbox.count).toBe(0);
      expect(emptySendbox.results).toHaveLength(0);
    } finally {
      try {
        await Promise.allSettled(addresses.map((address) => deleteAddress(request, address.jwt)));
        if (userId !== undefined) {
          await request.delete(`${WORKER_URL}/admin/users/${userId}`);
        }
      } finally {
        if (originalUserSettings) {
          await request.post(`${WORKER_URL}/admin/user_settings`, {
            data: originalUserSettings,
          });
        }
      }
    }
  });
});

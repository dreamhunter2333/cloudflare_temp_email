import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  deleteAllMailpitMessages,
  getAddressSender,
  hashPassword,
  onMailpitMessage,
  updateAddressSender,
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
      const outsider = await createTestAddress(request, 'usr-outsider-');
      addresses.push(bound, accessRequest, outsider);
      await bindAddress(request, user.jwt, bound.jwt);
      await bindAddress(request, user.jwt, accessRequest.jwt);

      const invalidAddressSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/0/settings`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(invalidAddressSettingsRes.status()).toBe(400);

      const outsiderSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${outsider.address_id}/settings`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderSettingsRes.status()).toBe(400);

      const outsiderCredentialRes = await request.get(
        `${WORKER_URL}/user_api/bind_address_jwt/${outsider.address_id}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderCredentialRes.status()).toBe(400);

      const outsiderAccessRes = await request.post(
        `${WORKER_URL}/user_api/address/${outsider.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(outsiderAccessRes.status()).toBe(400);

      const outsiderUserSendRes = await request.post(
        `${WORKER_URL}/user_api/address/${outsider.address_id}/send_mail`,
        {
          headers: { 'x-user-token': user.jwt },
          data: {
            to_mail: 'recipient@test.example.com',
            subject: 'Forbidden user send',
            content: 'This message must not be sent',
            is_html: false,
          },
        },
      );
      expect(outsiderUserSendRes.status()).toBe(400);

      const unauthenticatedSendboxRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0`,
      );
      expect(unauthenticatedSendboxRes.status()).toBe(401);

      const requestAccessRes = await request.post(
        `${WORKER_URL}/user_api/address/${accessRequest.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(requestAccessRes.ok()).toBe(true);

      const accessSender = await getAddressSender(request, accessRequest.address);
      await updateAddressSender(request, {
        address: accessRequest.address,
        address_id: accessSender.id,
        balance: 0,
        enabled: true,
      });
      const duplicateAccessRes = await request.post(
        `${WORKER_URL}/user_api/address/${accessRequest.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(duplicateAccessRes.status()).toBe(400);
      expect(await duplicateAccessRes.text()).toContain('Already');

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

      const sender = await getAddressSender(request, bound.address);
      await updateAddressSender(request, {
        address: bound.address,
        address_id: sender.id,
        balance: 0,
        enabled: true,
      });
      const noBalanceRes = await request.post(
        `${WORKER_URL}/user_api/address/${bound.address_id}/send_mail`,
        {
          headers: { 'x-user-token': user.jwt },
          data: {
            to_mail: 'recipient@test.example.com',
            subject: 'No balance user send',
            content: 'This message must not be sent',
            is_html: false,
          },
        },
      );
      expect(noBalanceRes.status()).toBe(400);
      expect(await noBalanceRes.text()).toContain('No balance');

      const userSendboxRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(userSendboxRes.ok()).toBe(true);
      const userSendbox = await userSendboxRes.json();
      expect(userSendbox.count).toBe(1);
      expect(userSendbox.results).toHaveLength(1);
      expect(JSON.parse(userSendbox.results[0].raw).subject).toBe(subject);

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

      const deleteRes = await request.delete(
        `${WORKER_URL}/user_api/sendbox/${userSendbox.results[0].id}`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(deleteRes.ok()).toBe(true);

      const emptySendboxRes = await request.get(
        `${WORKER_URL}/user_api/sendbox?limit=20&offset=0`,
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

  test('applies unlimited balance from the user role access token', async ({ request }) => {
    const addresses: Awaited<ReturnType<typeof createTestAddress>>[] = [];
    const userIds: number[] = [];
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
      userIds.push(user.userId);
      const address = await createTestAddress(request, 'user-send-role-');
      addresses.push(address);
      await bindAddress(request, user.jwt, address.jwt);

      const updateRoleRes = await request.post(`${WORKER_URL}/admin/user_roles`, {
        data: { user_id: user.userId, role_text: 'case-role' },
      });
      expect(updateRoleRes.ok()).toBe(true);

      const accessRes = await request.post(
        `${WORKER_URL}/user_api/address/${address.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': user.jwt } },
      );
      expect(accessRes.ok()).toBe(true);
      const sender = await getAddressSender(request, address.address);
      await updateAddressSender(request, {
        address: address.address,
        address_id: sender.id,
        balance: 0,
        enabled: true,
      });

      const userSettingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
        headers: { 'x-user-token': user.jwt },
      });
      expect(userSettingsRes.ok()).toBe(true);
      const { access_token: accessToken } = await userSettingsRes.json();
      expect(accessToken).toBeTruthy();
      const userHeaders = {
        'x-user-token': user.jwt,
        'x-user-access-token': accessToken,
      };

      const addressSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${address.address_id}/settings`,
        { headers: userHeaders },
      );
      expect(addressSettingsRes.ok()).toBe(true);
      expect((await addressSettingsRes.json()).send_balance).toBe(99999);

      const sendRes = await request.post(
        `${WORKER_URL}/user_api/address/${address.address_id}/send_mail`,
        {
          headers: userHeaders,
          data: {
            to_mail: 'recipient@test.example.com',
            subject: `Unlimited role send ${Date.now()}`,
            content: 'Sent without consuming address balance',
            is_html: false,
          },
        },
      );
      expect(sendRes.ok()).toBe(true);
      expect((await getAddressSender(request, address.address)).balance).toBe(0);

      const otherUser = await createUser(request);
      userIds.push(otherUser.userId);
      const otherAddress = await createTestAddress(request, 'user-send-other-');
      addresses.push(otherAddress);
      await bindAddress(request, otherUser.jwt, otherAddress.jwt);
      const otherAccessRes = await request.post(
        `${WORKER_URL}/user_api/address/${otherAddress.address_id}/request_send_mail_access`,
        { headers: { 'x-user-token': otherUser.jwt } },
      );
      expect(otherAccessRes.ok()).toBe(true);
      const otherSender = await getAddressSender(request, otherAddress.address);
      await updateAddressSender(request, {
        address: otherAddress.address,
        address_id: otherSender.id,
        balance: 0,
        enabled: true,
      });

      const mixedHeaders = {
        'x-user-token': otherUser.jwt,
        'x-user-access-token': accessToken,
      };
      const otherSettingsRes = await request.get(
        `${WORKER_URL}/user_api/address/${otherAddress.address_id}/settings`,
        { headers: mixedHeaders },
      );
      expect(otherSettingsRes.ok()).toBe(true);
      expect((await otherSettingsRes.json()).send_balance).toBe(0);

      const otherSendRes = await request.post(
        `${WORKER_URL}/user_api/address/${otherAddress.address_id}/send_mail`,
        {
          headers: mixedHeaders,
          data: {
            to_mail: 'recipient@test.example.com',
            subject: `Mismatched role token ${Date.now()}`,
            content: 'This message must not be sent',
            is_html: false,
          },
        },
      );
      expect(otherSendRes.status()).toBe(400);
      expect(await otherSendRes.text()).toContain('No balance');
    } finally {
      await Promise.allSettled(addresses.map((address) => deleteAddress(request, address.jwt)));
      await Promise.allSettled(userIds.map((userId) => (
        request.delete(`${WORKER_URL}/admin/users/${userId}`)
      )));
      if (originalUserSettings) {
        await request.post(`${WORKER_URL}/admin/user_settings`, {
          data: originalUserSettings,
        });
      }
    }
  });

});

import { Context } from 'hono';
import { getBooleanValue } from '../utils';
import i18n from '../i18n';

export const resetBoundAddressPassword = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_ADDRESS_PASSWORD)) {
        return c.text(msgs.PasswordChangeDisabledMsg, 403);
    }
    const addressId = Number(c.req.param('address_id'));
    const userId = c.get('userPayload')?.user_id;
    if (!Number.isSafeInteger(addressId) || addressId <= 0 || !userId) {
        return c.text(msgs.InvalidAddressOrUserTokenMsg, 400);
    }
    const body = await c.req.json<{ new_password?: unknown }>().catch(() => null);
    if (typeof body?.new_password !== 'string' || !/^[a-f0-9]{64}$/.test(body.new_password)) {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    const result = await c.env.DB.prepare(
        `UPDATE address SET password = ?, updated_at = datetime('now')
         WHERE id = ? AND EXISTS (
             SELECT 1 FROM users_address ua JOIN users u ON u.id = ua.user_id
             WHERE ua.address_id = address.id AND ua.user_id = ?
         )`
    ).bind(body.new_password, addressId, userId).run();
    if (!result.success) return c.text(msgs.FailedUpdatePasswordMsg, 500);
    if (result.meta.changes !== 1) return c.text(msgs.AddressNotBindedMsg, 403);
    return c.json({ success: true });
};

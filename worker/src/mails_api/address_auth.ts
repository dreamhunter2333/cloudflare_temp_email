import { Context } from 'hono';
import i18n from '../i18n';
import { getBooleanValue, hashPassword } from '../utils';
import { Jwt } from 'hono/utils/jwt';

export default {
    // 修改地址密码
    changePassword: async (c: Context<HonoCustomType>) => {
        const { new_password } = await c.req.json();
        const msgs = i18n.getMessagesbyContext(c);
        const { address, address_id } = c.get("jwtPayload");

        // 检查功能是否启用
        if (!getBooleanValue(c.env.ENABLE_ADDRESS_PASSWORD)) {
            return c.text(msgs.PasswordChangeDisabledMsg, 403);
        }

        if (!new_password) {
            return c.text(msgs.NewPasswordRequiredMsg, 400);
        }

        if (!address || !address_id) {
            return c.text(msgs.InvalidAddressTokenMsg, 400);
        }

        // 更新密码
        const { success } = await c.env.DB.prepare(
            `UPDATE address SET password = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(new_password, address_id).run();

        if (!success) {
            return c.text(msgs.FailedUpdatePasswordMsg, 500);
        }

        return c.json({ success: true });
    },

    // 地址密码登录
    login: async (c: Context<HonoCustomType>) => {
        const { email, password, cf_token } = await c.req.json();
        const msgs = i18n.getMessagesbyContext(c);

        // 检查功能是否启用
        if (!getBooleanValue(c.env.ENABLE_ADDRESS_PASSWORD)) {
            return c.text(msgs.PasswordLoginDisabledMsg, 403);
        }

        if (!email || !password) {
            return c.text(msgs.EmailPasswordRequiredMsg, 400);
        }

        // 查找地址
        const address = await c.env.DB.prepare(
            `SELECT * FROM address WHERE name = ?`
        ).bind(email).first();

        if (!address) {
            return c.text(msgs.AddressNotFoundMsg, 404);
        }

        // 验证密码
        if (address.password !== password) {
            return c.text(msgs.InvalidEmailOrPasswordMsg, 401);
        }

        // 创建JWT
        const jwt = await Jwt.sign({
            address: address.name,
            address_id: address.id
        }, c.env.JWT_SECRET, "HS256");

        return c.json({
            jwt: jwt,
            address: address.name
        });
    }
};

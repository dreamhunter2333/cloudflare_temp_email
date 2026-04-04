# 删除邮箱地址 API

## 管理员删除地址 API

使用地址 ID 删除邮箱地址。该接口需要管理员鉴权，并会同时清理关联数据（收件、发件来源授权、用户绑定等）。

```bash
DELETE /admin/delete_address/:id
```

请求头：

- `x-admin-auth: <admin_password>`

返回示例：

```json
{ "success": true }
```

## 普通地址删除 API

使用地址 JWT 删除当前邮箱。该接口会清理关联数据（收件、发件、自动回复、sender 绑定、用户绑定、Telegram 绑定等）。

```bash
DELETE /api/delete_address
```

请求头：

- `Authorization: Bearer <address_jwt>`

说明：

- 需开启 `ENABLE_USER_DELETE_EMAIL = true`
- 地址凭证来自 `/api/new_address` 或 `/admin/new_address`

返回示例：

```json
{ "success": true }
```

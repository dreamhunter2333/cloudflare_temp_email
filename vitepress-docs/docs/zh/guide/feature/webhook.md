# 配置 webhook

> [!NOTE]
> 如果要使用 webhook，请先绑定 `KV` 并且 `worker` 变量配置 `ENABLE_WEBHOOK = true`
>
> 如果你想 webhook 的解析邮件能力更强，参考 [配置 worker 使用 wasm 解析邮件](/zh/guide/feature/mail_parser_wasm_worker)

## 前提条件

你需要自建一个 `webhook 服务` 或者 使用 `第三方平台`，这个服务需要能够接收 `POST` 请求，并且能够解析 `json` 数据。

本项目使用了 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher) 示例作为 webhook 服务。

- 可以使用 [msgpusher.com](https://msgpusher.com) 提供的服务
- 也可以自建 `message-pusher` 服务，参考 [songquanpeng/message-pusher](https://github.com/songquanpeng/message-pusher)

## admin 配置全局 webhook

![telegram](/feature/admin-mail-webhook.png)

## admin 允许邮箱使用 webhook

![telegram](/feature/admin-webhook-settings.png)

## 某个邮箱配置 webhook

![telegram](/feature/address-webhook.png)

## webhook 数据格式

要获取 url 需要配置 worker 的 `FRONTEND_URL` 为你的前端地址，或者你可以通过 `id` 自己拼接 url = `${FRONTEND_URL}?mail_id=${id}`

```json
{
    "id": "${id}",
    "url": "${url}",
    "from": "${from}",
    "to": "${to}",
    "subject": "${subject}",
    "raw": "${raw}",
    "parsedText": "${parsedText}",
    "parsedHtml": "${parsedHtml}",
}
```

# mail-parser-wasm-worker

> [!NOTE]
> 如果你使用了 webhook 转发，或者 telegram bot 接受邮件，但是邮件内容是乱码，或者无法解析，你对解析的需要更高的要求，可以使用这个功能。

## 修改代码

```bash
cd worker
pnpm add mail-parser-wasm-worker
```

编辑 `worker/src/common.ts`, 取消注释这段代码，使用 mail-parser-wasm-worker 来解析邮件

```ts
export const commonParseMail = async (raw_mail: string | undefined | null): Promise<{
    sender: string,
    subject: string,
    text: string,
    html: string
} | undefined> => {
    if (!raw_mail) {
        return undefined;
    }
    // 取消注释这段代码，使用 mail-parser-wasm-worker 来解析邮件 start
    // TODO: WASM parse email
    try {
        const { parse_message_wrapper } = await import('mail-parser-wasm-worker');

        const parsedEmail = parse_message_wrapper(raw_mail);
        return {
            sender: parsedEmail.sender || "",
            subject: parsedEmail.subject || "",
            text: parsedEmail.text || "",
            html: parsedEmail.body_html || "",
        };
    } catch (e) {
        console.error("Failed use mail-parser-wasm-worker to parse email", e);
    }
    // 取消注释这段代码，使用 mail-parser-wasm-worker 来解析邮件 end
    try {
        const { default: PostalMime } = await import('postal-mime');
        const parsedEmail = await PostalMime.parse(raw_mail);
        return {
            sender: parsedEmail.from ? `${parsedEmail.from.name} <${parsedEmail.from.address}>` : "",
            subject: parsedEmail.subject || "",
            text: parsedEmail.text || "",
            html: parsedEmail.html || "",
        };
    }
    catch (e) {
        console.error("Failed use PostalMime to parse email", e);
    }
    return undefined;
}
```

## 部署

```bash
cd worker
pnpm run deploy
```

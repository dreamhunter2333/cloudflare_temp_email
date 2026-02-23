# mail-parser-wasm-worker

> [!NOTE]
> 如果你使用了 webhook 转发，或者 telegram bot 接受邮件，但是邮件内容是乱码，或者无法解析，你对解析的需要更高的要求，可以使用这个功能。

## UI 部署

1. 下载 [worker-with-wasm-mail-parser.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker-with-wasm-mail-parser.zip)

2. 回到 `Overview`，找到刚刚创建的 worker，点击 `Edit Code`, 删除原来的文件，上传 `worker.js` 和 `wasm` 后缀的文件, 点击 `Deploy`

    > [!NOTE]
    > 上传需要先点击左侧菜单的 Explorer,
    > 在文件列表的窗口里点击鼠标右键，在右键菜单里找到 `Upload`,
    > 请参考下面的截图
    >
    > 参考: [issues156](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/156#issuecomment-2079453822)

    ![worker2](/ui_install/worker-2.png)
    ![worker-upload](/ui_install/worker-upload.png)

## CLI 部署

### 修改代码

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
            headers: parsedEmail.headers || [],
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

### 部署

```bash
cd worker
pnpm run deploy
```

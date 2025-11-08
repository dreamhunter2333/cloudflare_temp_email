# mail-parser-wasm-worker

> [!NOTE]
> If you are using webhook forwarding or telegram bot to receive emails, but the email content is garbled or cannot be parsed, and you have higher requirements for parsing, you can use this feature.

## UI Deployment

1. Download [worker-with-wasm-mail-parser.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker-with-wasm-mail-parser.zip)

2. Go back to `Overview`, find the worker you just created, click `Edit Code`, delete the original files, upload `worker.js` and files with `wasm` extension, click `Deploy`

    > [!NOTE]
    > To upload, first click Explorer in the left menu,
    > Right-click in the file list window and find `Upload` in the context menu,
    > Please refer to the screenshot below
    >
    > Reference: [issues156](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/156#issuecomment-2079453822)

    ![worker2](/ui_install/worker-2.png)
    ![worker-upload](/ui_install/worker-upload.png)

## CLI Deployment

### Modify Code

```bash
cd worker
pnpm add mail-parser-wasm-worker
```

Edit `worker/src/common.ts`, uncomment this code to use mail-parser-wasm-worker to parse emails

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
    // Uncomment this code to use mail-parser-wasm-worker to parse emails start
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
    // Uncomment this code to use mail-parser-wasm-worker to parse emails end
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

### Deploy

```bash
cd worker
pnpm run deploy
```

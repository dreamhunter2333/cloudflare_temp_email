# Enhancement via Another Worker

> The core capability of temporary email is email management. Other workers can enhance temporary email functionality, for example, auth-inbox AI can parse verification codes or activation links
> This feature only triggers other workers and executes after webhook
> [!NOTE]
> If you want to use worker enhancement, please create a worker that can be called via RPC in advance, details below
> References:
> - https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/
> - https://developers.cloudflare.com/workers/runtime-apis/rpc/
> - auth-inbox project: https://github.com/TooonyChen/AuthInbox

## Create Another Worker (using auth-inbox AI verification code parsing as an example)

### Transform Worker to Extend WorkerEntrypoint

A simple worker code that acts as a callee providing RPC method calls is as follows (the rpcEmail method is an example)
(Using the already modified project https://github.com/oneisall8955/AuthInbox-fork)

src/index.ts file
```js
import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
    DB: D1Database;
    // ...
}

export default class extends WorkerEntrypoint<Env> {
    async fetch(request: Request): Promise<Response> {
        console.log("Original fetch interface parameter is request,env,ctx");
        console.log("After modifying to WorkerEntrypoint style, there's only one parameter request, getting environment variables and context has slight changes");
        // Environment variable and context changes see:
        // https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#bindings-env
        // https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#lifecycle-methods-ctx
        const env: Env = this.env;
        const ctx: ExecutionContext = this.ctx;
        console.log("Subsequent logic remains unchanged");
        return new Response('ok', { status: 200 });
    }

    // Main functionality
    async email(message: ForwardableEmailMessage): Promise<void> {
        console.log("Original fetch interface parameter is message,env,ctx");
        console.log("After modifying to WorkerEntrypoint style, there's only one parameter message, getting environment variables and context is the same as fetch method");
        const env: Env = this.env;
        const ctx: ExecutionContext = this.ctx;
        console.log("After receiving email routing request, subsequent logic remains unchanged");
    }

    // Expose RPC interface to handle email requests from other workers
    async rpcEmail(requestBody: string): Promise<void> {
        console.log(`Received request from another worker (temporary email service cloudflare_temp_email), request body: ${requestBody}`);
        // requestBody is in JSON format, sent by temporary email service, format as follows
        // type RPCEmailMessage = {
        //     from: string | undefined | null,
        //     to: string | undefined | null,
        //     rawEmail: string | undefined | null,
        //     headers: Map<string, string>,
        // }
        // ... todo ...
    }
}
```

### Deploy Another Worker

After modification, or using auth-inbox as an example, deploy to Cloudflare Worker. See https://github.com/TooonyChen/AuthInbox, or use the already modified project https://github.com/oneisall8955/AuthInbox-fork

## Configure Temporary Email Service to Use Specified Worker Enhancement

## Bind Service

### Configure via wrangler.toml

```toml
[[services]]
binding = "AUTH_INBOX"
service = "auth-inbox"
```

Here `binding = "AUTH_INBOX"` can be customized to any string, `service = "auth-inbox"` is the name of the deployed worker that provides RPC interface calls.

### User Interface Configuration

In Settings - Bindings, add binding, select binding service.
Fill in the variable name with a custom name, can be any string, for example `AUTH_INBOX`.
Select the service created in the previous step for service binding, for example `auth-inbox`.

![another-worker-enhanced-01.png](/feature/another-worker-enhanced-01.png)

![another-worker-enhanced-02.png](/feature/another-worker-enhanced-02.png)

## Environment Variable Configuration

### Configure via wrangler.toml

```toml
ENABLE_ANOTHER_WORKER = true
ANOTHER_WORKER_LIST ="""
[
    {
        "binding":"AUTH_INBOX",
        "method":"rpcEmail",
        "keywords":[
            "验证码","激活码","激活链接","确认链接","验证邮箱","确认邮件","账号激活","邮件验证","账户确认","安全码","认证码","安全验证","登陆码","确认码","启用账户","激活账户","账号验证","注册确认",
            "account","activation","verify","verification","activate","confirmation","email","code","validate","registration","login","code","expire","confirm"
        ]
    }
]
"""
```

Environment variable explanation:
- ENABLE_ANOTHER_WORKER = true: Default is false, set to true to enable other workers to process emails
- ANOTHER_WORKER_LIST is a JSON array, each object contains 3 fields
    - binding: *Required, must match the binding = "XXX" specified in the services section*, in the example it's AUTH_INBOX
    - method: Optional, default is rpcEmail, refers to which RPC method of this worker to call for processing
    - keywords: Keyword array, case-insensitive. Used for filtering, if the *parsed email text* matches these keywords, this worker is triggered and the worker's `method` method is called

### User Interface Configuration

In Settings - Environment Variables, add environment variables
- ENABLE_ANOTHER_WORKER = true
- ANOTHER_WORKER_LIST is the JSON array string mentioned above, no further explanation needed, see above for detailed description
```json
[
    {
        "binding":"AUTH_INBOX",
        "method":"rpcEmail",
        "keywords":[
            "验证码","激活码","激活链接","确认链接","验证邮箱","确认邮件","账号激活","邮件验证","账户确认","安全码","认证码","安全验证","登陆码","确认码","启用账户","激活账户","账号验证","注册确认",
            "account","activation","verify","verification","activate","confirmation","email","code","validate","registration","login","code","expire","confirm"
        ]
    }
]
```

![another-worker-enhanced-03.png](/feature/another-worker-enhanced-03.png)

## Testing

Send an email to the temporary mailbox, observe the worker logs, or check the verification code on the panel provided by auth-inbox

![another-worker-enhanced-04.png](/feature/another-worker-enhanced-04.png)

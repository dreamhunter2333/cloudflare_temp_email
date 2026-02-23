# 通过其他 worker 增强

> 临时邮箱的核心能力在邮件的管理，通过其他 worker 可以增强临时邮箱的功能，例如通过 auth-inbox ai 能力解析验证码或激活链接  
> 该功能仅触发其他 worker ，在 webhook 后执行  
> [!NOTE]  
> 如果要使用 worker 增强，请提前创建可以 rpc 调用的 worker，具体下文详述  
> 参考：  
> - https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/  
> - https://developers.cloudflare.com/workers/runtime-apis/rpc/  
> - auth-inbox 项目：https://github.com/TooonyChen/AuthInbox

## 创建其他 worker（以 auth-inbox 项目ai解析验证码为例子）

### worker 改造为继承 WorkerEntrypoint

一个简单，作为被调用方，提供 rpc 方法调用的worker代码如下（rpcEmail 方法为样例）
（使用已经修改好的项目 https://github.com/oneisall8955/AuthInbox-fork）  

src/index.ts 文件
```js
import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
    DB: D1Database;
    // ...
}

export default class extends WorkerEntrypoint<Env> {
    async fetch(request: Request): Promise<Response> {
        console.log("原本fetch接口入参是request,env,ctx");
        console.log("修改为WorkerEntrypoint风格后，只有一个入参request，获取环境变量和上下文有小改动");
        // 环境变量及上下文改动详见：
        // https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#bindings-env
        // https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#lifecycle-methods-ctx
        const env: Env = this.env;
        const ctx: ExecutionContext = this.ctx;
        console.log("后续逻辑不变");
        return new Response('ok', { status: 200 });
    }

    // 主要功能
    async email(message: ForwardableEmailMessage): Promise<void> {
        console.log("原本fetch接口入参是message,env,ctx");
        console.log("修改为WorkerEntrypoint风格后，只有一个入参message，获取环境变量和上下文和fetch方法一样");
        const env: Env = this.env;
        const ctx: ExecutionContext = this.ctx;
        console.log("接受email routing请求后，后续逻辑不变");
    }

    // 暴露rpc接口，处理来自其他worker的邮件请求
    async rpcEmail(requestBody: string): Promise<void> {
        console.log(`接受其他worker（临时邮件服务cloudflare_temp_email）的请求，request body: ${requestBody}`);
        // requestBody json 格式，由临时邮件服务发送，格式如下
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

### 部署其他 worker

修改好或者使用 以auth-inbox 为例，部署到 cloudflare worker 上，详见 https://github.com/TooonyChen/AuthInbox ，或者使用已经修改好的项目 https://github.com/oneisall8955/AuthInbox-fork

## 配置临时邮件服务，使用指定其他 worker 增强

## 绑定服务

### 通过 wrangler.toml 配置

```toml
[[services]]
binding = "AUTH_INBOX"
service = "auth-inbox"
```

这里的 `binding = "AUTH_INBOX"` 可以自定义，可以是任何字符串，`service = "auth-inbox"` 是部署好的提供rpc接口调用的worker名称。

### 用户界面配置

在设置-绑定，添加绑定，选择绑定服务。  
变量名称填写自定义的名称，可以任意字符串 ，例如 `AUTH_INBOX`。  
服务绑定选择上一步创建好的服务，例如 `auth-inbox`。

![another-worker-enhanced-01.png](/feature/another-worker-enhanced-01.png)

![another-worker-enhanced-02.png](/feature/another-worker-enhanced-02.png)

## 环境变量配置

### 通过 wrangler.toml 配置

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

环境变量解释：
- ENABLE_ANOTHER_WORKER = true：默认为false，true则开启其他 worker 处理邮件
- ANOTHER_WORKER_LIST 是一个JOSN数组，每个对象包3个字段
    - binding: *必填，必须与services部分指定的 binding = "XXX" 保持一致*，例子中为 AUTH_INBOX
    - method: 可选，默认 rpcEmail，指的是调用这个 worker 的哪一个 rpc 方法处理
    - keywords: 关键词数组，忽略大小写。用于过滤，如果*解析后邮件文本*匹配到这些关键词，触发这个 worker，并且调用这个 worker 的 `method` 方法

### 用户界面配置

在设置-环境变量，添加环境变量
- ENABLE_ANOTHER_WORKER = true
- ANOTHER_WORKER_LIST 为上面提及的JSON数组字符串，不再复述，详细介绍看上文
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

## 测试

发送一个邮件到临时邮箱，观察worker日志到，或者到 auth-inbox 提供的面板上查看验证码

![another-worker-enhanced-04.png](/feature/another-worker-enhanced-04.png)

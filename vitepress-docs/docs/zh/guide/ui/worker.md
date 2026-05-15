# Cloudflare workers 后端

> [!warning] 注意
> `worker.dev` 域名在中国无法访问，请自定义域名

1. 点击 `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create worker](/ui_install/worker_home.png)

2. 选择 `Worker`，点击 `Create Worker`, 修改名称然后点击 `Deploy`

    ![worker1](/ui_install/worker-1.png)
    ![worker2](/ui_install/worker-2.png)

3. 回到 `Workers & Pages`，找到刚刚创建的 worker，点击 `Settings` -> `Runtime`, 修改 `Compatibility flags`, 手动输入增加 `nodejs_compat`, 兼容日期也需要大于图片中的日期。

    ![worker-runtime](/ui_install/worker-runtime.png)

    > [!IMPORTANT]
    > `nodejs_compat` 必须添加成功后再部署 `worker.js`。如果缺少该兼容标记，常见错误是 `No such module "path"`、`No such module "node:stream"`，前端也可能只显示 `Network Error`。

4. 下载 [worker.js](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker.js)

5. 回到 `Overview`，找到刚刚创建的 worker，点击 `Edit Code`, 删除原来的文件，上传 `worker.js`, 点击 `Deploy`

    > [!NOTE]
    > 上传需要先点击左侧菜单的 Explorer,
    > 在文件列表的窗口里点击鼠标右键，在右键菜单里找到 `Upload`,
    > 请参考下面的截图。不要在编辑器中手动创建 `\worker.js` 这类带反斜杠的路径；如果保存时报 `No file system handle registered (\worker.js)`，请回到 Explorer 文件列表右键上传根目录的 `worker.js`，然后再点击 `Deploy`。
    >
    > 参考: [issues156](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/156#issuecomment-2079453822)

    ![worker3](/ui_install/worker-3.png)

    ![worker-upload](/ui_install/worker-upload.png)

6. 点击 `Settings` -> `Variables and Secrets`, 如图所示添加变量

    ![worker-var](/ui_install/worker-var.png)

    > [!NOTE] 注意
    > 更多变量的配置请查看 [worker变量说明](/zh/guide/worker-vars)
    >
    > 注意字符串格式的变量的最外层的引号是不需要的
    >
    > 对于 `USER_ROLES` 请配置为此格式 `[{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"vip","prefix":"vip"},{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"admin","prefix":""}]`

    建议配置的变量列表

    | 变量名                     | 类型        | 说明                                       | 示例                                 |
    | -------------------------- | ----------- | ------------------------------------------ | ------------------------------------ |
    | `PREFIX`                   | 文本        | 新建邮箱名称默认前缀，不需要前缀可不配置   | `tmp`                                |
    | `DOMAINS`                  | JSON        | 用于临时邮箱的所有域名, 支持多个域名       | `["awsl.uk", "dreamhunter2333.xyz"]` |
    | `JWT_SECRET`               | 文本/Secret | 用于生成 jwt 的密钥, jwt 用于登录以及鉴权  | `xxx`                                |
    | `ADMIN_PASSWORDS`          | JSON        | admin 控制台密码, 不配置则不允许访问控制台 | `["123", "456"]`                     |
    | `ENABLE_USER_CREATE_EMAIL` | 文本/JSON   | 是否允许用户创建邮箱, 不配置则不允许       | `true`                               |
    | `ENABLE_USER_DELETE_EMAIL` | 文本/JSON   | 是否允许用户删除邮件, 不配置则不允许       | `true`                               |

7. 点击 `Settings` -> `Bindings`, 点击 `Add Binding`, 名称如图，选择刚刚创建的 D1 数据库，点击 `Add Binding`

    > [!NOTE] 重要
    > 注意此处 `D1 Database` 的绑定名称必须为 `DB`，必须是大写。绑定名写成 `db`、`DATABASE` 或其他值时，`/open_api/settings`、`/admin/*` 等接口会异常，前端常见表现是页面初始化报 `map` 错误或 `Network Error`。

    ![worker-bindings](/ui_install/worker-bindings.png)

    ![worker-d1-1](/ui_install/worker-d1-1.png)

    ![worker-d1-2](/ui_install/worker-d1-2.png)

8. 点击 `Settings` -> `Triggers`, 这里可以添加自己的域名，你也可以使用自动生成的 `*.workers.dev` 的域名。记录下这个域名，后面部署前端会用到。

    > [!NOTE]
    > 打开 `worker` 的 `url`，如果显示 `OK` 说明部署成功
    >
    > 打开 `/health_check`，如果显示 `OK` 说明部署成功
    >
    > 打开 `/open_api/settings`，如果返回 JSON，说明前端初始化依赖的公开配置接口可用。部署 Pages 前建议先确认这个地址正常。

    ![worker3](/ui_install/worker-3.png)

9. 如果你要启用注册用户功能，并需要发送邮件验证，则需要创建 `KV` 缓存, 不需要可跳过此步骤

    > [!NOTE] 重要
    > 如果你要启用注册用户功能，并需要发送邮件验证，则需要创建 `KV` 缓存, 不需要可跳过此步骤
    >
    > 注意此处 `KV` 的绑定名称必须为 `KV`

    点击 `Storage & Databases` -> `KV` -> `Create Namespace`, 如图，点击 `Create Namespace`

    ![worker-kv](/ui_install/worker-kv.png)

    ![worker-kv-0](/ui_install/worker-kv-0.png)

    然后点击 `Settings` -> `Bindings`, 点击 `Add Binding`, 名称如图，选择刚刚创建的 KV,点击 `Add Binding`

    ![worker-bindings](/ui_install/worker-bindings.png)

    ![worker-kv-1](/ui_install/worker-kv-1.png)

    ![worker-kv-2](/ui_install/worker-kv-2.png)

10. Telegram Bot 配置

    > [!NOTE]
    > 如果不需要 Telegram Bot, 可跳过此步骤

    请先创建一个 Telegram Bot，然后获取 `token`，将 `token` 添加到 `Variables and Secrets` 中, 变量名称: `TELEGRAM_BOT_TOKEN`

11. 如果你想要使用 admin 页面中的定时任务清理邮件，需要到 `Settings` -> `Trigger Events` -> `Cron Triggers` 中添加定时任务.

    > [!NOTE]
    > 选择 `cron` 表达式，输入 `0 0 * * *`（此表达式表示每天午夜运行），点击 `Add` 增加。请根据您的需求调整此表达式。
    >
    > 只在 admin 页面开启自动清理配置还不够，必须添加 Cron Trigger 后 Worker 的 `scheduled` 事件才会运行。D1 到达容量上限后会出现 `D1_ERROR: Exceeded maximum DB size`，新邮件无法继续写入，表现为“突然收不到邮件；删除几封后恢复”。

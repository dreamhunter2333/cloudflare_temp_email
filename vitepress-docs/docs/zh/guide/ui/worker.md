# Cloudflare workers 后端

1. 点击 `Workers & Pages` -> `Overview` -> `Create Application`

    ![create worker](/ui_install/worker_home.png)

2. 选择 `Worker`，点击 `Create Worker`, 修改名称然后点击 `Deploy`

    ![worker1](/ui_install/worker-1.png)

3. 回到 `Overview`，找到刚刚创建的 worker，点击 `Settings` -> `Runtime`, 修改 `Compatibility flags`, 增加 `nodejs_compat`

    ![worker-runtime](/ui_install/worker-runtime.png)

4. 下载 [worker.js](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker.js)

5. 回到 `Overview`，找到刚刚创建的 worker，点击 `Edit Code`, 删除原来的文件，上传 `worker.js`, 点击 `Deploy`

    > [!NOTE]
    > 上传需要先点击左侧菜单的 Explorer,
    > 在文件列表的窗口里点击鼠标右键，在右键菜单里找到 `Upload`,
    > 请参考下面的截图
    >
    > 参考: [issues156](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/156#issuecomment-2079453822)

    ![worker2](/ui_install/worker-2.png)
    ![worker-upload](/ui_install/worker-upload.png)

6. 点击 `Settings` -> `Variables`, 如图所示添加变量，参考 [修改 wrangler.toml 配置文件](/zh/guide/cli/worker.html#修改-wrangler-toml-配置文件) 中的 `[vars]` 部分

    > [!NOTE]
    > 注意字符串格式的变量的最外层的引号是不需要的
    >
    > - 对于 `USER_ROLES` 请配置为此格式 `[{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"vip","prefix":"vip"},{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"admin","prefix":""}]`

    ![worker-var](/ui_install/worker-var.png)

7. 以下是  `Settings` -> `Variables` 中必须配置的变量列表

    | 变量名                     | 说明                                             | 示例                                 |
    | -------------------------- | ------------------------------------------------ | ------------------------------------ |
    | `PREFIX`                   | 要处理的邮箱名称前缀，不需要后缀可配置为空字符串 | `tmp`                                |
    | `DOMAINS`                  | 你的域名, 支持多个域名                           | `["awsl.uk", "dreamhunter2333.xyz"]` |
    | `ADMIN_PASSWORDS`          | admin 控制台密码, 不配置则不允许访问控制台       | `["123", "456"]`                     |
    | `JWT_SECRET`               | 用于生成 jwt 的密钥, jwt 用于登录以及鉴权        | `xxx`                                |
    | `ENABLE_USER_CREATE_EMAIL` | 是否允许用户创建邮箱, 不配置则不允许             | `true`                               |
    | `ENABLE_USER_DELETE_EMAIL` | 是否允许用户删除邮箱, 不配置则不允许             | `true`                               |

8. 点击 `Settings` -> `Variables`, 下拉找到 `D1 Database`, 点击 `Add Binding`, 名称如图，选择刚刚创建的 D1 数据库，点击 `Deploy`

    > [!NOTE] 重要
    > 注意此处 `D1 Database` 的绑定名称必须为 `DB`

    ![worker-d1](/ui_install/worker-d1.png)

9. 点击 `Settings` -> `Trggers`, 这里可以添加自己的域名，你也可以使用自动生成的 `*.workers.dev` 的域名。记录下这个域名，后面部署前端会用到。

    > [!NOTE]
    > 打开 `worker` 的 `url`，如果显示 `OK` 说明部署成功
    >
    > 打开 `/health_check`，如果显示 `OK` 说明部署成功

    ![worker3](/ui_install/worker-3.png)

10. 如果你要启用注册用户功能，并需要发送邮件验证，则需要创建 `KV` 缓存, 不需要可跳过此步骤，点击 `Workers & Pages` -> `KV` -> `Create Namespace`, 如图，点击 `Create Namespace`，然后在 `Settings` -> `Variables`, 下拉找到 `KV`, 点击 `Add Binding`, 名称如图，选择刚刚创建的 `KV` 缓存，点击 `Deploy`

    > [!NOTE] 重要
    > 如果你要启用注册用户功能，并需要发送邮件验证，则需要创建 `KV` 缓存, 不需要可跳过此步骤
    >
    > 注意此处 `KV` 的绑定名称必须为 `KV`

    ![worker-kv](/ui_install/worker-kv.png)
    ![worker-kv-bind](/ui_install/worker-kv-bind.png)

11. Telegram Bot 配置

    > [!NOTE]
    > 如果不需要 Telegram Bot, 可跳过此步骤

    请先创建一个 Telegram Bot，然后获取 `token`，然后执行下面的命令，将 `token` 添加到 `Variables` 中, Name: `TELEGRAM_BOT_TOKEN`

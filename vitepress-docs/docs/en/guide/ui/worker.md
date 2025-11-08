# Cloudflare Workers Backend

> [!warning] Note
> The `worker.dev` domain is not accessible in China, please use a custom domain.

1. Click `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create worker](/ui_install/worker_home.png)

2. Select `Worker`, click `Create Worker`, modify the name and then click `Deploy`

    ![worker1](/ui_install/worker-1.png)
    ![worker2](/ui_install/worker-2.png)

3. Go back to `Workers & Pages`, find the worker you just created, click `Settings` -> `Runtime`, modify `Compatibility flags`, manually add `nodejs_compat`, and the compatibility date also needs to be later than the date shown in the image.

    ![worker-runtime](/ui_install/worker-runtime.png)

4. Download [worker.js](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker.js)

5. Go back to `Overview`, find the worker you just created, click `Edit Code`, delete the original file, upload `worker.js`, and click `Deploy`

    > [!NOTE]
    > To upload, first click Explorer in the left menu,
    > then right-click in the file list window and find `Upload` in the context menu,
    > please refer to the screenshots below
    >
    > Reference: [issues156](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/156#issuecomment-2079453822)

    ![worker3](/ui_install/worker-3.png)

    ![worker-upload](/ui_install/worker-upload.png)

6. Click `Settings` -> `Variables and Secrets`, add variables as shown in the image

    ![worker-var](/ui_install/worker-var.png)

    > [!NOTE] Note
    > For more variable configuration, please see [Worker Variables Documentation](/en/guide/worker-vars)
    >
    > Note that the outermost quotes are not needed for string format variables
    >
    > For `USER_ROLES`, please configure in this format: `[{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"vip","prefix":"vip"},{"domains":["awsl.uk","dreamhunter2333.xyz"],"role":"admin","prefix":""}]`

    Recommended variable list

    | Variable Name              | Type        | Description                                                            | Example                              |
    | -------------------------- | ----------- | ---------------------------------------------------------------------- | ------------------------------------ |
    | `PREFIX`                   | Text        | Default prefix for new email names, can be omitted if no prefix needed | `tmp`                                |
    | `DOMAINS`                  | JSON        | All domains for temporary email, supports multiple domains             | `["awsl.uk", "dreamhunter2333.xyz"]` |
    | `JWT_SECRET`               | Text/Secret | Secret for generating JWT, JWT is used for login and authentication    | `xxx`                                |
    | `ADMIN_PASSWORDS`          | JSON        | Admin console password, console access not allowed if not configured   | `["123", "456"]`                     |
    | `ENABLE_USER_CREATE_EMAIL` | Text/JSON   | Whether to allow users to create emails, not allowed if not configured | `true`                               |
    | `ENABLE_USER_DELETE_EMAIL` | Text/JSON   | Whether to allow users to delete emails, not allowed if not configured | `true`                               |

7. Click `Settings` -> `Bindings`, click `Add Binding`, enter the name as shown, select the D1 database you just created, and click `Add Binding`

    > [!NOTE] Important
    > Note that the binding name for `D1 Database` here must be `DB`

    ![worker-bindings](/ui_install/worker-bindings.png)

    ![worker-d1-1](/ui_install/worker-d1-1.png)

    ![worker-d1-2](/ui_install/worker-d1-2.png)

8. Click `Settings` -> `Triggers`, here you can add your own domain, or you can use the automatically generated `*.workers.dev` domain. Record this domain, as it will be needed when deploying the frontend later.

    > [!NOTE]
    > Open the `worker` `url`, if it displays `OK`, the deployment is successful
    >
    > Open `/health_check`, if it displays `OK`, the deployment is successful

    ![worker3](/ui_install/worker-3.png)

9. If you want to enable the user registration feature and need to send email verification, you need to create a `KV` cache. You can skip this step if not needed.

    > [!NOTE] Important
    > If you want to enable the user registration feature and need to send email verification, you need to create a `KV` cache. You can skip this step if not needed.
    >
    > Note that the binding name for `KV` here must be `KV`

    Click `Storage & Databases` -> `KV` -> `Create Namespace`, as shown in the image, click `Create Namespace`

    ![worker-kv](/ui_install/worker-kv.png)

    ![worker-kv-0](/ui_install/worker-kv-0.png)

    Then click `Settings` -> `Bindings`, click `Add Binding`, enter the name as shown, select the KV you just created, and click `Add Binding`

    ![worker-bindings](/ui_install/worker-bindings.png)

    ![worker-kv-1](/ui_install/worker-kv-1.png)

    ![worker-kv-2](/ui_install/worker-kv-2.png)

10. Telegram Bot Configuration

    > [!NOTE]
    > If you don't need Telegram Bot, you can skip this step

    Please first create a Telegram Bot, then get the `token`, add the `token` to `Variables and Secrets`, variable name: `TELEGRAM_BOT_TOKEN`

11. If you want to use the scheduled task to clean emails in the admin page, you need to add a scheduled task in `Settings` -> `Trigger Events` -> `Cron Triggers`.

    > [!NOTE]
    > Select `cron` expression, enter `0 0 * * *` (this expression means run daily at midnight), click `Add` to add. Please adjust this expression according to your needs.

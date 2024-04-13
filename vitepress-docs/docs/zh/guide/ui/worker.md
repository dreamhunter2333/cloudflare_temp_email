# Cloudflare workers 后端

1. 点击 `Workers & Pages` -> `Overview` -> `Create Application`

    ![create worker](/ui_install/worker_home.png)

2. 选择 `Worker`，点击 `Create Worker`, 修改名称然后点击 `Deploy`

    ![worker1](/ui_install/worker-1.png)

3. 下载 [worker.js](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/worker.js)

4. 回到 `Overview`，找到刚刚创建的 worker，点击 `Edit Code`, 上传 `worker.js`, 删除 `index.js`，然后重命名 `worker.js` 为 `index.js`, 点击 `Deploy`

    ![worker2](/ui_install/worker-2.png)

5. 点击 `Settings` -> `Trggers`, 这里可以添加自己的域名，你也可以使用自动生成的 `*.workers.dev` 的域名。能打开域名说明部署成功，记录下这个域名，后面部署前端会用到。

    ![worker3](/ui_install/worker-3.png)

6. 点击 `Settings` -> `Variables`, 如图所示添加变量，参考 README.md 中的 `wrangler.toml` 文件的 `vars` 部分

    ![worker-var](/ui_install/worker-var.png)

7. 点击 `Settings` -> `Variables`, 下拉找到 `D1 Database`, 点击 `Add Binding`, 名称如图，选择刚刚创建的 D1 数据库，点击 `Deploy`

    ![worker-d1](/ui_install/worker-d1.png)

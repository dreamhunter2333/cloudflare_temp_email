# Github Actions 部署如何配置自动更新

::: warning 注意
有问题请通过 `Github Issues` 反馈，感谢。
自动更新不会执行 D1 数据库的 sql 文件，当数据库 schema 变动时，需要手动执行。
:::

1. 打开仓库的 `Actions` 页面，找到 `Upstream Sync`，点击 `enable workflow` 启用 `workflow`
2. （可选）如需自动同步包含 `.github/workflows/*` 变更的提交，创建仅授权自己 Fork 仓库的 Fine-grained personal access token，授予 `Contents: Read and write` 和 `Workflows: Read and write`，并在 Fork 仓库的 `Settings → Secrets and variables → Actions` 中添加名为 `UPSTREAM_SYNC_TOKEN` 的 repository secret。请勿将 Token 写入配置文件或提交到仓库。
3. 未配置时使用默认 `GITHUB_TOKEN`，工作流已显式申请同步普通提交所需的 `contents: write` 权限。如果报错 `workflow scope or permission to merge`，表示 Token 无权同步 workflow 变更，请按上一步配置 `UPSTREAM_SYNC_TOKEN`，或到仓库主页点击 `Sync fork` 手动同步。
4. 修改 `Upstream Sync` 的 `schedule` 配置可自定义更新间隔，参考 [cron 表达式](https://crontab.guru/)

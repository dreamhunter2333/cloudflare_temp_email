# Github Actions 部署如何配置自动更新

::: warning 注意
有问题请通过 `Github Issues` 反馈，感谢。
自动更新不会执行 D1 数据库的 sql 文件，当数据库 schema 变动时，需要手动执行。
:::

1. 打开仓库的 `Actions` 页面，找到 `Upstream Sync`，点击 `enable workflow` 启用 `workflow`
2. 如果 `Upstream Sync` 运行失败，到仓库主页点击 `Sync` 手动同步即可
3. 修改 `Upstream Sync` 的 `schedule` 配置可自定义更新间隔，参考 [cron 表达式](https://crontab.guru/)

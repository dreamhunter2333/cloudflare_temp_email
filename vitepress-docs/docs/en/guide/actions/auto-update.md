# How to Configure Auto-Update for GitHub Actions Deployment

::: warning Notice
If you encounter any issues, please report them via `GitHub Issues`. Thank you.
Auto-update will not execute SQL files for the D1 database. When the database schema changes, you need to execute them manually.
:::

1. Open the `Actions` page of the repository, find `Upstream Sync`, and click `enable workflow` to enable the `workflow`
2. If `Upstream Sync` fails, go to the repository homepage and click `Sync` to synchronize manually
3. You can customize the update interval by modifying the `schedule` configuration in `Upstream Sync`, refer to [cron expressions](https://crontab.guru/)

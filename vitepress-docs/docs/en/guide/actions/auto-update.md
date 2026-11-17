# How to Configure Auto-Update for GitHub Actions Deployment

::: warning Notice
If you encounter any issues, please report them via `GitHub Issues`. Thank you.
Auto-update will not execute SQL files for the D1 database. When the database schema changes, you need to execute them manually.
:::

1. Open the `Actions` page of the repository, find `Upstream Sync`, and click `enable workflow` to enable the `workflow`
2. (Optional) To automatically sync commits that change `.github/workflows/*`, create a fine-grained personal access token scoped only to your fork with `Contents: Read and write` and `Workflows: Read and write`. Add it as a repository secret named `UPSTREAM_SYNC_TOKEN` under your fork's `Settings → Secrets and variables → Actions`. Do not put the token in configuration files or commit it to the repository.
3. When unset, the workflow uses the default `GITHUB_TOKEN` and explicitly requests `contents: write` to sync ordinary commits. If it reports `workflow scope or permission to merge`, the token cannot sync workflow changes. Configure `UPSTREAM_SYNC_TOKEN` as described above, or use `Sync fork` on the repository homepage to sync manually.
4. You can customize the update interval by modifying the `schedule` configuration in `Upstream Sync`, refer to [cron expressions](https://crontab.guru/)

# Release Notes Template

Release notes body 使用以下格式，内容从 CHANGELOG.md 的对应版本段落提取：

```markdown
## What's Changed

### Features

- feat: |模块| 描述
  - 设置对应环境变量开启。
  - 启用前执行对应迁移 SQL，或在已验证的 Admin 数据库页面升级；不使用此可选功能可跳过。
  - 简述启用后的行为。

### Bug Fixes

- fix: |模块| 描述

### Testing

- test: |模块| 描述

### Improvements

- style/refactor/perf/docs: |模块| 描述

<details>
<summary>English</summary>

### Features

- feat: |Module| Description
  - Set the corresponding environment variable to enable it.
  - Before enabling it, apply the migration SQL or use the verified Admin database-upgrade action; skip it if the optional feature is unused.
  - Briefly describe the enabled behavior.

<!-- Copy the remaining matching English changelog sections here. -->

</details>

### [更新或者部署网页不生效请如图勾选清理缓存](https://github.com/dreamhunter2333/cloudflare_temp_email/discussions/487)

<details>
<summary>PRs</summary>

* PR title by @author in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/NUMBER

</details>

**Full Changelog**: https://github.com/dreamhunter2333/cloudflare_temp_email/compare/vOLD...vNEW
```

## Notes

- Sections without entries should be omitted
- For features requiring migrations, use three concise sub-bullets under each feature: switch, database changes, functionality, without heading-like labels on the lines. Replace guidance with verified variables, release-tag-pinned SQL links and supported UI actions. Do not add a shared Database Changes section. Features without migrations do not need this format.
- Verify whether each migration is optional or mandatory from actual feature dependencies. Preserve any separate Breaking Changes entries and provide matching Chinese and English upgrade notes.
- PRs section uses `<details>` to collapse by default
- PRs are sorted by PR number ascending
- The cache clearing discussion link is always included
- Release title and tag use format `vX.Y.Z`

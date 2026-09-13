# Release Notes Template

Release notes body 使用以下格式，内容从 CHANGELOG.md 的对应版本段落提取：

```markdown
## What's Changed

### 数据库变更

- |功能名称| 说明受影响的表、字段或索引，以及对应迁移。对于已验证可选的迁移，明确写出“仅在使用此功能时需要执行；不使用此功能可跳过，后续启用前再执行”。基础功能必需的迁移应另行明确标注。按执行顺序链接到本次发布标签下的迁移文件；仅在验证支持后提供 Admin 数据库更新按钮作为替代方式。
- |数据影响| 根据 SQL 说明是否保留、改写或删除已有数据；提醒升级前备份、不要重复执行非幂等迁移，并区分新安装与已有数据库升级。

### Features

- feat: |模块| 描述

### Bug Fixes

- fix: |模块| 描述

### Testing

- test: |模块| 描述

### Improvements

- style/refactor/perf/docs: |模块| 描述

<details>
<summary>English</summary>

### Database Changes

- |Feature name| Describe affected tables, columns or indexes and the corresponding migration. For verified optional migrations, explicitly state: "Required only when using this feature; otherwise, you can skip it and apply it before enabling the feature later." Separately identify migrations required for normal operation. Link migrations at the release tag in execution order; mention the Admin database-update button only if verified to support them.
- |Data impact| Explain whether existing data is preserved, rewritten or deleted based on the SQL. Advise backing up, avoiding repeated non-idempotent migrations, and distinguish fresh installations from upgrades.

<!-- Copy the matching English changelog sections here. -->

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
- Database upgrade notes belong in standalone 数据库变更 / Database Changes sections before Features, not only in feature bullets or under Breaking Changes. Replace the template guidance with verified release-specific instructions; omit it when no database changes exist.
- Verify whether each migration is optional or mandatory from actual feature dependencies. Preserve any separate Breaking Changes entries and provide matching Chinese and English upgrade notes.
- PRs section uses `<details>` to collapse by default
- PRs are sorted by PR number ascending
- The cache clearing discussion link is always included
- Release title and tag use format `vX.Y.Z`

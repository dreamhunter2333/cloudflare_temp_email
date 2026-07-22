# Release Notes Template

Release notes body 使用以下格式，内容从 CHANGELOG.md 的对应版本段落提取：

```markdown
## What's Changed

### Features

- feat: |模块| 描述

### Bug Fixes

- fix: |模块| 描述

### Testing

- test: |模块| 描述

### Improvements

- style/refactor/perf/docs: |模块| 描述

### [更新或者部署网页不生效请如图勾选清理缓存](https://github.com/dreamhunter2333/cloudflare_temp_email/discussions/487)

<details>
<summary>PRs</summary>

* PR title by @author in https://github.com/dreamhunter2333/cloudflare_temp_email/pull/NUMBER

</details>

**Full Changelog**: https://github.com/dreamhunter2333/cloudflare_temp_email/compare/vOLD...vNEW
```

## Notes

- Sections without entries should be omitted
- PRs section uses `<details>` to collapse by default
- PRs are sorted by PR number ascending
- The cache clearing discussion link is always included
- Release title and tag use format `vX.Y.Z`

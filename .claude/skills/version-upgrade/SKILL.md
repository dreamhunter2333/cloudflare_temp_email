---
name: version-upgrade
description: 升级项目版本号。当用户要求升级版本、更新版本号、发布新版本时使用此 skill。支持 major（主版本）、minor（次版本）、patch（补丁版本）三种升级方式。
---

# Version Upgrade

升级 cloudflare_temp_email 项目版本号。

## 需要修改的文件

1. `frontend/package.json` - version 字段
2. `worker/package.json` - version 字段
3. `worker/src/constants.ts` - VERSION 常量（格式：`VERSION: 'v' + '1.4.0'`）
4. `pages/package.json` - version 字段
5. `vitepress-docs/package.json` - version 字段
6. `CHANGELOG.md` - 添加新版本占位符
7. `CHANGELOG_EN.md` - 添加新版本占位符（英文）

## 版本升级流程

1. 读取 `frontend/package.json` 获取当前版本号
2. 根据升级类型计算新版本号：
   - major: 1.3.0 → 2.0.0
   - minor: 1.3.0 → 1.4.0
   - patch: 1.3.0 → 1.3.1
3. 更新所有 package.json 文件中的 version 字段
4. 在 CHANGELOG.md 顶部添加新版本占位符
5. 在 CHANGELOG_EN.md 顶部添加新版本占位符

## CHANGELOG 格式

中文 (CHANGELOG.md) - 在 `## v{OLD_VERSION}(main)` 之前插入：
```markdown
## v{VERSION}(main)

### Features

### Bug Fixes

### Improvements

```

英文 (CHANGELOG_EN.md) - 同样格式。

## 提交信息格式

```
feat: upgrade version to v{VERSION}

- Update version number to {VERSION} in all package.json files
- Add v{VERSION} placeholder in CHANGELOG.md
```

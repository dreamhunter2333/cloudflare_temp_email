# 配置 Telegram Bot

## Bot

- 可设置白名单用户
- 点击`初始化`即可完成配置。
- 点击`查看状态`，可以查看当前配置的状态。

![telegram](/feature/telegram.png)

## Mini App

```bash
cd frontend
pnpm install
cp .env.example .env.prod
# --project-name 可以单独为 mini app 创建一个 pages, 你也可以公用一个 pages，但是可能遇到 js 加载不了的问题
pnpm run deploy:telegram --project-name=<你的项目名称>
```

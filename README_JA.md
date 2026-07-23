<!-- markdownlint-disable-file MD033 MD045 -->
# Cloudflare 一時メール - 無料で構築できる一時メールサービス

<p align="center">
  <a href="https://temp-mail-docs.awsl.uk" target="_blank">
    <img alt="docs" src="https://img.shields.io/badge/docs-grey?logo=vitepress">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest" target="_blank">
    <img src="https://img.shields.io/github/v/release/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/LICENSE" target="_blank">
    <img alt="MIT License" src="https://img.shields.io/github/license/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email/graphs/contributors" target="_blank">
   <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="">
    <img alt="GitHub top language" src="https://img.shields.io/github/languages/top/dreamhunter2333/cloudflare_temp_email">
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/dreamhunter2333/cloudflare_temp_email">
  </a>
</p>

<p align="center">
  <a href="https://hellogithub.com/repository/2ccc64bb1ba346b480625f584aa19eb1" target="_blank">
    <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=2ccc64bb1ba346b480625f584aa19eb1&claim_uid=FxNypXK7UQ9OECT" alt="Featured｜HelloGitHub" height="30"/>
  </a>
</p>

<p align="center">
  <a href="README.md">中文文档</a> |
  <a href="README_EN.md">English Document</a> |
  <a href="README_JA.md">日本語ドキュメント</a>
</p>

> 本プロジェクトは学習および個人利用のみを目的としています。違法行為には使用しないでください。使用した場合、その結果については利用者自身が責任を負うものとします。

**機能の充実した一時メールサービスです！**

- **完全無料** - Cloudflare の無料サービス上に構築され、運用コストはかかりません
- **高性能** - Rust WASM によるメール解析で極めて高速に応答します
- **モダンな UI** - 多言語対応のレスポンシブデザインで、簡単に操作できます
- **アドレスパスワード** - メールアドレスごとに個別のパスワードを設定し、セキュリティを強化できます
- **Agent フレンドリー** - AI agent がメールボックスを利用できる組み込みの [`skill`](skills/cf-temp-mail-agent-mail/SKILL.md) を提供します
- **モバイル管理** - Android の管理画面とメールボックス管理に対応したコミュニティクライアント [CloudMail](https://github.com/Lur1N77777/CloudMail) を利用できます

## デプロイドキュメント - クイックスタート

[ドキュメント](https://temp-mail-docs.awsl.uk) | [GitHub Actions デプロイガイド](https://temp-mail-docs.awsl.uk/en/guide/actions/github-action.html)

<a href="https://temp-mail-docs.awsl.uk/en/guide/actions/github-action.html">
  <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" height="32">
</a>

## 変更履歴

最新の更新内容については [CHANGELOG](CHANGELOG.md) を参照してください。

## ライブデモ

今すぐ試す → [https://mail.awsl.uk/](https://mail.awsl.uk/)

<details>
<summary>サービス稼働状況（クリックして展開／折りたたみ）</summary>

|                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Backend](https://temp-email-api.awsl.uk/) | [![Deploy Backend Production](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/backend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/10/status) ![](https://uptime.aks.awsl.icu/api/badge/10/uptime) ![](https://uptime.aks.awsl.icu/api/badge/10/ping) ![](https://uptime.aks.awsl.icu/api/badge/10/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/10/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/10/response) |
| [Frontend](https://mail.awsl.uk/)          | [![Deploy Frontend](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml/badge.svg)](https://github.com/dreamhunter2333/cloudflare_temp_email/actions/workflows/frontend_deploy.yaml) ![](https://uptime.aks.awsl.icu/api/badge/12/status) ![](https://uptime.aks.awsl.icu/api/badge/12/uptime) ![](https://uptime.aks.awsl.icu/api/badge/12/ping) ![](https://uptime.aks.awsl.icu/api/badge/12/avg-response) ![](https://uptime.aks.awsl.icu/api/badge/12/cert-exp) ![](https://uptime.aks.awsl.icu/api/badge/12/response)         |

</details>

<details>
<summary>Star History（クリックして展開／折りたたみ）</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=dreamhunter2333/cloudflare_temp_email&type=Date" />
</picture>

</details>

<details open>
<summary>目次（クリックして展開／折りたたみ）</summary>

- [Cloudflare 一時メール - 無料で構築できる一時メールサービス](#cloudflare-一時メール---無料で構築できる一時メールサービス)
  - [デプロイドキュメント - クイックスタート](#デプロイドキュメント---クイックスタート)
  - [変更履歴](#変更履歴)
  - [ライブデモ](#ライブデモ)
  - [主な機能](#主な機能)
    - [メール処理](#メール処理)
    - [ユーザー管理](#ユーザー管理)
    - [管理機能](#管理機能)
    - [多言語対応とインターフェース](#多言語対応とインターフェース)
    - [連携と拡張](#連携と拡張)
  - [技術アーキテクチャ](#技術アーキテクチャ)
    - [システム構成](#システム構成)
    - [技術スタック](#技術スタック)
    - [主要コンポーネント](#主要コンポーネント)
  - [コミュニティに参加](#コミュニティに参加)

</details>

## 主な機能

<details open>
<summary>主な機能の詳細（クリックして展開／折りたたみ）</summary>

### メール処理

- [x] `rust wasm` でメールを高速に解析します。ほぼすべてのメールを解析でき、Node.js の解析モジュールで失敗するメールも rust wasm なら正常に解析できます
- [x] **AI メール認識** - Cloudflare Workers AI を使用して、メール内の確認コード、認証リンク、サービスリンクなどの重要情報を自動抽出します
- [x] 指定したベースドメインに対して、ランダムな第 2 レベルサブドメインのメールボックスを任意で作成できます
- [x] `DKIM` 検証付きのメール送信に対応します
- [x] `SMTP` や `Resend` など、複数の送信方法に対応します
- [x] 添付ファイルの表示機能を備え、添付画像も表示できます
- [x] S3 での添付ファイルの保存と削除に対応します
- [x] スパム検出とブラックリスト／ホワイトリストの設定に対応します
- [x] グローバル転送先アドレスを指定できるメール転送機能を備えています

### ユーザー管理

- [x] `credentials` を使用して、以前利用したメールボックスへ再ログインできます
- [x] 完全なユーザー登録・ログイン機能を備えています。メールアドレスを紐付けると、そのアドレスのメール JWT 資格情報を自動取得し、複数のメールボックスを切り替えられます
- [x] `OAuth2` によるサードパーティログイン（Github、Authentik など）に対応します
- [x] `Passkey` によるパスワードレスログインに対応します
- [x] 複数ロールのドメインおよびプレフィックスを設定できるユーザーロール管理に対応します
- [x] アドレスやキーワードで絞り込めるユーザー受信箱を提供します

### 管理機能

- [x] 完全な admin コンソールを備えています
- [x] `admin` バックエンドからプレフィックスのないメールボックスを作成できます
- [x] admin ユーザー管理画面でユーザーのアドレスを確認できます
- [x] 複数のクリーンアップ戦略を選べる定期クリーンアップ機能を備えています
- [x] カスタム名のメールボックスを取得でき、`admin` でブラックリストを設定できます
- [x] アクセスパスワードを追加し、プライベートサイトとして利用できます

### 多言語対応とインターフェース

- [x] フロントエンドとバックエンドの両方が多言語に対応しています
- [x] レスポンシブレイアウトのモダンな UI デザインを採用しています
- [x] Google Ads の連携に対応します
- [x] shadow DOM を使用してスタイルの干渉を防ぎます
- [x] URL の JWT パラメーターによる自動ログインに対応します

### 連携と拡張

- [x] 完全な `Telegram Bot`、`Telegram` プッシュ通知、Telegram Bot ミニアプリに対応します
- [x] `SMTP proxy server` を追加し、`SMTP` によるメール送信と `IMAP` によるメール閲覧に対応します
- [x] Webhook とメッセージプッシュ連携に対応します
- [x] `CF Turnstile` CAPTCHA 検証に対応します
- [x] 悪用を防ぐためのレート制限を設定できます
- [x] **Agent フレンドリー**：組み込みの [`cf-temp-mail-agent-mail`](skills/cf-temp-mail-agent-mail/SKILL.md) skill により、AI agent がメールボックスを直接利用できます。詳しくは[ドキュメント](vitepress-docs/docs/en/guide/feature/agent-email.md)を参照してください
- [x] コミュニティのモバイル管理クライアント：[CloudMail](https://github.com/Lur1N77777/CloudMail) は本プロジェクト互換の API 向けに Expo / React Native で構築されており、Android 管理コンソール、アドレス管理、受信済み／送信済み／不明メール、確認コードのクイックコピー、OLED ブラックテーマ、ローカルグループ分けを提供します

</details>

## 技術アーキテクチャ

<details>
<summary>技術アーキテクチャの詳細（クリックして展開／折りたたみ）</summary>

### システム構成

- **データベース**：メインデータベースとして Cloudflare D1 を使用
- **フロントエンドのデプロイ**：Cloudflare Pages を使用してフロントエンドをデプロイ
- **バックエンドのデプロイ**：Cloudflare Workers を使用してバックエンドをデプロイ
- **メールルーティング**：Cloudflare Email Routing を使用

### 技術スタック

- **フロントエンド**：Vue 3 + Vite + TypeScript
- **バックエンド**：TypeScript + Cloudflare Workers
- **メール解析**：Rust WASM（mail-parser-wasm）
- **データベース**：Cloudflare D1（SQLite）
- **ストレージ**：Cloudflare KV + R2（任意で S3）
- **プロキシサービス**：Python SMTP/IMAP Proxy Server

### 主要コンポーネント

- **Worker**：中核となるバックエンドサービス
- **Frontend**：Vue 3 ユーザーインターフェース
- **Mail Parser WASM**：Rust メール解析モジュール
- **SMTP Proxy Server**：Python メールプロキシサービス
- **Pages Functions**：Cloudflare Pages ミドルウェア
- **Documentation**：VitePress ドキュメントサイト

</details>

### 重要な注意事項

- Resend でドメインレコードを追加する際、DNS プロバイダーが第 3 レベルドメイン a.b.com をホストしている場合は、Resend が生成したデフォルト名から第 2 レベルドメインのプレフィックス b を削除してください。削除しないと a.b.b.com が追加され、検証に失敗します。レコードを追加した後、次のコマンドで確認できます。
```bash
nslookup -qt="mx" a.b.com 1.1.1.1
```

## コミュニティに参加

- [Telegram](https://t.me/cloudflare_temp_email)

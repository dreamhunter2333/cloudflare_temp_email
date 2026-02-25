import { defineConfig } from 'vitepress'
import { zh } from './zh'
import { en } from './en'

export default defineConfig({
  title: "Temp Mail Doc",
  description: 'CloudFlare 免费收发临时域名邮箱 | Free temporary domain email on CloudFlare',
  lang: 'zh-CN',
  lastUpdated: true,
  locales: {
    zh: { label: '简体中文', ...zh },
    en: { label: 'English', ...en }
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:locale:alternate', content: 'en_US' }],
    ['meta', { property: 'og:title', content: 'Temp Mail - CloudFlare 临时邮箱' }],
    ['meta', { property: 'og:description', content: 'CloudFlare 免费收发临时域名邮箱，支持多域名、附件、Telegram Bot、Webhook、SMTP/IMAP' }],
    ['meta', { property: 'og:site_name', content: 'Temp Mail' }],
    ['meta', { property: 'og:image', content: 'https://temp-mail-docs.awsl.uk/logo.png' }],
    ['meta', { property: 'og:url', content: 'https://temp-mail-docs.awsl.uk' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'Temp Mail - CloudFlare 临时邮箱' }],
    ['meta', { name: 'twitter:description', content: 'CloudFlare 免费收发临时域名邮箱' }],
    ['meta', { name: 'twitter:image', content: 'https://temp-mail-docs.awsl.uk/logo.png' }],
    ['link', { rel: 'alternate', hreflang: 'zh-Hans', href: 'https://temp-mail-docs.awsl.uk/zh/' }],
    ['link', { rel: 'alternate', hreflang: 'en', href: 'https://temp-mail-docs.awsl.uk/en/' }],
    ['link', { rel: 'alternate', hreflang: 'x-default', href: 'https://temp-mail-docs.awsl.uk/zh/' }],
  ],
  sitemap: {
    hostname: 'https://temp-mail-docs.awsl.uk',
    transformItems(items) {
      return items.filter((item) => !item.url.includes('migration'))
    }
  },
  themeConfig: {
    logo: { src: '/logo.png', width: 24, height: 24 },
    search: { provider: 'local' },
    socialLinks: [
      {
        icon: 'discord',
        link: 'https://discord.gg/dQEwTWhA6Q'
      },
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 448 512"><path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9l-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9l190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284L16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z" fill="currentColor"></path></svg>'
        },
        link: 'https://t.me/cloudflare_temp_email'
      },
      {
        icon: 'github',
        link: 'https://github.com/dreamhunter2333/cloudflare_temp_email'
      }
    ]
  }
})

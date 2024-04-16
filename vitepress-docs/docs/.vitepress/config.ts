import { defineConfig } from 'vitepress'
import { zh } from './zh'
import { en } from './en'

export default defineConfig({
  title: "Temp Mail Doc",
  lang: 'zh-CN',
  lastUpdated: true,
  locales: {
    root: { label: '简体中文', ...zh },
    en: { label: 'English', ...en }
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'Temp Mail Doc' }],
    ['meta', { property: 'og:title', content: 'Temp Mail Doc' }],
    ['meta', { property: 'og:site_name', content: 'Temp Mail' }],
    ['meta', { property: 'og:image', content: 'https://temp-mail-docs.awsl.uk/logo.png' }],
    ['meta', { property: 'og:url', content: 'https://temp-mail-docs.awsl.uk' }],
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
        icon: 'github',
        link: 'https://github.com/dreamhunter2333/cloudflare_temp_email'
      }
    ]
  }
})

import { defineConfig, type DefaultTheme } from 'vitepress'

export const en = defineConfig({
    title: "Temp Mail Doc",
    lang: 'zh-Hans',
    description: 'CloudFlare Free sending and receiving of temporary domain name mailboxes',

    themeConfig: {
        outline: 'deep',
        nav: nav(),

        editLink: {
            pattern: 'https://github.com/dreamhunter2333/cloudflare_temp_email/edit/main/vitepress-docs/docs/:path',
            text: 'Edit this page on GitHub'
        },

        footer: {
            message: 'Based on MIT license',
            copyright: `Copyright © 2023-${new Date().getFullYear()} Dream Hunter`
        },
    }
})

function nav(): DefaultTheme.NavItem[] {
    return [
        {
            text: 'Home',
            link: '/en/',
        },
        {
            text: 'Guide',
            link: '/en/cli',
        },
        {
            text: 'Service Status',
            link: '/status',
        },
        {
            text: 'Reference',
            link: '/reference',
        },
        {
            text: process.env.TAG_NAME || 'v0.2.2',
            items: [
                {
                    text: 'CHANGELOG',
                    link: 'https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/CHANGELOG.md'
                },
                {
                    text: 'Contribute',
                    link: 'https://github.com/dreamhunter2333/cloudflare_temp_email'
                }
            ]
        }
    ]
}

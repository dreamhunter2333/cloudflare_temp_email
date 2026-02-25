import { defineConfig, type DefaultTheme } from 'vitepress'

export const en = defineConfig({
    title: "Temp Mail Doc",
    lang: 'en-US',
    description: 'Free temporary domain email powered by CloudFlare Workers, with multi-domain, attachments, Telegram Bot, Webhook, SMTP/IMAP support',

    head: [
        ['meta', { property: 'og:locale', content: 'en_US' }],
        ['meta', { property: 'og:description', content: 'Free temporary domain email powered by CloudFlare Workers, with multi-domain, attachments, Telegram Bot, Webhook, SMTP/IMAP support' }],
    ],

    themeConfig: {
        nav: nav(),

        sidebar: {
            '/en/guide/': { base: '/en/guide/', items: sidebarGuide() },
        },

        editLink: {
            pattern: 'https://github.com/dreamhunter2333/cloudflare_temp_email/edit/main/vitepress-docs/docs/:path',
            text: 'Edit this page on GitHub'
        },

        footer: {
            message: 'Based on MIT license',
            copyright: `Copyright © 2023-${new Date().getFullYear()} Dream Hunter`
        },

        docFooter: {
            prev: 'Previous',
            next: 'Next'
        },

        outline: {
            level: 'deep',
            label: 'On this page'
        },

        lastUpdated: {
            text: 'Last updated',
            formatOptions: {
                dateStyle: 'short',
                timeStyle: 'medium'
            }
        },

        langMenuLabel: 'Language',
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Theme',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode'
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
            link: '/en/guide/quick-start',
            activeMatch: '/en/guide/'
        },
        {
            text: 'Service Status',
            link: '/en/status',
        },
        {
            text: 'Reference',
            link: '/en/reference',
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

function sidebarGuide(): DefaultTheme.SidebarItem[] {
    return [
        {
            text: 'Introduction',
            collapsed: false,
            items: [
                { text: 'What is Temporary Email', link: 'what-is-temp-mail' },
                { text: 'Star History', link: 'star-history' },
                { text: 'Quick Start', link: 'quick-start' },
            ]
        },
        {
            text: 'Deploy via Command Line',
            collapsed: false,
            items: [
                { text: 'CLI Prerequisites', link: 'cli/pre-requisite' },
                { text: 'D1 Database', link: 'cli/d1' },
                { text: 'Cloudflare Workers Backend', link: 'cli/worker' },
                { text: 'Configure Email Routing', link: 'email-routing.md' },
                { text: 'Cloudflare Pages Frontend', link: 'cli/pages' },
                { text: 'Configure Email Sending', link: 'config-send-mail' },
            ]
        },
        {
            text: 'Deploy via User Interface',
            collapsed: false,
            items: [
                { text: 'D1 Database', link: 'ui/d1' },
                { text: 'Cloudflare Workers Backend', link: 'ui/worker' },
                { text: 'Configure Email Routing', link: 'email-routing.md' },
                { text: 'Cloudflare Pages Frontend', link: 'ui/pages' },
                { text: 'Configure Email Sending', link: 'config-send-mail' },
            ]
        },
        {
            text: 'Deploy via Github Actions',
            collapsed: true,
            items: [
                { text: 'Github Actions Prerequisites', link: 'actions/pre-requisite' },
                { text: 'D1 Database', link: 'actions/d1' },
                { text: 'Github Actions Configuration', link: 'actions/github-action' },
                { text: 'Configure Email Routing', link: 'email-routing.md' },
                { text: 'Configure Email Sending', link: 'config-send-mail' },
                { text: 'Auto-Update Configuration', link: 'actions/auto-update' },
            ]
        },
        {
            text: 'General',
            collapsed: false,
            items: [
                { text: 'Worker Variables', link: 'worker-vars' },
                { text: 'Common Issues', link: 'common-issues' },
            ]
        },
        {
            text: 'Additional Features',
            collapsed: false,
            items: [
                { text: 'AI Email Recognition', link: 'feature/ai-extract' },
                { text: 'Configure SMTP IMAP Proxy', link: 'feature/config-smtp-proxy' },
                { text: 'Send Email API', link: 'feature/send-mail-api' },
                { text: 'View Email API', link: 'feature/mail-api' },
                { text: 'Configure Subdomain Email', link: 'feature/subdomain' },
                { text: 'Configure Telegram Bot', link: 'feature/telegram' },
                { text: 'Configure S3 Attachments', link: 'feature/s3-attachment' },
                { text: 'Configure WASM Email Parser', link: 'feature/mail_parser_wasm_worker' },
                { text: 'Configure Webhook', link: 'feature/webhook' },
                { text: 'New Address API', link: 'feature/new-address-api' },
                { text: 'OAuth2 Third-party Login', link: 'feature/user-oauth2' },
                { text: 'Enhance with Other Workers', link: 'feature/another-worker-enhanced' },
                { text: 'Add Google Ads', link: 'feature/google-ads.md' },
            ]
        },
        {
            text: 'Feature Overview',
            collapsed: false,
            items: [
                { text: 'Admin Console', link: 'feature/admin' },
                { text: 'Admin User Management', link: 'feature/admin-user-management' },
            ]
        },
        { text: 'Reference', base: "/en/", link: 'reference' }
    ]
}

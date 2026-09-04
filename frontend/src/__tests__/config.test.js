// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setRuntimeConfig = (config) => {
  const element = document.createElement('script')
  element.id = 'app-config'
  element.type = 'application/json'
  element.textContent = JSON.stringify(config)
  document.head.appendChild(element)
}

describe('APP_CONFIG', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE', 'https://build.example.com')
    vi.stubEnv('VITE_DEFAULT_LANG', 'zh')
    vi.stubEnv('VITE_IS_TELEGRAM', 'false')
  })

  afterEach(() => {
    document.querySelector('#app-config')?.remove()
    vi.unstubAllEnvs()
  })

  it('uses build settings when runtime settings are absent', async () => {
    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://build.example.com')
    expect(APP_CONFIG.DEFAULT_LANG).toBe('zh')
  })

  it('overrides only settings provided by index.html', async () => {
    setRuntimeConfig({ API_BASE: 'https://runtime.example.com', DEFAULT_LANG: 'en' })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://runtime.example.com')
    expect(APP_CONFIG.DEFAULT_LANG).toBe('en')
  })

  it('allows an explicit empty runtime value', async () => {
    setRuntimeConfig({ API_BASE: '' })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('')
    expect(APP_CONFIG.DEFAULT_LANG).toBe('zh')
  })

  it('falls back to build settings for invalid runtime value types', async () => {
    setRuntimeConfig({ API_BASE: {}, DEFAULT_LANG: 1, IS_TELEGRAM: [] })

    const { APP_CONFIG } = await import('../config')

    expect(APP_CONFIG.API_BASE).toBe('https://build.example.com')
    expect(APP_CONFIG.DEFAULT_LANG).toBe('zh')
    expect(APP_CONFIG.IS_TELEGRAM).toBe('false')
  })

  it('reads runtime settings only once', async () => {
    setRuntimeConfig({ DEFAULT_LANG: 'en' })
    const firstImport = await import('../config')

    document.querySelector('#app-config').textContent = JSON.stringify({ DEFAULT_LANG: 'de' })
    const secondImport = await import('../config')

    expect(secondImport.APP_CONFIG).toBe(firstImport.APP_CONFIG)
    expect(secondImport.APP_CONFIG.DEFAULT_LANG).toBe('en')
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildLocaleAliases,
  DEFAULT_LOCALE,
  getPathWithLocale,
  getPreferredLocale,
  replaceLocaleInFullPath,
  resolveSupportedLocale,
} from '../../i18n/utils'

describe('locale matching', () => {
  it('maps browser locales to supported locales', () => {
    expect(getPreferredLocale('', ['ja-JP', 'en-US'])).toBe('ja')
    expect(getPreferredLocale('', ['pt-PT'])).toBe('pt-BR')
    expect(getPreferredLocale('', ['de-DE'])).toBe('de')
  })

  it('prefers saved locale over browser locale', () => {
    expect(getPreferredLocale('de', ['ja-JP'])).toBe('de')
  })

  it('falls back to english when locale is unsupported', () => {
    expect(getPreferredLocale('', ['it-IT'])).toBe('en')
  })

  it('normalizes supported locale casing', () => {
    expect(resolveSupportedLocale('pt-br')).toBe('pt-BR')
    expect(resolveSupportedLocale('PT-BR')).toBe('pt-BR')
    expect(resolveSupportedLocale('de')).toBe('de')
    expect(resolveSupportedLocale('unknown')).toBeNull()
  })

  it('keeps en unprefixed and prefixes non-default locales', () => {
    expect(getPathWithLocale('/user', DEFAULT_LOCALE)).toBe('/user')
    expect(getPathWithLocale('/user', 'ja')).toBe('/ja/user')
  })

  it('preserves query and hash when switching locale', () => {
    expect(replaceLocaleInFullPath('/user?tab=mail#top', 'es')).toBe('/es/user?tab=mail#top')
    expect(replaceLocaleInFullPath('/de/admin?mode=full', 'zh')).toBe('/zh/admin?mode=full')
    expect(replaceLocaleInFullPath('/de/admin?mode=full', 'en')).toBe('/admin?mode=full')
    expect(replaceLocaleInFullPath('/pt-br/user?tab=mail#top', 'pt-BR')).toBe('/pt-BR/user?tab=mail#top')
  })

  it('normalizes input paths when building locale aliases', () => {
    expect(buildLocaleAliases('user')).toEqual(buildLocaleAliases('/user'))
    expect(buildLocaleAliases('user')).toEqual([
      '/zh/user',
      '/en/user',
      '/es/user',
      '/pt-BR/user',
      '/ja/user',
      '/de/user',
    ])
  })
})

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  getPathWithLocale,
  getPreferredLocale,
  replaceLocaleInFullPath,
} from '../../i18n-utils'

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

  it('keeps zh unprefixed and prefixes non-default locales', () => {
    expect(getPathWithLocale('/user', DEFAULT_LOCALE)).toBe('/user')
    expect(getPathWithLocale('/user', 'ja')).toBe('/ja/user')
  })

  it('preserves query and hash when switching locale', () => {
    expect(replaceLocaleInFullPath('/user?tab=mail#top', 'es')).toBe('/es/user?tab=mail#top')
    expect(replaceLocaleInFullPath('/de/admin?mode=full', 'zh')).toBe('/admin?mode=full')
  })
})

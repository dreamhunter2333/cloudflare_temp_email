import { describe, expect, it } from 'vitest'

import { getLocaleRedirectPath, getRouteLocale } from '../locale-guard'

describe('locale guard', () => {
  it('normalizes route locale casing for pt-BR aliases', () => {
    expect(getRouteLocale('/pt-br/user')).toBe('pt-BR')
    expect(getRouteLocale('/PT-BR/user')).toBe('pt-BR')
  })

  it('redirects non-canonical locale paths to the canonical route', () => {
    expect(getLocaleRedirectPath({
      fullPath: '/pt-br/user?tab=mail#top',
      routeLocale: 'pt-BR',
      resolvedLocale: 'pt-BR',
    })).toBe('/pt-BR/user?tab=mail#top')
  })

  it('redirects legacy default-locale aliases to the canonical unprefixed route', () => {
    expect(getLocaleRedirectPath({
      fullPath: '/en/user?tab=mail#top',
      routeLocale: 'en',
      resolvedLocale: 'en',
    })).toBe('/user?tab=mail#top')
  })
})

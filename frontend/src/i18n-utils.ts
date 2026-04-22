export const SUPPORTED_LOCALES = ['zh', 'en', 'es', 'pt-BR', 'ja', 'de'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'zh'
export const FALLBACK_LOCALE: SupportedLocale = 'en'
export const PREFERRED_LOCALE_STORAGE_KEY = 'preferredLocale'
export const EMPTY_LOCALE_MESSAGES = Object.fromEntries(
  SUPPORTED_LOCALES.map((supportedLocale) => [supportedLocale, {}]),
) as Record<SupportedLocale, Record<string, never>>

const localeMatchers: Array<{ locale: SupportedLocale, matches: string[] }> = [
  { locale: 'zh', matches: ['zh'] },
  { locale: 'en', matches: ['en'] },
  { locale: 'es', matches: ['es'] },
  { locale: 'pt-BR', matches: ['pt'] },
  { locale: 'ja', matches: ['ja'] },
  { locale: 'de', matches: ['de'] },
]

export const isSupportedLocale = (locale: unknown): locale is SupportedLocale => {
  return typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

export const matchSupportedLocale = (locale: string | null | undefined): SupportedLocale | null => {
  if (!locale) return null
  const normalizedLocale = locale.trim().toLowerCase()

  for (const matcher of localeMatchers) {
    if (matcher.matches.some((prefix) => normalizedLocale === prefix || normalizedLocale.startsWith(`${prefix}-`))) {
      return matcher.locale
    }
  }

  return null
}

export const getBrowserLocales = (): string[] => {
  if (typeof navigator === 'undefined') return []

  const locales = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language]

  return locales.filter(Boolean)
}

export const getStoredLocale = (): SupportedLocale | '' => {
  if (typeof window === 'undefined') return ''

  const locale = window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY)
  return isSupportedLocale(locale) ? locale : ''
}

export const getPreferredLocale = (
  storedLocale: string | null | undefined,
  browserLocales: string[] = [],
): SupportedLocale => {
  if (isSupportedLocale(storedLocale)) return storedLocale

  for (const browserLocale of browserLocales) {
    const matchedLocale = matchSupportedLocale(browserLocale)
    if (matchedLocale) return matchedLocale
  }

  return FALLBACK_LOCALE
}

export const getInitialLocale = () => getPreferredLocale(getStoredLocale(), getBrowserLocales())

const splitPathSuffix = (fullPath: string) => {
  const match = fullPath.match(/^([^?#]*)(.*)$/)
  return {
    path: match?.[1] || '/',
    suffix: match?.[2] || '',
  }
}

export const stripLocaleFromPath = (path: string): string => {
  if (!path || path === '/') return '/'

  for (const locale of SUPPORTED_LOCALES) {
    const localePrefix = `/${locale}`
    if (path === localePrefix || path === `${localePrefix}/`) {
      return '/'
    }
    if (path.startsWith(`${localePrefix}/`)) {
      return path.slice(localePrefix.length) || '/'
    }
  }

  return path
}

export const getPathWithLocale = (path: string, locale: SupportedLocale): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const basePath = stripLocaleFromPath(normalizedPath)

  if (locale === DEFAULT_LOCALE) {
    return basePath
  }

  if (basePath === '/') {
    return `/${locale}/`
  }

  return `/${locale}${basePath}`
}

export const replaceLocaleInFullPath = (fullPath: string, locale: SupportedLocale): string => {
  const { path, suffix } = splitPathSuffix(fullPath)
  return `${getPathWithLocale(path, locale)}${suffix}`
}

export const buildLocaleAliases = (path: string): string[] => {
  return SUPPORTED_LOCALES
    .map((locale) => getPathWithLocale(path, locale))
    .filter((alias, index, aliases) => aliases.indexOf(alias) === index && alias !== path)
}

import {
  DEFAULT_LOCALE,
  getPreferredLocale,
  isSupportedLocale,
  replaceLocaleInFullPath,
  resolveSupportedLocale,
} from '../i18n/utils'

export const getRouteLocale = (path) => {
  const pathLocale = path.split('/')[1]
  return resolveSupportedLocale(pathLocale)
}

export const getInitialPreferredLocale = ({ preferredLocale, browserLocales }) => {
  if (isSupportedLocale(preferredLocale)) {
    return preferredLocale
  }

  return getPreferredLocale('', browserLocales)
}

export const resolveLocaleForNavigation = ({ routeLocale }) => {
  return routeLocale || DEFAULT_LOCALE
}

export const getLocaleRedirectPath = ({ fullPath, routeLocale, resolvedLocale }) => {
  if (routeLocale) {
    const canonicalRoutePath = replaceLocaleInFullPath(fullPath, routeLocale)
    if (canonicalRoutePath !== fullPath) {
      return canonicalRoutePath
    }
  }

  if (routeLocale === DEFAULT_LOCALE) {
    return replaceLocaleInFullPath(fullPath, DEFAULT_LOCALE)
  }

  if (!routeLocale && resolvedLocale !== DEFAULT_LOCALE) {
    return replaceLocaleInFullPath(fullPath, resolvedLocale)
  }

  return null
}

export const applyLocaleNavigationState = ({ routeLocale, resolvedLocale, preferredLocaleRef, browserLocales, i18n }) => {
  i18n.global.locale.value = resolvedLocale

  if (routeLocale) {
    preferredLocaleRef.value = routeLocale
    return
  }

  if (!preferredLocaleRef.value) {
    preferredLocaleRef.value = getInitialPreferredLocale({
      preferredLocale: preferredLocaleRef.value,
      browserLocales,
    })
  }
}

export const syncJwtFromQuery = ({ query, jwtRef }) => {
  if (query.jwt) {
    jwtRef.value = query.jwt
  }
}

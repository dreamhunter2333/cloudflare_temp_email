import * as localeUtils from '../i18n/utils'

export const getRouteLocale = (path) => {
  const pathLocale = path.split('/')[1]
  return localeUtils.resolveSupportedLocale(pathLocale)
}

export const getInitialPreferredLocale = ({ preferredLocale, browserLocales }) => {
  if (localeUtils.isSupportedLocale(preferredLocale)) {
    return preferredLocale
  }

  return localeUtils.getPreferredLocale('', browserLocales)
}

export const resolveLocaleForNavigation = ({ routeLocale }) => {
  return routeLocale || localeUtils.DEFAULT_LOCALE
}

export const getLocaleRedirectPath = ({ fullPath, routeLocale, resolvedLocale }) => {
  if (routeLocale) {
    const canonicalRoutePath = localeUtils.replaceLocaleInFullPath(fullPath, routeLocale)
    if (canonicalRoutePath !== fullPath) {
      return canonicalRoutePath
    }
  }

  if (routeLocale === localeUtils.DEFAULT_LOCALE) {
    return localeUtils.replaceLocaleInFullPath(fullPath, localeUtils.DEFAULT_LOCALE)
  }

  if (!routeLocale && resolvedLocale !== localeUtils.DEFAULT_LOCALE) {
    return localeUtils.replaceLocaleInFullPath(fullPath, resolvedLocale)
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

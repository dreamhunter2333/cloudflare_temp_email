import * as localeUtils from '../i18n/utils'

export const getRouteLocale = (path) => {
  const pathLocale = path.split('/')[1]
  return localeUtils.resolveSupportedLocale(pathLocale)
}

export const resolveLocaleForNavigation = ({ routeLocale, preferredLocale, browserLocales }) => {
  return routeLocale || localeUtils.getPreferredLocale(preferredLocale, browserLocales)
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

export const applyLocaleNavigationState = ({ routeLocale, resolvedLocale, preferredLocaleRef, i18n }) => {
  i18n.global.locale.value = resolvedLocale
  preferredLocaleRef.value = routeLocale || resolvedLocale
}

export const syncJwtFromQuery = ({ query, jwtRef }) => {
  if (query.jwt) {
    jwtRef.value = query.jwt
  }
}

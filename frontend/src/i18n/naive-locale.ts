import type { NDateLocale, NLocale } from 'naive-ui'
import { getNaiveLocaleConfig as getRegistryNaiveLocaleConfig } from './locale-registry'

import type { SupportedLocale } from './locale-registry'

export type NaiveLocaleConfig = {
  locale: NLocale
  dateLocale: NDateLocale
}

export const getNaiveLocaleConfig = (locale: SupportedLocale): NaiveLocaleConfig => {
  return getRegistryNaiveLocaleConfig(locale)
}

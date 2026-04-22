import {
  dateDeDE,
  dateEnUS,
  dateEsAR,
  dateJaJP,
  datePtBR,
  dateZhCN,
  deDE,
  enUS,
  esAR,
  jaJP,
  ptBR,
  zhCN,
} from 'naive-ui'

import type { NDateLocale, NLocale } from 'naive-ui'

import type { SupportedLocale } from './i18n-utils'

export type NaiveLocaleConfig = {
  locale: NLocale
  dateLocale: NDateLocale
}

const naiveLocaleMap: Record<SupportedLocale, NaiveLocaleConfig> = {
  zh: { locale: zhCN, dateLocale: dateZhCN },
  en: { locale: enUS, dateLocale: dateEnUS },
  es: { locale: esAR, dateLocale: dateEsAR },
  'pt-BR': { locale: ptBR, dateLocale: datePtBR },
  ja: { locale: jaJP, dateLocale: dateJaJP },
  de: { locale: deDE, dateLocale: dateDeDE },
}

export const getNaiveLocaleConfig = (locale: SupportedLocale): NaiveLocaleConfig => {
  return naiveLocaleMap[locale] || naiveLocaleMap.en
}

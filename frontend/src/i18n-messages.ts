import type { SupportedLocale } from './i18n-utils'

import { deMessages } from './locales/source/de'
import { esMessages } from './locales/source/es'
import { jaMessages } from './locales/source/ja'
import { ptBRMessages } from './locales/source/ptBR'

const localizedSourceMessages: Record<Exclude<SupportedLocale, 'zh' | 'en'>, Record<string, string>> = {
  es: esMessages,
  'pt-BR': ptBRMessages,
  ja: jaMessages,
  de: deMessages,
}

export const getLocalizedSourceMessage = (
  locale: Exclude<SupportedLocale, 'zh' | 'en'>,
  source: string,
) => {
  return localizedSourceMessages[locale][source]
}

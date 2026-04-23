import type { SupportedLocale } from './locale-registry'
import type { MessageNamespace } from './message-registry'

import { deMessages } from './locales/source/de'
import { esMessages } from './locales/source/es'
import { jaMessages } from './locales/source/ja'
import { ptBRMessages } from './locales/source/ptBR'

const localizedMessages: Record<Exclude<SupportedLocale, 'zh' | 'en'>, Record<string, string>> = {
  es: esMessages,
  'pt-BR': ptBRMessages,
  ja: jaMessages,
  de: deMessages,
}

export const getLocalizedMessage = (
  locale: Exclude<SupportedLocale, 'zh' | 'en'>,
  namespace: MessageNamespace,
  key: string,
) => {
  return localizedMessages[locale][`${namespace}.${key}`]
}

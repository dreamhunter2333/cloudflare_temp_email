import { createI18n, useI18n as baseUseI18n } from 'vue-i18n'

import type { ComposerAdditionalOptions, ComposerOptions } from 'vue-i18n'

import { getLocalizedMessage } from './i18n-messages'
import { resolveMessageNamespace } from './i18n-message-registry'
import { SUPPORTED_LOCALES } from './locale-registry'

type LocaleMessages = Record<string, Record<string, unknown>>

const additionalLocales = SUPPORTED_LOCALES.filter((locale) => locale !== 'zh' && locale !== 'en')

const withExtendedMessages = (messages: LocaleMessages) => {
  const localizedMessages: LocaleMessages = {
    ...messages,
  }

  const englishMessages = messages.en || {}
  const chineseMessages = messages.zh || {}
  const messageNamespace = resolveMessageNamespace(messages)
  const messageKeys = new Set([
    ...Object.keys(englishMessages),
    ...Object.keys(chineseMessages),
  ])

  for (const locale of additionalLocales) {
    const localeMessages = {
      ...(localizedMessages[locale] || {}),
    }

    for (const key of messageKeys) {
      if (localeMessages[key] !== undefined) continue

      const localizedMessage = messageNamespace
        ? getLocalizedMessage(locale, messageNamespace, key)
        : undefined

      if (localizedMessage !== undefined) {
        localeMessages[key] = localizedMessage
        continue
      }

      const sourceMessage = englishMessages[key]
      if (typeof sourceMessage === 'string') {
        localeMessages[key] = sourceMessage
        continue
      }

      if (chineseMessages[key] !== undefined) {
        localeMessages[key] = chineseMessages[key]
      }
    }

    localizedMessages[locale] = localeMessages
  }

  return localizedMessages
}

export const createAppI18n = createI18n

export const useAppI18n = <
  Schema extends object = object,
  Locales extends string = string,
  Options extends ComposerOptions<Schema, Locales> & ComposerAdditionalOptions = ComposerOptions<Schema, Locales> & ComposerAdditionalOptions,
>(
  options?: Options,
) => {
  if (options?.messages) {
    return baseUseI18n({
      ...options,
      messages: withExtendedMessages(options.messages as LocaleMessages),
    } as Options)
  }

  return baseUseI18n(options)
}

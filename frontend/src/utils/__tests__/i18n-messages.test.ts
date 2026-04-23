import { describe, expect, it } from 'vitest'

import { getLocalizedMessage } from '../../i18n-messages'
import { MESSAGE_REGISTRY } from '../../i18n-message-registry'

describe('new locale coverage', () => {
  it('covers every registered locale message key', () => {
    const locales = ['es', 'pt-BR', 'ja', 'de'] as const

    for (const locale of locales) {
      const missing: string[] = []

      for (const [namespace, messages] of Object.entries(MESSAGE_REGISTRY)) {
        for (const key of Object.keys(messages)) {
          if (getLocalizedMessage(locale, namespace as keyof typeof MESSAGE_REGISTRY, key) === undefined) {
            missing.push(`${namespace}.${key}`)
          }
        }
      }

      expect(missing, `${locale} is missing translations for: ${missing.join(' | ')}`).toEqual([])
    }
  })
})

import { expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { I18N_MESSAGES } from '../messages'

it.each(Object.keys(I18N_MESSAGES))('translates both mailbox expiry columns without fallback (%s)', (locale) => {
  const { global } = createI18n({ legacy: false, locale, fallbackLocale: false, messages: I18N_MESSAGES })

  for (const namespace of ['views.admin.Account', 'views.user.AddressManagement']) {
    for (const key of ['expires_at', 'neverExpires', 'expiredPendingDeletion']) {
      const path = `${namespace}.${key}`
      expect(global.te(path, locale), path).toBe(true)
      expect(global.t(path)).not.toBe(path)
    }
  }
})

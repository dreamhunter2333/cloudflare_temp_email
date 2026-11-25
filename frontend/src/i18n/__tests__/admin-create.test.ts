import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { MESSAGE_REGISTRY } from '../message-registry'
import { I18N_MESSAGES } from '../messages'

const keys = [
  ...['creationMode', 'singleMode', 'batchMode', 'domain'].map(key => `views.admin.CreateAccount.${key}`),
  ...Object.keys(MESSAGE_REGISTRY['views.admin.BatchCreate']).map(key => `views.admin.BatchCreate.${key}`),
  ...Object.keys(MESSAGE_REGISTRY['views.admin.BatchExportModal']).map(key => `views.admin.BatchExportModal.${key}`),
]

describe.each(Object.keys(I18N_MESSAGES))('admin creation translations (%s)', locale => {
  it('renders all creation and export messages without falling back', () => {
    const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: I18N_MESSAGES })
    for (const key of keys) {
      expect(i18n.global.te(key, locale), key).toBe(true)
      expect(i18n.global.t(key, { completed: 1, requested: 2, count: 2 })).not.toBe(key)
    }
    const progress = i18n.global.t('views.admin.BatchCreate.batchProgress', { completed: 17, requested: 83 })
    expect(progress).toContain('17')
    expect(progress).toContain('83')
    expect(i18n.global.t('views.admin.BatchCreate.batchTotal', { count: 29 })).toContain('29')
  })
})

import { useI18n } from 'vue-i18n'

const withNamespace = (namespace: string, key: string) => `${namespace}.${key}`

export const useScopedI18n = (namespace: string) => {
  const composer = useI18n({ useScope: 'global' })

  return {
    ...composer,
    t: ((key: string, ...args: unknown[]) => composer.t(withNamespace(namespace, key), ...(args as []))) as typeof composer.t,
  }
}

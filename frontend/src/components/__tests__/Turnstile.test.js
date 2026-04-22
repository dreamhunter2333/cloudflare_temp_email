// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Turnstile from '../Turnstile.vue'
import { useGlobalState } from '../../store'

const flushUpdates = async () => {
  await Promise.resolve()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await nextTick()
}

describe('Turnstile', () => {
  let host
  let app
  let state
  let token
  let turnstileApi
  let componentRef
  let i18n

  beforeEach(() => {
    document.body.innerHTML = ''
    host = document.createElement('div')
    document.body.appendChild(host)

    state = useGlobalState()
    state.openSettings.value.cfTurnstileSiteKey = 'site-key'
    state.isDark.value = false

    token = ref('existing-token')
    componentRef = ref(null)
    turnstileApi = {
      render: vi.fn((selector, options) => `widget-${turnstileApi.render.mock.calls.length}`),
      remove: vi.fn(),
    }
    window.turnstile = turnstileApi

    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {},
        zh: {},
        de: {},
      },
    })

    const Root = {
      components: { Turnstile },
      setup() {
        return {
          token,
          componentRef,
        }
      },
      template: '<Turnstile ref="componentRef" v-model:value="token" />',
    }

    app = createApp(Root)
    app.use(i18n)
    app.mount(host)
  })

  afterEach(() => {
    app?.unmount()
    host?.remove()
    delete window.turnstile
    document.body.innerHTML = ''
  })

  it('renders immediately on mount and rerenders when locale or theme changes', async () => {
    await flushUpdates()

    expect(turnstileApi.render).toHaveBeenCalledTimes(1)
    expect(turnstileApi.remove).not.toHaveBeenCalled()
    expect(token.value).toBe('')
    expect(turnstileApi.render.mock.calls[0][1]).toMatchObject({
      language: 'en',
      theme: 'light',
      sitekey: 'site-key',
    })

    i18n.global.locale.value = 'de'
    await flushUpdates()

    expect(turnstileApi.remove).toHaveBeenCalledWith('widget-1')
    expect(turnstileApi.render).toHaveBeenCalledTimes(2)
    expect(turnstileApi.render.mock.calls[1][1]).toMatchObject({
      language: 'de',
      theme: 'light',
    })

    state.isDark.value = true
    await flushUpdates()

    expect(turnstileApi.remove).toHaveBeenCalledWith('widget-2')
    expect(turnstileApi.render).toHaveBeenCalledTimes(3)
    expect(turnstileApi.render.mock.calls[2][1]).toMatchObject({
      language: 'de',
      theme: 'dark',
    })

    await componentRef.value.refresh()
    await flushUpdates()

    expect(turnstileApi.remove).toHaveBeenCalledWith('widget-3')
    expect(turnstileApi.render).toHaveBeenCalledTimes(4)
  })
})

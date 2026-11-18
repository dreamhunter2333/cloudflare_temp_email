// @vitest-environment jsdom

import { createApp, defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveExpiryPayload } from '../index'
import { I18N_MESSAGES } from '../../i18n/messages'

const mockApiFetch = vi.fn()
const mockMessageError = vi.fn()

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: mockMessageError, success: vi.fn() }),
  }
})

vi.mock('../../api', () => ({
  api: {
    fetch: mockApiFetch,
  },
}))

vi.mock('../../views/admin/BatchExportModal.vue', () => ({
  default: defineComponent({
    name: 'BatchExportModal',
    render: () => null,
  }),
}))

const stubComponent = (tag: string, propsToAttrs = false) => defineComponent({
  name: tag,
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    loading: Boolean,
    value: null,
    show: Boolean,
  },
  emits: ['click', 'update:value', 'update:show'],
  setup(props, { slots, emit, attrs }) {
    return () => h(tag, {
      ...attrs,
      ...(propsToAttrs ? { disabled: props.disabled } : {}),
      onClick: (e: MouseEvent) => {
        if (!props.disabled) emit('click', e)
      },
    }, slots.default?.())
  },
})

describe('resolveExpiryPayload', () => {
  it('returns empty object for never mode and non-own keys', () => {
    expect(resolveExpiryPayload('never', null, 1_700_000_000_000)).toEqual({})
    expect(resolveExpiryPayload('__proto__', null, 1_700_000_000_000)).toEqual({})
    expect(resolveExpiryPayload('constructor', null, 1_700_000_000_000)).toEqual({})
  })

  it('returns expiresIn seconds for preset modes', () => {
    const expectedPresets: [string, number][] = [
      ['1h', 3600],
      ['24h', 86400],
      ['3d', 259200],
      ['7d', 604800],
      ['30d', 2592000],
    ]
    for (const [mode, seconds] of expectedPresets) {
      expect(resolveExpiryPayload(mode, null, 1_700_000_000_000)).toEqual({ expiresIn: seconds })
    }
  })

  it('returns null when custom mode has missing, out-of-range, or past/same-second timestamp', () => {
    const now = 1_700_000_000_500
    expect(resolveExpiryPayload('custom', null, now)).toBeNull()
    expect(resolveExpiryPayload('custom', undefined, now)).toBeNull()
    expect(resolveExpiryPayload('custom', now + 200, now)).toBeNull()
    expect(resolveExpiryPayload('custom', now - 5_000, now)).toBeNull()
    expect(resolveExpiryPayload('custom', 8_640_000_000_000_001, now)).toBeNull()
  })

  it('returns ISO expiresAt when custom timestamp is in a future UTC second', () => {
    const now = 1_700_000_000_000
    const future = now + 60_000
    expect(resolveExpiryPayload('custom', future, now)).toEqual({
      expiresAt: new Date(future).toISOString(),
    })
  })
})

describe('BatchCreate expiry validation', () => {
  let container: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'))
    mockApiFetch.mockReset()
    mockMessageError.mockReset()
    vi.stubGlobal('useMessage', () => ({ error: mockMessageError, success: vi.fn() }))
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const mountBatchCreate = async (options: Record<string, unknown>) => {
    const { default: BatchCreate } = await import('../../views/admin/BatchCreate.vue')
    const i18n = createI18n({ legacy: false, locale: 'en', messages: I18N_MESSAGES })
    const app = createApp({
      render: () => h(BatchCreate, {
        options,
        addressRegex: /[^a-z0-9]/g,
        disabled: false,
      }),
    })
    app.use(i18n)
    app.component('BatchExportModal', stubComponent('div'))
    app.component('n-form-item-row', stubComponent('div'))
    app.component('n-input-number', stubComponent('input'))
    app.component('n-button', stubComponent('button', true))
    app.component('n-alert', defineComponent({
      name: 'NAlert',
      render() {
        return h('div', { 'data-testid': 'batch-alert' }, this.$slots.default?.())
      },
    }))
    app.component('n-space', stubComponent('div'))
    app.mount(container)
    await nextTick()
    return app
  }

  it('rejects empty or stale custom expiresAt without calling /admin/new_address', async () => {
    const appEmpty = await mountBatchCreate({
      enablePrefix: true,
      enableRandomSubdomain: false,
      domain: 'example.com',
      expiresAt: '',
    })
    const createBtnEmpty = Array.from(container.querySelectorAll('button'))
      .find((btn) => btn.textContent?.includes('Create batch'))!
    createBtnEmpty.click()
    await nextTick()

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(mockMessageError).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Please select a valid future expiration date & time')
    appEmpty.unmount()

    const staleTime = new Date(Date.now() + 30_000).toISOString()
    vi.advanceTimersByTime(60_000)

    const appStale = await mountBatchCreate({
      enablePrefix: true,
      enableRandomSubdomain: false,
      domain: 'example.com',
      expiresAt: staleTime,
    })
    const createBtnStale = Array.from(container.querySelectorAll('button'))
      .find((btn) => btn.textContent?.includes('Create batch'))!
    createBtnStale.click()
    await nextTick()

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(mockMessageError).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Please select a valid future expiration date & time')
    appStale.unmount()
  })

  it('stops mid-batch if custom expiresAt becomes stale during execution', async () => {
    const expiresInTwoSeconds = new Date(Date.now() + 2_000).toISOString()
    mockApiFetch.mockImplementationOnce(async () => {
      vi.advanceTimersByTime(5_000)
      return { address: 'a@example.com', jwt: 'jwt-1' }
    })

    const app = await mountBatchCreate({
      enablePrefix: false,
      enableRandomSubdomain: false,
      domain: 'example.com',
      expiresAt: expiresInTwoSeconds,
    })
    const createBtn = Array.from(container.querySelectorAll('button'))
      .find((btn) => btn.textContent?.includes('Create batch'))!
    createBtn.click()
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Please select a valid future expiration date & time')
    })

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(mockApiFetch.mock.calls[0][1].body).toContain(expiresInTwoSeconds)
    app.unmount()
  })
})

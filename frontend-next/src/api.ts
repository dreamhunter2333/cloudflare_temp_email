const API_BASE = import.meta.env.VITE_API_BASE || ""

export type DomainOption = {
  label: string
  value: string
}

export type OpenSettings = {
  fetched: boolean
  title: string
  prefix: string
  addressRegex: string
  minAddressLen: number
  maxAddressLen: number
  needAuth: boolean
  enableUserCreateEmail: boolean
  disableAnonymousUserCreateEmail: boolean
  disableCustomAddressName: boolean
  enableUserDeleteEmail: boolean
  enableSendMail: boolean
  enableAddressPassword: boolean
  defaultDomains: string[]
  randomSubdomainDomains: string[]
  domains: DomainOption[]
  cfTurnstileSiteKey: string
  enableGlobalTurnstileCheck: boolean
}

export type AddressSettings = {
  fetched: boolean
  address: string
  send_balance: number
  auto_reply?: unknown
}

export type UserOpenSettings = {
  fetched: boolean
  enable: boolean
  enableMailVerify: boolean
  oauth2ClientIDs: { clientID: string; name: string; icon?: string }[]
}

export type UserSettings = {
  fetched: boolean
  user_email: string
  user_id: number
  is_admin: boolean
  access_token: string | null
  new_user_token: string | null
  user_role: { domains?: string[] | null; role: string; prefix?: string | null } | null
}

export type BoundAddress = {
  id: number | string
  name?: string
  address?: string
  mail_count?: number
  send_count?: number
}

export type MailItem = {
  id: number | string
  source?: string
  address?: string
  subject?: string
  sender?: string
  html?: string
  message?: string
  text?: string
  raw?: string
  created_at?: string
  metadata?: unknown
}

export type MailListResponse = {
  results: MailItem[]
  count: number
}

export type SendMailPayload = {
  from_name: string
  to_name: string
  to_mail: string
  subject: string
  is_html: boolean
  content: string
}

export const defaultOpenSettings: OpenSettings = {
  fetched: false,
  title: "",
  prefix: "",
  addressRegex: "",
  minAddressLen: 1,
  maxAddressLen: 30,
  needAuth: false,
  enableUserCreateEmail: false,
  disableAnonymousUserCreateEmail: false,
  disableCustomAddressName: false,
  enableUserDeleteEmail: false,
  enableSendMail: false,
  enableAddressPassword: false,
  defaultDomains: [],
  randomSubdomainDomains: [],
  domains: [],
  cfTurnstileSiteKey: "",
  enableGlobalTurnstileCheck: false,
}

export const defaultAddressSettings: AddressSettings = {
  fetched: false,
  address: "",
  send_balance: 0,
}

export const defaultUserOpenSettings: UserOpenSettings = {
  fetched: false,
  enable: false,
  enableMailVerify: false,
  oauth2ClientIDs: [],
}

export const defaultUserSettings: UserSettings = {
  fetched: false,
  user_email: "",
  user_id: 0,
  is_admin: false,
  access_token: null,
  new_user_token: null,
  user_role: null,
}

const hasControlChar = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

const safeHeaderValue = (value: string | null | undefined) => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined
  if (hasControlChar(trimmed)) return undefined
  return trimmed
}

const safeBearerHeader = (jwt: string | null | undefined) => {
  const safe = safeHeaderValue(jwt)
  return safe ? `Bearer ${safe}` : undefined
}

const normalizeOpenSettings = (payload: Record<string, unknown>): OpenSettings => {
  const domains = Array.isArray(payload.domains) ? (payload.domains as string[]) : []
  const domainLabels = Array.isArray(payload.domainLabels) ? (payload.domainLabels as string[]) : []
  return {
    ...defaultOpenSettings,
    fetched: true,
    title: String(payload.title || ""),
    prefix: String(payload.prefix || ""),
    addressRegex: String(payload.addressRegex || ""),
    minAddressLen: Number(payload.minAddressLen ?? 1),
    maxAddressLen: Number(payload.maxAddressLen ?? 30),
    needAuth: Boolean(payload.needAuth),
    enableUserCreateEmail: Boolean(payload.enableUserCreateEmail),
    disableAnonymousUserCreateEmail: Boolean(payload.disableAnonymousUserCreateEmail),
    disableCustomAddressName: Boolean(payload.disableCustomAddressName),
    enableUserDeleteEmail: Boolean(payload.enableUserDeleteEmail),
    enableSendMail: Boolean(payload.enableSendMail),
    enableAddressPassword: Boolean(payload.enableAddressPassword),
    defaultDomains: Array.isArray(payload.defaultDomains) ? (payload.defaultDomains as string[]) : [],
    randomSubdomainDomains: Array.isArray(payload.randomSubdomainDomains)
      ? (payload.randomSubdomainDomains as string[])
      : [],
    domains: domains.map((domain, index) => ({
      label: domainLabels[index] || domain,
      value: domain,
    })),
    cfTurnstileSiteKey: String(payload.cfTurnstileSiteKey || ""),
    enableGlobalTurnstileCheck: Boolean(payload.enableGlobalTurnstileCheck),
  }
}

export async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function parseJwtAddress(jwt: string) {
  try {
    const payload = JSON.parse(decodeURIComponent(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))
    return typeof payload.address === "string" ? payload.address : ""
  } catch {
    return ""
  }
}

export function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(`${value} UTC`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export class ApiClient {
  constructor(
    private readonly getJwt: () => string,
    private readonly getCustomAuth: () => string,
    private readonly getUserJwt: () => string,
  ) {}

  async request<T>(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-lang": "en",
    }
    const customAuth = safeHeaderValue(this.getCustomAuth())
    const userJwt = safeHeaderValue(this.getUserJwt())
    const authorization = safeBearerHeader(this.getJwt())
    if (customAuth) headers["x-custom-auth"] = customAuth
    if (userJwt) headers["x-user-token"] = userJwt
    if (authorization) headers.Authorization = authorization

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    })
    const text = await response.text()
    const data = text ? tryParseJson(text) : null
    if (response.status >= 300) {
      throw new Error(typeof data === "string" ? data : text || `[${response.status}] request failed`)
    }
    return data as T
  }

  async getOpenSettings() {
    return normalizeOpenSettings(await this.request<Record<string, unknown>>("/open_api/settings"))
  }

  async getSettings() {
    if (!safeHeaderValue(this.getJwt())) return { ...defaultAddressSettings, fetched: true }
    const payload = await this.request<Record<string, unknown>>("/api/settings")
    return {
      fetched: true,
      address: String(payload.address || ""),
      send_balance: Number(payload.send_balance || 0),
      auto_reply: payload.auto_reply,
    } satisfies AddressSettings
  }

  async getUserOpenSettings() {
    return {
      ...defaultUserOpenSettings,
      ...(await this.request<Partial<UserOpenSettings>>("/user_api/open_settings")),
      fetched: true,
    } satisfies UserOpenSettings
  }

  async getUserSettings() {
    if (!safeHeaderValue(this.getUserJwt())) return { ...defaultUserSettings, fetched: true }
    return {
      ...defaultUserSettings,
      ...(await this.request<Partial<UserSettings>>("/user_api/settings")),
      fetched: true,
    } satisfies UserSettings
  }

  async userLogin(email: string, password: string, cfToken: string) {
    const response = await this.request<{ jwt: string }>("/user_api/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: await hashPassword(password),
        cf_token: cfToken,
      }),
    })
    return response.jwt
  }

  async sendUserVerifyCode(email: string, cfToken: string) {
    return this.request<{ expirationTtl?: number }>("/user_api/verify_code", {
      method: "POST",
      body: JSON.stringify({ email, cf_token: cfToken }),
    })
  }

  async userRegister(email: string, password: string, code: string, cfToken: string) {
    await this.request("/user_api/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: await hashPassword(password),
        code,
        cf_token: cfToken,
      }),
    })
  }

  async listBoundAddresses() {
    const response = await this.request<{ results: BoundAddress[] }>("/user_api/bind_address")
    return response.results || []
  }

  async bindCurrentAddress() {
    await this.request("/user_api/bind_address", { method: "POST" })
  }

  async getBoundAddressJwt(addressId: string | number) {
    const response = await this.request<{ jwt: string }>(`/user_api/bind_address_jwt/${addressId}`)
    return response.jwt
  }

  async unbindAddress(addressId: string | number) {
    await this.request("/user_api/unbind_address", {
      method: "POST",
      body: JSON.stringify({ address_id: addressId }),
    })
  }

  async createAddress(name: string, domain: string, cfToken: string, enableRandomSubdomain: boolean) {
    return this.request<{ jwt: string; password?: string }>("/api/new_address", {
      method: "POST",
      body: JSON.stringify({
        name,
        domain,
        cf_token: cfToken,
        enableRandomSubdomain,
      }),
    })
  }

  async credentialLogin(credential: string, cfToken: string) {
    await this.request("/open_api/credential_login", {
      method: "POST",
      body: JSON.stringify({ credential, cf_token: cfToken }),
    })
    return credential
  }

  async passwordLogin(email: string, password: string, cfToken: string) {
    const response = await this.request<{ jwt: string }>("/api/address_login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: await hashPassword(password),
        cf_token: cfToken,
      }),
    })
    return response.jwt
  }

  async listMails(limit: number, offset: number) {
    return this.request<MailListResponse>(`/api/parsed_mails?limit=${limit}&offset=${offset}`)
  }

  async deleteMail(id: string | number) {
    await this.request(`/api/mails/${id}`, { method: "DELETE" })
  }

  async sendMail(payload: SendMailPayload) {
    await this.request("/api/send_mail", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async requestSendAccess() {
    await this.request("/api/request_send_mail_access", {
      method: "POST",
      body: JSON.stringify({}),
    })
  }

  async clearInbox() {
    await this.request("/api/clear_inbox", { method: "DELETE" })
  }

  async clearSentItems() {
    await this.request("/api/clear_sent_items", { method: "DELETE" })
  }

  async deleteAddress() {
    await this.request("/api/delete_address", { method: "DELETE" })
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

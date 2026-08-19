import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Archive,
  Check,
  Copy,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sun,
  Trash2,
} from "lucide-react"
import {
  ApiClient,
  defaultUserOpenSettings,
  defaultUserSettings,
  defaultAddressSettings,
  defaultOpenSettings,
  formatDate,
  parseJwtAddress,
  type BoundAddress,
  type AddressSettings,
  type MailItem,
  type OpenSettings,
  type SendMailPayload,
  type UserOpenSettings,
  type UserSettings,
} from "./api"
import { TurnstileWidget } from "./components/TurnstileWidget"
import { Alert, AlertDescription } from "./components/ui/alert"
import { Badge } from "./components/ui/badge"
import { Button } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Checkbox } from "./components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs"
import { Textarea } from "./components/ui/textarea"
import { cn } from "./lib/utils"

type Screen = "inbox" | "compose" | "addresses" | "settings"
type Notice = { type: "success" | "error"; text: string } | null

const PAGE_SIZE = 20

function App() {
  const [screen, setScreen] = useState<Screen>("inbox")
  const [theme, setTheme] = useLocalStorageState<"light" | "dark">("frontendNextTheme", "light")
  const [jwt, setJwt] = useLocalStorageState("jwt", "")
  const [userJwt, setUserJwt] = useLocalStorageState("userJwt", "")
  const [customAuth, setCustomAuth] = useLocalStorageState("auth", "")
  const [localCache, setLocalCache] = useLocalStorageArray("LocalAddressCache")
  const [openSettings, setOpenSettings] = useState<OpenSettings>(defaultOpenSettings)
  const [settings, setSettings] = useState<AddressSettings>(defaultAddressSettings)
  const [userOpenSettings, setUserOpenSettings] = useState<UserOpenSettings>(defaultUserOpenSettings)
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultUserSettings)
  const [boundAddresses, setBoundAddresses] = useState<BoundAddress[]>([])
  const [mails, setMails] = useState<MailItem[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorageState<string>("frontendNextSidebarCollapsed", "false")
  const isSidebarCollapsed = sidebarCollapsed === "true"

  const api = useMemo(() => new ApiClient(() => jwt, () => customAuth, () => userJwt), [customAuth, jwt, userJwt])
  const selected = mails.find((mail) => String(mail.id) === selectedId) ?? mails[0] ?? null
  const address = settings.address || parseJwtAddress(jwt)
  const hasAddress = Boolean(settings.address)

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice)
    if (nextNotice) window.setTimeout(() => setNotice(null), 3200)
  }, [])

  const loadOpenSettings = useCallback(async () => {
    const nextOpenSettings = await api.getOpenSettings()
    setOpenSettings(nextOpenSettings)
  }, [api])

  const loadSettings = useCallback(async () => {
    const nextSettings = await api.getSettings()
    setSettings(nextSettings)
    if (nextSettings.address && jwt && !localCache.includes(jwt)) {
      setLocalCache([jwt, ...localCache])
    }
  }, [api, jwt, localCache, setLocalCache])

  const loadUserOpenSettings = useCallback(async () => {
    const nextUserOpenSettings = await api.getUserOpenSettings()
    setUserOpenSettings(nextUserOpenSettings)
  }, [api])

  const loadUserSettings = useCallback(async () => {
    const nextUserSettings = await api.getUserSettings()
    setUserSettings(nextUserSettings)
    if (nextUserSettings.new_user_token) {
      setUserJwt(nextUserSettings.new_user_token)
    }
  }, [api, setUserJwt])

  const loadBoundAddresses = useCallback(async () => {
    if (!userJwt) {
      setBoundAddresses([])
      return
    }
    setBoundAddresses(await api.listBoundAddresses())
  }, [api, userJwt])

  const refreshMails = useCallback(async () => {
    if (!settings.address) return
    setLoading(true)
    try {
      const response = await api.listMails(PAGE_SIZE, (page - 1) * PAGE_SIZE)
      const results = response.results || []
      setMails(results)
      setTotalCount(Number(response.count || results.length))
      setSelectedId((current) => {
        if (results.some((mail) => String(mail.id) === current)) return current
        return results[0] ? String(results[0].id) : ""
      })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }, [api, page, settings.address, showNotice])

  useEffect(() => {
    loadOpenSettings().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))
  }, [loadOpenSettings, showNotice])

  useEffect(() => {
    loadUserOpenSettings().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))
  }, [loadUserOpenSettings, showNotice])

  useEffect(() => {
    loadSettings().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))
  }, [loadSettings, showNotice])

  useEffect(() => {
    loadUserSettings().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))
  }, [loadUserSettings, showNotice])

  useEffect(() => {
    loadBoundAddresses().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))
  }, [loadBoundAddresses, showNotice])

  useEffect(() => {
    refreshMails()
  }, [refreshMails])

  const switchJwt = (nextJwt: string) => {
    setJwt(nextJwt)
    setScreen("inbox")
    setMails([])
    setSelectedId("")
    setSettings(defaultAddressSettings)
  }

  const logout = () => {
    setJwt("")
    setSettings({ ...defaultAddressSettings, fetched: true })
    setMails([])
    setSelectedId("")
  }

  return (
    <div className={cn("style-b", theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        {notice && <NoticeToast notice={notice} />}
        <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>User account</DialogTitle>
              <DialogDescription>
                Optional login for binding and syncing mailbox addresses. Mail and send access stay with each address.
              </DialogDescription>
            </DialogHeader>
            <UserAccountPanel
              api={api}
              boundAddresses={boundAddresses}
              openSettings={openSettings}
              setJwt={switchJwt}
              setUserJwt={setUserJwt}
              showNotice={showNotice}
              theme={theme}
              userJwt={userJwt}
              userOpenSettings={userOpenSettings}
              userSettings={userSettings}
              reloadUser={async () => {
                await loadUserSettings()
                await loadBoundAddresses()
              }}
            />
          </DialogContent>
        </Dialog>
        {!hasAddress ? (
          <AuthScreen
            api={api}
            customAuth={customAuth}
            openSettings={openSettings}
            setCustomAuth={setCustomAuth}
            setJwt={switchJwt}
            theme={theme}
            showNotice={showNotice}
            reloadSettings={loadSettings}
            onOpenUser={() => setShowUserDialog(true)}
            sidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setSidebarCollapsed(isSidebarCollapsed ? "false" : "true")}
            userEmail={userSettings.user_email}
          />
        ) : (
          <div className="mail-shell">
            <Sidebar
              screen={screen}
              setScreen={setScreen}
              unread={totalCount}
              loading={loading}
              refresh={refreshMails}
              collapsed={isSidebarCollapsed}
              toggleCollapsed={() => setSidebarCollapsed(isSidebarCollapsed ? "false" : "true")}
              userEmail={userSettings.user_email}
              onOpenUser={() => setShowUserDialog(true)}
            />
            <main className="mail-main">
              <header className="mail-topbar">
                <AddressPill address={address} showNotice={showNotice} />
                <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setScreen("addresses")}>
                  <Plus className="size-4" />
                  New address
                </Button>
                <div className="mail-search">
                  <Search className="size-4 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mail" />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  aria-label="Toggle theme"
                >
                  {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </Button>
              </header>

              {screen === "inbox" && (
                <section className="inbox-grid">
                  <MailList
                    loading={loading}
                    mails={filterMails(mails, search)}
                    page={page}
                    selectedId={selectedId}
                    totalCount={totalCount}
                    onNextPage={() => setPage((current) => current + 1)}
                    onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
                    onRefresh={refreshMails}
                    onSelect={setSelectedId}
                  />
                  <MessageReader
                    mail={selected}
                    address={address}
                    canDelete={openSettings.enableUserDeleteEmail}
                    onDelete={async (mail) => {
                      await api.deleteMail(mail.id)
                      showNotice({ type: "success", text: "Mail deleted" })
                      await refreshMails()
                    }}
                    showNotice={showNotice}
                  />
                </section>
              )}
              {screen === "compose" && (
                <Compose
                  address={address}
                  api={api}
                  sendBalance={settings.send_balance}
                  sendEnabled={openSettings.enableSendMail}
                  reloadSettings={loadSettings}
                  showNotice={showNotice}
                />
              )}
              {screen === "addresses" && (
                <AddressStack
                  currentJwt={jwt}
                  localCache={localCache}
                  boundAddresses={boundAddresses}
                  userEmail={userSettings.user_email}
                  openSettings={openSettings}
                  api={api}
                  setJwt={switchJwt}
                  setLocalCache={setLocalCache}
                  showNotice={showNotice}
                  reloadBoundAddresses={loadBoundAddresses}
                  onCreateNew={() => logout()}
                />
              )}
              {screen === "settings" && (
                <SettingsPanel
                  address={address}
                  canDelete={openSettings.enableUserDeleteEmail}
                  canSend={openSettings.enableSendMail}
                  customAuth={customAuth}
                  enablePassword={openSettings.enableAddressPassword}
                  jwt={jwt}
                  userEmail={userSettings.user_email}
                  userJwt={userJwt}
                  setCustomAuth={setCustomAuth}
                  setUserJwt={setUserJwt}
                  theme={theme}
                  setTheme={setTheme}
                  onClearInbox={async () => {
                    await api.clearInbox()
                    await refreshMails()
                    showNotice({ type: "success", text: "Inbox cleared" })
                  }}
                  onClearSentItems={async () => {
                    await api.clearSentItems()
                    showNotice({ type: "success", text: "Sent items cleared" })
                  }}
                  onDeleteAddress={async () => {
                    await api.deleteAddress()
                    logout()
                    showNotice({ type: "success", text: "Address deleted" })
                  }}
                  onLogout={logout}
                  showNotice={showNotice}
                />
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

function AuthScreen({
  api,
  customAuth,
  openSettings,
  setCustomAuth,
  setJwt,
  theme,
  showNotice,
  reloadSettings,
  onOpenUser,
  sidebarCollapsed,
  toggleSidebar,
  userEmail,
}: {
  api: ApiClient
  customAuth: string
  openSettings: OpenSettings
  setCustomAuth: (value: string) => void
  setJwt: (jwt: string) => void
  theme: "light" | "dark"
  showNotice: (notice: Notice) => void
  reloadSettings: () => Promise<void>
  onOpenUser: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  userEmail: string
}) {
  const [showRestore, setShowRestore] = useState(false)
  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [credential, setCredential] = useState("")
  const [loginMode, setLoginMode] = useState<"credential" | "password">("credential")
  const [loginAddress, setLoginAddress] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [createToken, setCreateToken] = useState("")
  const [loginToken, setLoginToken] = useState("")
  const [randomSubdomain, setRandomSubdomain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generateNameLoading, setGenerateNameLoading] = useState(false)

  const domains = useMemo(() => {
    if (!openSettings.defaultDomains.length) return openSettings.domains
    return openSettings.domains.filter((item) => openSettings.defaultDomains.includes(item.value))
  }, [openSettings.defaultDomains, openSettings.domains])

  useEffect(() => {
    if (!domain && domains[0]) setDomain(domains[0].value)
  }, [domain, domains])

  const canUseRandomSubdomain = domain && openSettings.randomSubdomainDomains.includes(domain)

  const generateName = async () => {
    setGenerateNameLoading(true)
    try {
      const fakerModuleUrl = "https://esm.sh/@faker-js/faker"
      const module = (await import(/* @vite-ignore */ fakerModuleUrl)) as {
        faker: { internet: { email: () => string } }
      }
      const nextName = module.faker.internet
        .email()
        .split("@")[0]
        .replace(/\s+/g, ".")
        .replace(/\.{2,}/g, ".")
      setName(normalizeAddressName(nextName, openSettings.addressRegex).slice(0, openSettings.maxAddressLen))
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setGenerateNameLoading(false)
    }
  }

  const createAddress = async () => {
    if (!domain) {
      showNotice({ type: "error", text: "No domain is available" })
      return
    }
    setBusy(true)
    try {
      const response = await api.createAddress(openSettings.disableCustomAddressName ? "" : name, domain, createToken, randomSubdomain)
      setJwt(response.jwt)
      await reloadSettings()
      showNotice({ type: "success", text: response.password ? `Address created. Password: ${response.password}` : "Address created" })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const restoreAddress = async () => {
    setBusy(true)
    try {
      const nextJwt =
        loginMode === "password"
          ? await api.passwordLogin(loginAddress, loginPassword, loginToken)
          : await api.credentialLogin(credential.trim(), loginToken)
      setJwt(nextJwt)
      await reloadSettings()
      showNotice({ type: "success", text: "Address restored" })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <aside className={cn("mail-sidebar auth-sidebar", sidebarCollapsed && "collapsed")}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Mail className="size-5" />
          </span>
          <span className="sidebar-label">{openSettings.title || "Temp Email"}</span>
          <Button className="sidebar-toggle" variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
        <nav className="sidebar-nav" />
        <Button variant="ghost" className="sidebar-session mt-3 h-auto justify-start" onClick={onOpenUser}>
          <span className="session-avatar">{userEmail ? userEmail.slice(0, 2).toUpperCase() : "U"}</span>
          <span className="sidebar-label min-w-0 flex-1 text-left">
            <span className="block truncate text-xs font-semibold">{userEmail || "User login"}</span>
            <span className="block text-[11px] text-muted-foreground">{userEmail ? "Account settings" : "Sync addresses"}</span>
          </span>
        </Button>
      </aside>

      <section className="auth-main">
        <div className="auth-stage">
          <div className="auth-card">
            <div className="auth-card-head">
              <Badge variant="secondary">Address studio</Badge>
              <div>
                <h1>Create a disposable inbox</h1>
                <p>
                  {domains.length > 0
                    ? `${domains.length} domain${domains.length > 1 ? "s" : ""} available`
                    : "Waiting for domain settings"}
                </p>
              </div>
            </div>

            {openSettings.needAuth && (
              <div className="auth-access">
                <Input
                  value={customAuth}
                  onChange={(event) => setCustomAuth(event.target.value)}
                  placeholder="Access password"
                  type="password"
                />
              </div>
            )}

            <div className="auth-form">
              <Label htmlFor="address-name">Choose your address</Label>
              <div className="address-builder">
                {openSettings.prefix && <span>{openSettings.prefix}</span>}
                <Input
                  id="address-name"
                  name="addressName"
                  disabled={openSettings.disableCustomAddressName}
                  value={name}
                  maxLength={openSettings.maxAddressLen || undefined}
                  minLength={openSettings.minAddressLen || undefined}
                  onChange={(event) => setName(normalizeAddressName(event.target.value, openSettings.addressRegex))}
                  placeholder={openSettings.disableCustomAddressName ? "auto generated" : "quiet-forest-4821"}
                />
                <span>@</span>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger className="min-w-[128px] border-0 bg-transparent px-0 shadow-none">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="auth-inline-actions">
                <Button variant="secondary" onClick={generateName} disabled={openSettings.disableCustomAddressName || generateNameLoading}>
                  {generateNameLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Generate name
                </Button>
                <Button variant="ghost" onClick={() => setShowRestore(true)}>
                  Restore existing
                </Button>
              </div>

              {canUseRandomSubdomain && (
                <Label className="checkbox-line">
                  <Checkbox
                    checked={randomSubdomain}
                    onCheckedChange={(checked) => setRandomSubdomain(checked === true)}
                  />
                  Use random subdomain
                </Label>
              )}
              <TurnstileWidget siteKey={openSettings.cfTurnstileSiteKey} theme={theme} onToken={setCreateToken} />
              <Button className="auth-submit" onClick={createAddress} disabled={busy || !openSettings.enableUserCreateEmail || !domain}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create address
              </Button>
            </div>
          </div>

          <div className="auth-context">
            <Card className="context-card">
              <CardHeader>
                <CardTitle>User account</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="context-row">
                  <span className="session-avatar">{userEmail ? userEmail.slice(0, 2).toUpperCase() : "U"}</span>
                  <div>
                    <strong>{userEmail || "Not signed in"}</strong>
                    <p>
                      {userEmail
                        ? "Manage addresses bound to this account."
                        : "Optional login for binding and syncing mailbox addresses."}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={onOpenUser}>
                  {userEmail ? "Manage account" : "User login"}
                </Button>
              </CardContent>
            </Card>

            <Card className="context-card">
              <CardHeader>
                <CardTitle>Restore address</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Use an address credential or password when you already have a mailbox.</p>
                <Button variant="secondary" className="w-full" onClick={() => setShowRestore(true)}>
                  Restore
                </Button>
              </CardContent>
            </Card>

            <div className="auth-note">
              <span />
              <p>Mailbox addresses receive mail independently. A user account only helps sync and manage them.</p>
            </div>
          </div>
        </div>
      </section>
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore address</DialogTitle>
            <DialogDescription>Paste a credential or use an address password.</DialogDescription>
          </DialogHeader>
          <div className="auth-form">
          {openSettings.enableAddressPassword && (
            <Tabs value={loginMode} onValueChange={(value) => setLoginMode(value as "credential" | "password")}>
              <TabsList className="w-full rounded-full">
                <TabsTrigger className="rounded-full" value="credential">
                  Credential
                </TabsTrigger>
                <TabsTrigger className="rounded-full" value="password">
                  Password
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {loginMode === "credential" ? (
            <Textarea
              className="min-h-[116px]"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder="Paste address credential"
            />
          ) : (
            <>
              <Input value={loginAddress} onChange={(event) => setLoginAddress(event.target.value)} placeholder="name@example.com" />
              <Input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Password"
                type="password"
              />
            </>
          )}
          {openSettings.enableGlobalTurnstileCheck && (
            <TurnstileWidget siteKey={openSettings.cfTurnstileSiteKey} theme={theme} onToken={setLoginToken} />
          )}
          <Button onClick={restoreAddress} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Restore address
          </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function Sidebar({
  screen,
  setScreen,
  unread,
  loading,
  refresh,
  collapsed,
  toggleCollapsed,
  userEmail,
  onOpenUser,
}: {
  screen: Screen
  setScreen: (screen: Screen) => void
  unread: number
  loading: boolean
  refresh: () => void
  collapsed: boolean
  toggleCollapsed: () => void
  userEmail: string
  onOpenUser: () => void
}) {
  return (
    <aside className={cn("mail-sidebar", collapsed && "collapsed")}>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Mail className="size-5" />
        </span>
        <span className="sidebar-label">Temp Email</span>
        <Button className="sidebar-toggle" variant="ghost" size="icon" onClick={toggleCollapsed} aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      <Button className="mb-3 w-full" onClick={() => setScreen("addresses")}>
        <Plus className="size-4" />
        <span className="sidebar-label">New address</span>
      </Button>
      <nav className="sidebar-nav">
        <NavItem active={screen === "inbox"} onClick={() => setScreen("inbox")} icon={<Inbox className="size-4" />}>
          <span className="sidebar-label">Inbox</span>
          <Badge className="sidebar-label ml-auto bg-primary text-primary-foreground">{unread}</Badge>
        </NavItem>
        <NavItem active={screen === "compose"} onClick={() => setScreen("compose")} icon={<Pencil className="size-4" />}>
          <span className="sidebar-label">Compose</span>
        </NavItem>
        <NavItem
          active={screen === "addresses"}
          onClick={() => setScreen("addresses")}
          icon={<Mail className="size-4" />}
        >
          <span className="sidebar-label">Addresses</span>
        </NavItem>
        <NavItem
          active={screen === "settings"}
          onClick={() => setScreen("settings")}
          icon={<Settings className="size-4" />}
        >
          <span className="sidebar-label">Settings</span>
        </NavItem>
      </nav>
      <Button variant="outline" onClick={refresh} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        <span className="sidebar-label">Refresh</span>
      </Button>
      <Button variant="ghost" className="sidebar-session mt-3 h-auto justify-start" onClick={onOpenUser}>
        <span className="session-avatar">{userEmail ? userEmail.slice(0, 2).toUpperCase() : "U"}</span>
        <span className="sidebar-label min-w-0 flex-1 text-left">
          <span className="block truncate text-xs font-semibold">{userEmail || "User login"}</span>
          <span className="block text-[11px] text-muted-foreground">{userEmail ? "Account settings" : "Sync addresses"}</span>
        </span>
      </Button>
    </aside>
  )
}

function UserAccountPanel({
  api,
  boundAddresses,
  openSettings,
  setJwt,
  setUserJwt,
  showNotice,
  theme,
  userJwt,
  userOpenSettings,
  userSettings,
  reloadUser,
}: {
  api: ApiClient
  boundAddresses: BoundAddress[]
  openSettings: OpenSettings
  setJwt: (jwt: string) => void
  setUserJwt: (jwt: string) => void
  showNotice: (notice: Notice) => void
  theme: "light" | "dark"
  userJwt: string
  userOpenSettings: UserOpenSettings
  userSettings: UserSettings
  reloadUser: () => Promise<void>
}) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [cfToken, setCfToken] = useState("")
  const [busy, setBusy] = useState(false)

  const login = async () => {
    setBusy(true)
    try {
      const nextUserJwt = await api.userLogin(email, password, cfToken)
      setUserJwt(nextUserJwt)
      showNotice({ type: "success", text: "User logged in" })
      await reloadUser()
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const register = async () => {
    setBusy(true)
    try {
      await api.userRegister(email, password, code, cfToken)
      setMode("login")
      showNotice({ type: "success", text: "Registration complete. Please log in." })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const sendCode = async () => {
    setBusy(true)
    try {
      const response = await api.sendUserVerifyCode(email, cfToken)
      showNotice({ type: "success", text: `Verification code sent${response.expirationTtl ? ` for ${response.expirationTtl}s` : ""}` })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  if (userJwt && userSettings.user_email) {
    return (
      <div className="auth-form">
        <Card>
          <CardContent className="grid gap-4 p-5">
            <div>
              <div className="font-semibold">{userSettings.user_email}</div>
              <div className="text-sm text-muted-foreground">Signed-in user account · addresses keep separate mail and send access</div>
            </div>
            <div className="grid gap-2">
              {boundAddresses.length === 0 && <p className="text-sm text-muted-foreground">No bound addresses yet.</p>}
              {boundAddresses.map((item) => {
                const address = item.address || item.name || String(item.id)
                return (
                  <Button
                    key={item.id}
                    variant="outline"
                    className="justify-between"
                    onClick={async () => {
                      const nextJwt = await api.getBoundAddressJwt(item.id)
                      setJwt(nextJwt)
                    }}
                  >
                    <span className="truncate font-mono">{address}</span>
                    <Badge variant="secondary">{item.mail_count ?? 0}</Badge>
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setUserJwt("")
                showNotice({ type: "success", text: "User logged out" })
              }}
            >
              Log out user
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="auth-form">
      <Tabs value={mode} onValueChange={(value) => setMode(value as "login" | "register")}>
        <TabsList className="w-full rounded-full">
          <TabsTrigger className="rounded-full" value="login">
            Login
          </TabsTrigger>
          {userOpenSettings.enable && (
            <TabsTrigger className="rounded-full" value="register">
              Register
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" />
      <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
      {mode === "register" && userOpenSettings.enableMailVerify && (
        <div className="verify-row">
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Verification code" />
          <Button variant="outline" onClick={sendCode} disabled={busy || !email}>
            Send code
          </Button>
        </div>
      )}
      {(mode === "login" ? openSettings.enableGlobalTurnstileCheck : userOpenSettings.enableMailVerify) && (
        <TurnstileWidget siteKey={openSettings.cfTurnstileSiteKey} theme={theme} onToken={setCfToken} />
      )}
      <Button onClick={mode === "login" ? login : register} disabled={busy || !email || !password}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "login" ? "Login" : "Register"}
      </Button>
    </div>
  )
}

function NavItem({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button variant="ghost" className={cn("nav-item", active && "active")} onClick={onClick}>
      {icon}
      {children}
    </Button>
  )
}

function AddressPill({ address, showNotice }: { address: string; showNotice: (notice: Notice) => void }) {
  const [copied, setCopied] = useState(false)
  const copyAddress = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    showNotice({ type: "success", text: "Address copied" })
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="address-pill">
      <span className="status-dot" />
      <span className="min-w-0 truncate font-mono text-[13.5px] font-semibold">{address}</span>
      <Button variant="ghost" size="icon" onClick={copyAddress} aria-label="Copy address">
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

function MailList({
  loading,
  mails,
  page,
  selectedId,
  totalCount,
  onNextPage,
  onPrevPage,
  onRefresh,
  onSelect,
}: {
  loading: boolean
  mails: MailItem[]
  page: number
  selectedId: string
  totalCount: number
  onNextPage: () => void
  onPrevPage: () => void
  onRefresh: () => void
  onSelect: (id: string) => void
}) {
  const canNext = totalCount > page * PAGE_SIZE
  return (
    <section className="mail-list">
      <div className="list-heading">
        <div>
          <h2>Inbox</h2>
          <span>{totalCount} messages</span>
        </div>
        <div className="list-actions">
          <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      <div className="list-scroll">
        {mails.length === 0 && <div className="empty-state">{loading ? "Loading mail..." : "No mail yet"}</div>}
        {mails.map((mail) => (
          <Button
            variant="ghost"
            key={mail.id}
            className={cn("mail-row h-auto justify-start rounded-none", String(mail.id) === selectedId && "selected")}
            onClick={() => onSelect(String(mail.id))}
          >
            <span className="sender-avatar">{senderInitials(mail.source)}</span>
            <span className="min-w-0 flex-1">
              <span className="mail-row-top">
                <span className="truncate font-bold">{senderName(mail.source)}</span>
                <span className="time">{formatDate(mail.created_at)}</span>
              </span>
              <span className="subject">{mail.subject || "No Subject"}</span>
              <span className="preview">{mail.text || stripHtml(mail.message) || mail.raw || ""}</span>
            </span>
          </Button>
        ))}
      </div>
      <div className="pager">
        <Button variant="outline" size="sm" onClick={onPrevPage} disabled={page <= 1}>
          Prev
        </Button>
        <span>Page {page}</span>
        <Button variant="outline" size="sm" onClick={onNextPage} disabled={!canNext}>
          Next
        </Button>
      </div>
    </section>
  )
}

function MessageReader({
  mail,
  address,
  canDelete,
  onDelete,
  showNotice,
}: {
  mail: MailItem | null
  address: string
  canDelete: boolean
  onDelete: (mail: MailItem) => Promise<void>
  showNotice: (notice: Notice) => void
}) {
  if (!mail) {
    return (
      <section className="reader empty-reader">
        <Inbox className="size-5" />
        <span>Select a message</span>
      </section>
    )
  }

  const body = mail.message || mail.text || mail.raw || ""
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body)

  return (
    <section className="reader">
      <div className="reader-toolbar">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Archive">
            <Archive className="size-4" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={() => onDelete(mail).catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="reader-body">
        <div className="reader-meta">
          <span className="sender-avatar large">{senderInitials(mail.source)}</span>
          <div className="min-w-0">
            <h1>{mail.subject || "No Subject"}</h1>
            <p>{mail.source || "Unknown sender"}</p>
            <p className="text-xs text-muted-foreground">
              to <span className="font-mono">{address}</span> · {formatDate(mail.created_at)}
            </p>
          </div>
        </div>
        <Card className="message-card">
          <CardContent className="p-6">
            {isHtml ? (
              <iframe className="message-frame" title={`mail-${mail.id}`} sandbox="" srcDoc={body} />
            ) : (
              <pre className="message-text">{body}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function Compose({
  address,
  api,
  sendBalance,
  sendEnabled,
  reloadSettings,
  showNotice,
}: {
  address: string
  api: ApiClient
  sendBalance: number
  sendEnabled: boolean
  reloadSettings: () => Promise<void>
  showNotice: (notice: Notice) => void
}) {
  const [payload, setPayload] = useState<SendMailPayload>({
    from_name: "",
    to_name: "",
    to_mail: "",
    subject: "",
    is_html: false,
    content: "",
  })
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!payload.subject.trim() || !payload.to_mail.trim() || !payload.content.trim()) {
      showNotice({ type: "error", text: "Recipient, subject, and content are required" })
      return
    }
    setBusy(true)
    try {
      await api.sendMail(payload)
      setPayload({ from_name: "", to_name: "", to_mail: "", subject: "", is_html: false, content: "" })
      await reloadSettings()
      showNotice({ type: "success", text: "Mail sent" })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const requestAccess = async () => {
    setBusy(true)
    try {
      await api.requestSendAccess()
      await reloadSettings()
      showNotice({ type: "success", text: "Send access requested" })
    } catch (error) {
      showNotice({ type: "error", text: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  if (!sendEnabled) {
    return (
      <section className="page-panel">
        <h1>Send mail</h1>
        <p>Sending mail is not enabled on this deployment.</p>
      </section>
    )
  }

  if (sendBalance <= 0) {
    return (
      <section className="page-panel">
        <h1>Send mail</h1>
        <Card className="mt-6 max-w-[720px]">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Send access and balance belong to this mailbox address, not your user account. Request access for {address}.
            </p>
            <Button className="mt-5" onClick={requestAccess} disabled={busy}>
              Request access for this address
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="page-panel">
      <h1>New message</h1>
      <p>Send mail directly from your temporary address. Balance: {sendBalance}</p>
      <Card className="mt-6 overflow-hidden">
        <div className="compose-row">
          <span>From</span>
          <Input value={payload.from_name} onChange={(event) => setPayload({ ...payload, from_name: event.target.value })} placeholder="Display name" />
          <Badge className="font-mono">{address}</Badge>
        </div>
        <div className="compose-row">
          <span>To</span>
          <Input value={payload.to_name} onChange={(event) => setPayload({ ...payload, to_name: event.target.value })} placeholder="Name" />
          <Input value={payload.to_mail} onChange={(event) => setPayload({ ...payload, to_mail: event.target.value })} placeholder="name@example.com" />
        </div>
        <div className="compose-row">
          <span>Subject</span>
          <Input value={payload.subject} onChange={(event) => setPayload({ ...payload, subject: event.target.value })} placeholder="Subject" />
        </div>
        <Label className="compose-html">
          <Checkbox
            checked={payload.is_html}
            onCheckedChange={(checked) => setPayload({ ...payload, is_html: checked === true })}
          />
          Send as HTML
        </Label>
        <Textarea
          className="compose-body"
          value={payload.content}
          onChange={(event) => setPayload({ ...payload, content: event.target.value })}
          placeholder="Write your message..."
        />
        <div className="compose-actions">
          <Button onClick={send} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
          <Button variant="outline" onClick={() => setPayload({ ...payload, content: "" })}>
            Discard
          </Button>
        </div>
      </Card>
    </section>
  )
}

function AddressStack({
  currentJwt,
  localCache,
  boundAddresses,
  userEmail,
  openSettings,
  api,
  setJwt,
  setLocalCache,
  showNotice,
  reloadBoundAddresses,
  onCreateNew,
}: {
  currentJwt: string
  localCache: string[]
  boundAddresses: BoundAddress[]
  userEmail: string
  openSettings: OpenSettings
  api: ApiClient
  setJwt: (jwt: string) => void
  setLocalCache: (cache: string[]) => void
  showNotice: (notice: Notice) => void
  reloadBoundAddresses: () => Promise<void>
  onCreateNew: () => void
}) {
  const addresses = localCache
    .map((cachedJwt) => ({ jwt: cachedJwt, address: parseJwtAddress(cachedJwt) }))
    .filter((item) => item.address)

  return (
    <section className="page-panel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Your addresses</h1>
          <p>Each mailbox address has its own inbox, credential, and send access. User accounts only bind and sync addresses.</p>
        </div>
        <div className="flex gap-2">
          {userEmail && currentJwt && (
            <Button
              variant="outline"
              onClick={async () => {
                await api.bindCurrentAddress()
                await reloadBoundAddresses()
                showNotice({ type: "success", text: "Address bound to user" })
              }}
            >
              Bind current
            </Button>
          )}
          <Button onClick={onCreateNew}>
            <Plus className="size-4" />
            New address
          </Button>
        </div>
      </div>
      {!openSettings.enableUserCreateEmail && (
        <p className="mt-6 text-sm text-muted-foreground">Anonymous address creation is disabled on this deployment.</p>
      )}
      <div className="mt-6 grid gap-3">
        {userEmail && boundAddresses.length > 0 && (
          <div className="address-section-title">Addresses bound to your user account</div>
        )}
        {boundAddresses.map((item) => {
          const address = item.address || item.name || String(item.id)
          return (
            <Card
              key={item.id}
              className="address-card"
              onClick={async () => {
                const nextJwt = await api.getBoundAddressJwt(item.id)
                setJwt(nextJwt)
              }}
              role="button"
              tabIndex={0}
            >
              <span className="address-icon">
                <Mail className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-sm font-semibold">{address}</span>
                  <Badge variant="secondary">{item.mail_count ?? 0}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">Bound to {userEmail}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Unbind"
                onClick={async (event) => {
                  event.stopPropagation()
                  await api.unbindAddress(item.id)
                  await reloadBoundAddresses()
                  showNotice({ type: "success", text: "Address unbound" })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          )
        })}
        {addresses.length > 0 && <div className="address-section-title">Local addresses</div>}
        {addresses.map((item) => (
          <Card
            key={item.jwt}
            className={cn("address-card", item.jwt === currentJwt && "active")}
            onClick={() => setJwt(item.jwt)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setJwt(item.jwt)
            }}
          >
            <span className="address-icon">
              <Mail className="size-5" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-sm font-semibold">{item.address}</span>
                {item.jwt === currentJwt && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">Local credential</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={(event) => {
                event.stopPropagation()
                if (item.jwt === currentJwt) {
                  showNotice({ type: "error", text: "Switch away before removing the active address" })
                  return
                }
                setLocalCache(localCache.filter((cachedJwt) => cachedJwt !== item.jwt))
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}

function SettingsPanel({
  address,
  canDelete,
  canSend,
  customAuth,
  enablePassword,
  jwt,
  userEmail,
  userJwt,
  setCustomAuth,
  setUserJwt,
  theme,
  setTheme,
  onClearInbox,
  onClearSentItems,
  onDeleteAddress,
  onLogout,
  showNotice,
}: {
  address: string
  canDelete: boolean
  canSend: boolean
  customAuth: string
  enablePassword: boolean
  jwt: string
  userEmail: string
  userJwt: string
  setCustomAuth: (value: string) => void
  setUserJwt: (value: string) => void
  theme: "light" | "dark"
  setTheme: (theme: "light" | "dark") => void
  onClearInbox: () => Promise<void>
  onClearSentItems: () => Promise<void>
  onDeleteAddress: () => Promise<void>
  onLogout: () => void
  showNotice: (notice: Notice) => void
}) {
  return (
    <section className="page-panel max-w-[720px]">
      <h1>Settings</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="settings-row">
            <div>
              <div className="font-semibold">Theme</div>
              <div className="text-sm text-muted-foreground">Switch between light and dark.</div>
            </div>
            <Tabs value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")}>
              <TabsList className="rounded-full">
                <TabsTrigger className="rounded-full" value="light">
                  Light
                </TabsTrigger>
                <TabsTrigger className="rounded-full" value="dark">
                  Dark
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="settings-row">
            <div>
              <div className="font-semibold">{address}</div>
              <div className="text-sm text-muted-foreground">Current address credential.</div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(jwt)
                showNotice({ type: "success", text: "Credential copied" })
              }}
            >
              <Copy className="size-4" />
              Copy credential
            </Button>
          </div>
          {enablePassword && <p className="text-sm text-muted-foreground">Password changes are not implemented in this React preview yet.</p>}
          <div className="settings-row">
            <div>
              <div className="font-semibold">Access password</div>
              <div className="text-sm text-muted-foreground">Used when global access auth is enabled.</div>
            </div>
            <Input value={customAuth} onChange={(event) => setCustomAuth(event.target.value)} placeholder="Access password" type="password" />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>User account (optional)</CardTitle>
        </CardHeader>
        <CardContent className="settings-row">
          <div>
            <div className="font-semibold">{userEmail || "Not logged in"}</div>
            <div className="text-sm text-muted-foreground">
              {userJwt
                ? "This account binds and syncs mailbox addresses; it does not own inboxes or send access itself."
                : "Log in to bind and sync addresses. Each address remains an independent mailbox."}
            </div>
          </div>
          {userJwt && (
            <Button variant="outline" onClick={() => setUserJwt("")}>
              Log out user
            </Button>
          )}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="settings-actions">
          {canDelete && (
            <>
              <Button variant="outline" onClick={() => onClearInbox().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))}>
                Clear inbox
              </Button>
              {canSend && (
                <Button
                  variant="outline"
                  onClick={() => onClearSentItems().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))}
                >
                  Clear sent items
                </Button>
              )}
              <Button variant="outline" onClick={() => onDeleteAddress().catch((error) => showNotice({ type: "error", text: getErrorMessage(error) }))}>
                Delete address
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="size-4" />
            Log out
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function NoticeToast({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <Alert className={cn("notice-toast", notice.type)} variant={notice.type === "error" ? "destructive" : "default"}>
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  )
}

function useLocalStorageState<T extends string = string>(key: string, defaultValue: T) {
  const [value, setValue] = useState<string>(() => localStorage.getItem(key) ?? defaultValue)
  const setStoredValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue)
      localStorage.setItem(key, nextValue)
    },
    [key],
  )
  return [value as T, setStoredValue] as const
}

function useLocalStorageArray(key: string) {
  const [value, setValue] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []
    } catch {
      return []
    }
  })
  const setStoredValue = useCallback(
    (nextValue: string[]) => {
      const deduped = Array.from(new Set(nextValue.filter(Boolean)))
      setValue(deduped)
      localStorage.setItem(key, JSON.stringify(deduped))
    },
    [key],
  )
  return [value, setStoredValue] as const
}

function filterMails(mails: MailItem[], search: string) {
  const keyword = search.trim().toLowerCase()
  if (!keyword) return mails
  return mails.filter((mail) =>
    [mail.source, mail.subject, mail.text, mail.message, mail.raw].some((value) => String(value || "").toLowerCase().includes(keyword)),
  )
}

function normalizeAddressName(value: string, pattern: string) {
  try {
    return value.toLowerCase().replace(new RegExp(pattern || "[^a-z0-9]", "g"), "")
  } catch {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
  }
}

function senderName(source?: string) {
  if (!source) return "Unknown"
  return source.replace(/<.*?>/g, "").trim() || source
}

function senderInitials(source?: string) {
  return senderName(source)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function stripHtml(value?: string) {
  if (!value) return ""
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default App

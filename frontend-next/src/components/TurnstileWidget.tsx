import { useEffect, useId, useRef, useState } from "react"
import { Button } from "./ui/button"

declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string,
        options: {
          sitekey: string
          theme: "light" | "dark"
          callback: (token: string) => void
        },
      ) => string
      remove: (id: string) => void
    }
  }
}

type TurnstileWidgetProps = {
  siteKey: string
  theme: "light" | "dark"
  onToken: (token: string) => void
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]")
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.dataset.turnstile = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile script failed"))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function TurnstileWidget({ siteKey, theme, onToken }: TurnstileWidgetProps) {
  const id = `turnstile-${useId().replace(/:/g, "")}`
  const widgetId = useRef("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey) return undefined
    let mounted = true

    const renderWidget = async () => {
      setFailed(false)
      onToken("")
      try {
        await loadTurnstileScript()
        if (!mounted || !window.turnstile) return
        if (widgetId.current) window.turnstile.remove(widgetId.current)
        widgetId.current = window.turnstile.render(`#${id}`, {
          sitekey: siteKey,
          theme,
          callback: onToken,
        })
      } catch {
        if (mounted) setFailed(true)
      }
    }

    renderWidget()
    return () => {
      mounted = false
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = ""
      }
    }
  }, [id, onToken, siteKey, theme])

  if (!siteKey) return null

  return (
    <div className="turnstile-box">
      <div id={id} />
      {failed && (
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload challenge
        </Button>
      )}
    </div>
  )
}

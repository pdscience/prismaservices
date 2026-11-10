// Analytics unificado: GTM (dataLayer) + GA4 (gtag) + Meta Pixel (fbq)
// Tudo via placeholders VITE_* — não quebra se vazio.
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

export type ConversionEvent =
  | 'cta_click'
  | 'lead_whatsapp'
  | 'lead_email'
  | 'lead_sms'
  | 'signup_start'
  | 'login_start'
  | 'page_view_landing'

export function trackEvent(event: ConversionEvent, params: Record<string, unknown> = {}) {
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  } catch { /* noop */ }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, params)
    }
  } catch { /* noop */ }

  try {
    if (typeof window.fbq === 'function') {
      // Mapeia para eventos padrão Meta quando fizer sentido
      if (event === 'lead_whatsapp') window.fbq('track', 'Lead', params)
      else if (event === 'signup_start') window.fbq('track', 'CompleteRegistration', params)
      else window.fbq('trackCustom', event, params)
    }
  } catch { /* noop */ }
}

export function getWhatsAppNumber(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {}
  return env.VITE_WHATSAPP_NUMBER || '5511999999999'
}


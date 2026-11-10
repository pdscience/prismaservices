import type { Lang } from '../i18n'
import { buildWhatsAppLink } from './whatsapp'
import { legacyToE164 } from './phone'

/** O idioma decide o mercado: pt-BR → Brasil (WhatsApp/PIX), demais → EUA (SMS/email). */
export function isBrazilMarket(lang: Lang | string): boolean {
  return lang === 'pt-BR'
}

/** Destino de suporte configurado no deploy (vazio = não configurado). */
export function supportEmail(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env?.VITE_SUPPORT_EMAIL || ''
}

/** Número de suporte para SMS nos EUA (vazio = não configurado). */
export function supportSms(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env?.VITE_SUPPORT_SMS || ''
}

/**
 * Link `sms:` compatível com iOS e Android: número em E.164 com "+" e corpo
 * via query string (`?&body=` — o `&` tolera parsers que só esperam `?body=`).
 */
export function buildSmsLink(phone: string, text: string): string {
  const e164 = legacyToE164(phone)
  if (!e164) return ''
  return `sms:${e164}?&body=${encodeURIComponent(text)}`
}

/** WhatsApp no Brasil, SMS nos EUA — mesmo telefone, mesmo texto. */
export function buildContactLink(phone: string, text: string, lang: Lang | string): string {
  if (isBrazilMarket(lang)) return buildWhatsAppLink(phone, text)
  return buildSmsLink(phone, text)
}

/** Abre o app de email do visitante com a mensagem pronta (padrão do wa.me). */
export function buildSupportEmail(to: string, subject: string, body: string): string {
  if (!to) return ''
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

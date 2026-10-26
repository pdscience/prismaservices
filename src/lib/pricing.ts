export type PlanCurrency = 'BRL' | 'USD'

/** Moeda da assinatura existente manda; caso contrário, o idioma decide. */
export function currencyForLang(lang: string, billingCurrency?: string | null): PlanCurrency {
  if (billingCurrency === 'BRL' || billingCurrency === 'USD') return billingCurrency
  return lang === 'pt-BR' ? 'BRL' : 'USD'
}

export function formatPlanPrice(cents: number, currency: PlanCurrency, lang: string): string {
  const locale = lang === 'pt-BR' ? 'pt-BR' : lang === 'es' ? 'es' : 'en'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

export function planPriceColumns(currency: PlanCurrency) {
  return currency === 'USD'
    ? { monthly: 'monthly_price_usd' as const, stripe: 'stripe_price_id_usd' as const }
    : { monthly: 'monthly_price' as const, stripe: 'stripe_price_id' as const }
}

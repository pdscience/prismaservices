export type PlanCurrency = 'BRL' | 'USD'
export type StripeEnvironment = 'test' | 'live'

export interface PlanPrice {
  plan_id: string
  environment: StripeEnvironment
  currency: PlanCurrency
  stripe_price_id: string
  unit_amount: number
}

/** Moeda da assinatura existente manda; caso contrário, o idioma decide. */
export function currencyForLang(lang: string, billingCurrency?: string | null): PlanCurrency {
  if (billingCurrency === 'BRL' || billingCurrency === 'USD') return billingCurrency
  return lang === 'pt-BR' ? 'BRL' : 'USD'
}

/** Assinatura existente manda; sem assinatura, o país do cadastro decide. */
export function currencyForCountry(
  countryCode: string | null | undefined,
  billingCurrency?: string | null,
): PlanCurrency {
  if (billingCurrency === 'BRL' || billingCurrency === 'USD') return billingCurrency
  return countryCode?.trim().toUpperCase() === 'BR' ? 'BRL' : 'USD'
}

export function stripeEnvironment(
  value: string | undefined = import.meta.env.VITE_STRIPE_ENVIRONMENT,
): StripeEnvironment {
  return value === 'live' ? 'live' : 'test'
}

export function selectPlanPrice(
  prices: readonly PlanPrice[],
  planId: string,
  currency: PlanCurrency,
  environment: StripeEnvironment,
): PlanPrice | null {
  return prices.find(
    (price) =>
      price.plan_id === planId &&
      price.currency === currency &&
      price.environment === environment,
  ) ?? null
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

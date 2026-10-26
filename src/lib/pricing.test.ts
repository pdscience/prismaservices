import { describe, expect, it } from 'vitest'
import { currencyForLang, formatPlanPrice, planPriceColumns } from './pricing'

describe('currencyForLang', () => {
  it('usa BRL em pt-BR e USD em en/es', () => {
    expect(currencyForLang('pt-BR')).toBe('BRL')
    expect(currencyForLang('en')).toBe('USD')
    expect(currencyForLang('es')).toBe('USD')
  })

  it('assinatura existente manda', () => {
    expect(currencyForLang('en', 'BRL')).toBe('BRL')
    expect(currencyForLang('pt-BR', 'USD')).toBe('USD')
    expect(currencyForLang('en', 'EUR')).toBe('USD')
  })
})

describe('formatPlanPrice', () => {
  it('formata reais e dólares', () => {
    expect(formatPlanPrice(4990, 'BRL', 'pt-BR').replace(/\u00a0/g, ' ')).toBe('R$ 49,90')
    expect(formatPlanPrice(9990, 'USD', 'en')).toBe('$99.90')
    expect(formatPlanPrice(0, 'USD', 'en')).toBe('$0.00')
  })
})

describe('planPriceColumns', () => {
  it('mapeia as colunas por moeda', () => {
    expect(planPriceColumns('BRL')).toEqual({ monthly: 'monthly_price', stripe: 'stripe_price_id' })
    expect(planPriceColumns('USD')).toEqual({ monthly: 'monthly_price_usd', stripe: 'stripe_price_id_usd' })
  })
})

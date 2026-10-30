import { describe, expect, it } from 'vitest'
import {
  currencyForCountry,
  currencyForLang,
  formatPlanPrice,
  planPriceColumns,
  selectPlanPrice,
  stripeEnvironment,
} from './pricing'

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

describe('currencyForCountry', () => {
  it('usa BRL para o Brasil sem assinatura', () => {
    expect(currencyForCountry('BR')).toBe('BRL')
  })

  it('usa USD para os Estados Unidos sem assinatura', () => {
    expect(currencyForCountry('US')).toBe('USD')
  })

  it('usa USD para qualquer outro pais', () => {
    expect(currencyForCountry('PT')).toBe('USD')
  })

  it('mantem a moeda da assinatura existente', () => {
    expect(currencyForCountry('US', 'BRL')).toBe('BRL')
    expect(currencyForCountry('BR', 'USD')).toBe('USD')
  })

  it('ignora moeda invalida', () => {
    expect(currencyForCountry('BR', 'EUR')).toBe('BRL')
  })
})

describe('selectPlanPrice', () => {
  const prices = [
    { plan_id: 'ouro', environment: 'test', currency: 'BRL', stripe_price_id: 'p_brl_test', unit_amount: 4990 },
    { plan_id: 'ouro', environment: 'live', currency: 'USD', stripe_price_id: 'p_usd_live', unit_amount: 9990 },
  ] as const

  it('seleciona pela combinacao plano/ambiente/moeda', () => {
    expect(selectPlanPrice(prices, 'ouro', 'BRL', 'test')?.stripe_price_id).toBe('p_brl_test')
    expect(selectPlanPrice(prices, 'ouro', 'USD', 'live')?.stripe_price_id).toBe('p_usd_live')
  })

  it('retorna null quando nao existe', () => {
    expect(selectPlanPrice(prices, 'ouro', 'USD', 'test')).toBeNull()
  })
})

describe('stripeEnvironment', () => {
  it('retorna live somente com a variavel live', () => {
    expect(stripeEnvironment('live')).toBe('live')
    expect(stripeEnvironment('test')).toBe('test')
    expect(stripeEnvironment(undefined)).toBe('test')
  })
})

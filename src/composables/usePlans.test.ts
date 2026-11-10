import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePlans } from './usePlans'
import { useAuth } from './useAuth'
import { setLang } from './useI18n'
import type { Professional } from '../types'

// Estado de visitante (sem perfil carregado) usado como base dos testes.
const { proProfile } = useAuth()
const anonymousProfile: Professional = { ...proProfile.value }

function proFrom(countryCode: string): Professional {
  return {
    ...anonymousProfile,
    id: 'pro-1',
    country_code: countryCode,
    billing_currency: countryCode === 'BR' ? 'BRL' : 'USD',
  }
}

beforeEach(() => {
  setLang('pt-BR')
  proProfile.value = { ...anonymousProfile }
})

afterEach(() => {
  proProfile.value = anonymousProfile
  setLang('pt-BR')
})

describe('planCurrency', () => {
  it('visitante sem perfil usa o idioma: en → USD', () => {
    setLang('en')
    expect(usePlans().planCurrency.value).toBe('USD')
  })

  it('visitante sem perfil em pt-BR → BRL', () => {
    expect(usePlans().planCurrency.value).toBe('BRL')
  })

  it('pro carregado usa o país do cadastro mesmo em inglês', () => {
    setLang('en')
    proProfile.value = proFrom('BR')
    expect(usePlans().planCurrency.value).toBe('BRL')
  })

  it('pro carregado no exterior continua USD mesmo em português', () => {
    proProfile.value = proFrom('US')
    expect(usePlans().planCurrency.value).toBe('USD')
  })
})

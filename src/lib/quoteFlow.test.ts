import { describe, it, expect } from 'vitest'
import {
  validateQuoteForm,
  buildQuotePayload,
  composeServiceAddress,
  hasAnalysisInput,
} from './quoteFlow'

const validForm = {
  clientName: 'Maria Silva',
  clientPhone: '11987654321',
  clientAddress: 'Rua A, 100',
  clientCity: 'Dourados',
  clientUf: 'MS',
}

describe('validateQuoteForm', () => {
  it('aceita dados válidos', () => {
    expect(validateQuoteForm(validForm)).toEqual({})
  })
  it('erro quando nome vazio', () => {
    expect(
      validateQuoteForm({ ...validForm, clientName: '  ' }).clientName,
    ).toBe('Informe seu nome completo.')
  })
  it('erro quando telefone tem menos de 10 dígitos', () => {
    expect(
      validateQuoteForm({ ...validForm, clientPhone: '98765' }).clientPhone,
    ).toContain('WhatsApp válido')
  })
  it('erro quando endereço vazio', () => {
    expect(
      validateQuoteForm({ ...validForm, clientAddress: '' }).clientAddress,
    ).toBe('Informe o endereço do atendimento.')
  })
  it('erro quando cidade vazia', () => {
    expect(
      validateQuoteForm({ ...validForm, clientCity: '  ' }).clientCity,
    ).toBe('Informe a cidade do atendimento.')
  })
  it('erro quando estado/UF vazio', () => {
    expect(
      validateQuoteForm({ ...validForm, clientUf: ' ' }).clientUf,
    ).toBe('Informe o estado/UF do atendimento.')
  })
  it('aceita telefone internacional em E.164', () => {
    expect(
      validateQuoteForm({ ...validForm, clientPhone: '+5511987654321' }).clientPhone,
    ).toBeUndefined()
  })
  it('aceita telefone internacional sem DDI de entrada', () => {
    expect(
      validateQuoteForm({ ...validForm, clientPhone: '+12015550123' }).clientPhone,
    ).toBeUndefined()
  })
  it('rejeita E.164 curto demais', () => {
    expect(
      validateQuoteForm({ ...validForm, clientPhone: '+5511' }).clientPhone,
    ).toBeDefined()
  })
})

describe('composeServiceAddress', () => {
  it('anexa cidade e UF ao endereço', () => {
    expect(composeServiceAddress('Rua A, 100', 'Dourados', 'ms')).toBe('Rua A, 100 - Dourados - MS')
  })
  it('não duplica cidade/UF já presentes no endereço', () => {
    expect(composeServiceAddress('Rua A, 100 - Dourados - MS', 'Dourados', 'MS')).toBe('Rua A, 100 - Dourados - MS')
  })
  it('usa cidade/UF como endereço quando a rua está vazia', () => {
    expect(composeServiceAddress('', 'Dourados', 'MS')).toBe('Dourados - MS')
  })
  it('mantém apenas a rua quando não há cidade/UF', () => {
    expect(composeServiceAddress('Rua A', '', '')).toBe('Rua A')
  })
})

describe('hasAnalysisInput', () => {
  it('exige foto ou observação', () => {
    expect(hasAnalysisInput(false, '   ')).toBe(false)
  })
  it('aceita apenas foto', () => {
    expect(hasAnalysisInput(true, '')).toBe(true)
  })
  it('aceita apenas observação', () => {
    expect(hasAnalysisInput(false, 'Vazamento na pia')).toBe(true)
  })
})

describe('buildQuotePayload', () => {
  const base = {
    clientId: 'c1',
    form: { clientName: ' Maria ', clientPhone: '11987654321', clientAddress: 'Rua A, 100', clientCity: 'Dourados', clientUf: 'MS' },
    category: 'Eletricista',
    photoUrl: 'x.png',
    notes: 'n',
    aiAnalysis: { summary: 's' },
    analysisId: 'a1',
    professionalId: 'p1',
    sendMode: 'direct' as const,
  }
  it('envio direto: professional_id preenchido, broadcast false, status Pendente', () => {
    const p = buildQuotePayload(base)
    expect(p.professional_id).toBe('p1')
    expect(p.broadcast).toBe(false)
    expect(p.status).toBe('Pendente')
    expect(p.client_name).toBe('Maria')
  })
  it('não grava a estimativa da IA como preço final', () => {
    expect(buildQuotePayload(base).final_price).toBeNull()
  })
  it('vincula a análise de IA ao pedido', () => {
    expect(buildQuotePayload(base).analysis_id).toBe('a1')
  })
  it('broadcast: professional_id null e broadcast true', () => {
    const p = buildQuotePayload({ ...base, sendMode: 'broadcast' })
    expect(p.professional_id).toBeNull()
    expect(p.broadcast).toBe(true)
  })
  it('normaliza o telefone do cliente para E.164 no payload', () => {
    expect(buildQuotePayload(base).client_phone).toBe('+5511987654321')
    expect(
      buildQuotePayload({ ...base, form: { ...base.form, clientPhone: '+12015550123' } }).client_phone,
    ).toBe('+12015550123')
  })
  it('inclui cidade e UF no endereço enviado ao profissional', () => {
    expect(buildQuotePayload(base).client_address).toBe('Rua A, 100 - Dourados - MS')
  })
})

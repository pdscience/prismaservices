import { describe, it, expect } from 'vitest'
import {
  isBrazilMarket,
  buildSmsLink,
  buildContactLink,
  buildSupportEmail,
  supportEmail,
  supportSms,
} from './contact'

describe('isBrazilMarket', () => {
  it('pt-BR é mercado brasileiro', () => {
    expect(isBrazilMarket('pt-BR')).toBe(true)
  })
  it('en e es são mercado dos EUA', () => {
    expect(isBrazilMarket('en')).toBe(false)
    expect(isBrazilMarket('es')).toBe(false)
  })
})

describe('buildSmsLink', () => {
  it('gera sms: em E.164 com corpo via query (compatível iOS e Android)', () => {
    expect(buildSmsLink('+13055550123', 'New job'))
      .toBe('sms:+13055550123?&body=New%20job')
  })
  it('normaliza número nacional legado brasileiro para E.164', () => {
    expect(buildSmsLink('11987654321', 'oi'))
      .toBe('sms:+5511987654321?&body=oi')
  })
  it('sem telefone devolve string vazia', () => {
    expect(buildSmsLink('', 'oi')).toBe('')
  })
})

describe('buildContactLink', () => {
  it('Brasil usa wa.me', () => {
    expect(buildContactLink('+5511987654321', 'Oi', 'pt-BR'))
      .toBe('https://wa.me/5511987654321?text=Oi')
  })
  it('EUA (en e es) usa sms:', () => {
    expect(buildContactLink('+13055550123', 'Hi', 'en'))
      .toBe('sms:+13055550123?&body=Hi')
    expect(buildContactLink('+13055550123', 'Hola', 'es'))
      .toBe('sms:+13055550123?&body=Hola')
  })
})

describe('buildSupportEmail', () => {
  it('gera mailto: com destinatário, assunto e corpo codificados', () => {
    expect(buildSupportEmail('contato@exemplo.com', 'Assunto aqui', 'Corpo da mensagem'))
      .toBe('mailto:contato@exemplo.com?subject=Assunto%20aqui&body=Corpo%20da%20mensagem')
  })
  it('sem destinatário devolve string vazia', () => {
    expect(buildSupportEmail('', 'Assunto', 'Corpo')).toBe('')
  })
})

describe('destinos de suporte (env)', () => {
  it('lê VITE_SUPPORT_EMAIL e VITE_SUPPORT_SMS com fallback vazio', () => {
    expect(typeof supportEmail()).toBe('string')
    expect(typeof supportSms()).toBe('string')
  })
})

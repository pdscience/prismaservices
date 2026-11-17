import { describe, it, expect } from 'vitest'
import { normalizeAnalysis } from './aiAnalysis'

const options = {
  fallbackCategory: 'Eletricista',
  categories: ['Eletricista', 'Encanador', 'Pintor'],
}

const raw = {
  summary: 'Troca de tomada',
  description: 'Tomada queimada na sala.',
  category: 'Eletricista',
  complexity: 'Media',
  estimatedTime: '1 hora',
  materialsNeeded: ['Tomada', 'Fita isolante'],
  suggestedMinPrice: 120,
  suggestedMaxPrice: 180,
  technicalNotes: 'Desligar o disjuntor.',
  recommendedAction: 'Custo Direto',
}

describe('normalizeAnalysis', () => {
  it('normaliza a complexidade sem acento para o valor canônico', () => {
    expect(normalizeAnalysis(raw, options)?.complexity).toBe('Média')
  })

  it('usa a categoria de fallback quando a IA devolve categoria desconhecida', () => {
    const result = normalizeAnalysis({ ...raw, category: 'Categoria Inventada' }, options)
    expect(result?.category).toBe('Eletricista')
  })

  it('inverte preços quando o mínimo é maior que o máximo', () => {
    const result = normalizeAnalysis({ ...raw, suggestedMinPrice: 300, suggestedMaxPrice: 100 }, options)
    expect(result?.suggestedMinPrice).toBe(100)
    expect(result?.suggestedMaxPrice).toBe(300)
  })

  it('limita preços negativos e absurdos', () => {
    const result = normalizeAnalysis({ ...raw, suggestedMinPrice: -50, suggestedMaxPrice: 9_000_000 }, options)
    expect(result?.suggestedMinPrice).toBe(0)
    expect(result?.suggestedMaxPrice).toBe(1_000_000)
  })

  it('remove materiais vazios e limita a quatro itens', () => {
    const result = normalizeAnalysis({
      ...raw,
      materialsNeeded: [' Tomada ', '', 'Fita', 'Cabo', 'Conector', 'Caixa'],
    }, options)
    expect(result?.materialsNeeded).toEqual(['Tomada', 'Fita', 'Cabo', 'Conector'])
  })

  it('normaliza confiança em número, decimal e porcentagem', () => {
    expect(normalizeAnalysis({ ...raw, confidence: 85 }, options)?.confidence).toBe(0.85)
    expect(normalizeAnalysis({ ...raw, confidence: 0.9 }, options)?.confidence).toBe(0.9)
    expect(normalizeAnalysis({ ...raw, confidence: '80%' }, options)?.confidence).toBe(0.8)
  })

  it('normaliza a recomendação de visita técnica', () => {
    expect(normalizeAnalysis({ ...raw, recommendedAction: 'visita tecnica' }, options)?.recommendedAction)
      .toBe('Visita Técnica')
  })

  it('devolve null quando faltam campos essenciais', () => {
    expect(normalizeAnalysis({ ...raw, summary: '' }, options)).toBeNull()
    expect(normalizeAnalysis({ ...raw, description: undefined }, options)).toBeNull()
    expect(normalizeAnalysis(null, options)).toBeNull()
  })
})

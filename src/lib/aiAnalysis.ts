import type { AIAnalysis } from '../types'

export interface NormalizeAnalysisOptions {
  fallbackCategory: string
  categories: string[]
}

const MAX_PRICE = 1_000_000
const MAX_MATERIALS = 4
const MAX_SAFETY_RISK = 200

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function toInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return Math.round(n)
  }
  return 0
}

function clampPrice(value: unknown): number {
  return Math.min(MAX_PRICE, Math.max(0, toInteger(value)))
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function normalizeComplexity(value: unknown): AIAnalysis['complexity'] {
  const normalized = stripAccents(asString(value))
  if (normalized === 'baixa') return 'Baixa'
  if (normalized === 'alta') return 'Alta'
  return 'Média'
}

function normalizeUrgency(value: unknown): AIAnalysis['urgency'] {
  const normalized = stripAccents(asString(value))
  if (normalized === 'baixa') return 'Baixa'
  if (normalized === 'media') return 'Média'
  if (normalized === 'alta') return 'Alta'
  return undefined
}

function normalizeRecommendedAction(value: unknown): string {
  const normalized = stripAccents(asString(value))
  if (normalized.includes('visita')) return 'Visita Técnica'
  return 'Custo Direto'
}

function normalizeConfidence(value: unknown): number | undefined {
  let n: number
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string') {
    const cleaned = value.replace('%', '').replace(',', '.').trim()
    n = Number(cleaned)
  } else {
    return undefined
  }
  if (!Number.isFinite(n)) return undefined
  if (n > 1 && n <= 100) n /= 100
  return Math.min(1, Math.max(0, n))
}

export function normalizeAnalysis(raw: unknown, opts: NormalizeAnalysisOptions): AIAnalysis | null {
  const obj = asObject(raw)
  if (!obj) return null

  const summary = asString(obj.summary)
  const description = asString(obj.description)
  if (!summary || !description) return null

  const rawCategory = asString(obj.category)
  const category = opts.categories.includes(rawCategory) ? rawCategory : opts.fallbackCategory

  const rawMaterials = Array.isArray(obj.materialsNeeded) ? obj.materialsNeeded : []
  const materialsNeeded = rawMaterials
    .map(asString)
    .filter(Boolean)
    .slice(0, MAX_MATERIALS)

  let suggestedMinPrice = clampPrice(obj.suggestedMinPrice)
  let suggestedMaxPrice = clampPrice(obj.suggestedMaxPrice)
  if (suggestedMinPrice > suggestedMaxPrice) {
    ;[suggestedMinPrice, suggestedMaxPrice] = [suggestedMaxPrice, suggestedMinPrice]
  }

  const safetyRisk = asString(obj.safetyRisk).slice(0, MAX_SAFETY_RISK) || undefined
  const urgency = normalizeUrgency(obj.urgency)
  const confidence = normalizeConfidence(obj.confidence)

  return {
    summary,
    description,
    category,
    complexity: normalizeComplexity(obj.complexity),
    estimatedTime: asString(obj.estimatedTime),
    materialsNeeded,
    suggestedMinPrice,
    suggestedMaxPrice,
    technicalNotes: asString(obj.technicalNotes),
    recommendedAction: normalizeRecommendedAction(obj.recommendedAction),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(urgency !== undefined ? { urgency } : {}),
    ...(safetyRisk !== undefined ? { safetyRisk } : {}),
  }
}

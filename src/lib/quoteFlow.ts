import { legacyToE164 } from './phone'

export interface QuoteFormData {
  clientName: string
  clientPhone: string
  clientAddress: string
  clientCity: string
  clientUf: string
}

export interface QuoteValidationErrors {
  clientName?: string
  clientPhone?: string
  clientAddress?: string
  clientCity?: string
  clientUf?: string
}

export interface QuoteValidationMessages {
  clientName: string
  clientPhone: string
  clientAddress: string
  clientCity: string
  clientUf: string
}

const DEFAULT_VALIDATION_MESSAGES: QuoteValidationMessages = {
  clientName: 'Informe seu nome completo.',
  clientPhone: 'Informe um WhatsApp válido (com código do país).',
  clientAddress: 'Informe o endereço do atendimento.',
  clientCity: 'Informe a cidade do atendimento.',
  clientUf: 'Informe o estado/UF do atendimento.',
}

export function composeServiceAddress(street: string, city: string, uf: string): string {
  const base = street.trim()
  const extras = [city.trim(), uf.trim().toUpperCase()].filter(Boolean)
  const missing = extras.filter((value) => !base.toLowerCase().includes(value.toLowerCase()))
  if (!base) return missing.join(' - ')
  return missing.length > 0 ? `${base} - ${missing.join(' - ')}` : base
}

export function hasAnalysisInput(hasPhoto: boolean, notes: string): boolean {
  return hasPhoto || notes.trim().length > 0
}

/**
 * Valida dados do cliente antes de confirmar o orçamento.
 * As mensagens podem ser sobrescritas (ex.: via i18n) sem alterar a lógica.
 */
export function validateQuoteForm(
  data: QuoteFormData,
  messages: QuoteValidationMessages = DEFAULT_VALIDATION_MESSAGES,
): QuoteValidationErrors {
  const errors: QuoteValidationErrors = {}
  if (!data.clientName.trim()) {
    errors.clientName = messages.clientName
  }
  const rawPhone = data.clientPhone.trim()
  const phoneDigits = rawPhone.replace(/\D/g, '')
  const isE164 = rawPhone.startsWith('+')
  const validPhone = isE164
    ? phoneDigits.length >= 8 && phoneDigits.length <= 15
    : phoneDigits.length >= 10 && phoneDigits.length <= 11
  if (!validPhone) {
    errors.clientPhone = messages.clientPhone
  }
  if (!data.clientAddress.trim()) {
    errors.clientAddress = messages.clientAddress
  }
  if (!data.clientCity.trim()) {
    errors.clientCity = messages.clientCity
  }
  if (!data.clientUf.trim()) {
    errors.clientUf = messages.clientUf
  }
  return errors
}

export type SendMode = 'direct' | 'broadcast'

/** Monta o payload de criação do pedido para envio direto ou broadcast. */
export function buildQuotePayload(args: {
  clientId: string | null
  form: QuoteFormData
  category: string
  photoUrl: string
  notes: string
  aiAnalysis: unknown
  analysisId: string | null
  sendMode: SendMode
  professionalId: string | null
}): { professional_id: string | null; broadcast: boolean; status: 'Pendente' } & Record<string, unknown> {
  const direct = args.sendMode === 'direct'
  return {
    client_id: args.clientId,
    client_name: args.form.clientName.trim(),
    client_phone: legacyToE164(args.form.clientPhone),
    client_address: composeServiceAddress(args.form.clientAddress, args.form.clientCity, args.form.clientUf),
    category: args.category,
    photo_url: args.photoUrl,
    notes: args.notes,
    ai_analysis: args.aiAnalysis,
    analysis_id: args.analysisId,
    status: 'Pendente',
    professional_id: direct ? args.professionalId : null,
    broadcast: !direct,
    agendamento: null,
    final_price: null,
    receipt_issued: false,
    rating: null,
  }
}

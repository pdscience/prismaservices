import { ref, computed, nextTick } from 'vue'
import type { AIAnalysis, Professional, ServiceRequest, User } from '../types'
import { analyzeWithAI, getAnalysis, uploadServicePhoto, createServiceRequest } from '../api/insforgeService'
import {
  validateQuoteForm,
  buildQuotePayload,
  hasAnalysisInput,
  type SendMode,
} from '../lib/quoteFlow'
import { normalizeAnalysis } from '../lib/aiAnalysis'
import { pollAnalysis } from '../lib/analysisPolling'
import { CATEGORIES } from '../lib/categories'
import { trackEvent } from '../lib/analytics'
import { buildClientPrefill } from '../lib/quotePrefill'
import { buildContactLink } from '../lib/contact'
import { useAuth } from './useAuth'
import { useNavigation } from './useNavigation'
import { useProfessionals } from './useProfessionals'
import { useRequests } from './useRequests'
import { pushToast } from './useUi'
import { useI18n } from './useI18n'

const selectedCategory = ref<string>('Eletricista')
const clientName = ref<string>('')
const clientPhone = ref<string>('')
const clientPhoneCountry = ref<string>('BR')
const clientAddress = ref<string>('')
const clientCity = ref<string>('')
const clientUf = ref<string>('')
const notes = ref<string>('')
const imagePreview = ref<string | null>(null)
const photoFile = ref<File | null>(null)
const isAnalyzing = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)
const latestAiResult = ref<AIAnalysis | null>(null)
const createdOrderSuccess = ref<ServiceRequest | null>(null)
const createdOrderWhatsApp = ref<string>('')
const pendingAnalysis = ref<boolean>(false)
const analysisId = ref<string | null>(null)
const isRefining = ref<boolean>(false)
const analysisTimedOut = ref<boolean>(false)
let analysisGeneration = 0

const selectedProfessional = ref<Professional | null>(null)
// Profissionais elegíveis à escolha direta na categoria atual do formulário
const directCandidates = computed(() => {
  const { visibleProfessionals } = useProfessionals()
  const list = visibleProfessionals.value.filter(p =>
    !selectedCategory.value || p.category === selectedCategory.value
  )
  return list.length > 0 ? list : visibleProfessionals.value
})
const sendMode = ref<SendMode | null>(null)
const formError = ref<string>('')

const aiReadyToast = ref(false)
// Banner de fallback da IA (ativado na Task 9)
const aiFallback = ref(false)

function handleChooseProfessional(pro: Professional) {
  const { goToTab, trackCta } = useNavigation()
  const { authUser, authRole, authView, authError, showAuth } = useAuth()
  const { filterCategory } = useProfessionals()
  trackCta('escolher_profissional_' + pro.id)
  selectedProfessional.value = pro
  if (pro.category) {
    selectedCategory.value = pro.category
    filterCategory.value = pro.category
  }
  sendMode.value = 'direct'
  formError.value = ''
  // Visitante: pede login/cadastro mas preserva a escolha; logado: vai ao formulário
  if (!authUser.value) {
    authRole.value = 'client'
    authView.value = 'register'
    authError.value = ''
    showAuth.value = true
    return
  }
  goToTab('solicitar')
  nextTick(() => {
    document.getElementById('solicitar-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function clearProfessionalSelection() {
  selectedProfessional.value = null
  if (sendMode.value === 'direct') sendMode.value = null
}

function prefillClientData(profile: User | null): void {
  if (!profile) return
  const prefill = buildClientPrefill(profile)
  if (!clientName.value.trim()) clientName.value = prefill.clientName
  if (!clientPhone.value.trim()) clientPhone.value = prefill.clientPhone
  if (!clientAddress.value.trim()) clientAddress.value = prefill.clientAddress
  if (!clientCity.value.trim()) clientCity.value = prefill.clientCity
  if (!clientUf.value.trim()) clientUf.value = prefill.clientUf
}

function handlePhotoUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    photoFile.value = file
    const reader = new FileReader()
    reader.onloadend = () => {
      imagePreview.value = reader.result as string
    }
    reader.readAsDataURL(file)
  }
}

function analysisOptions() {
  return {
    fallbackCategory: selectedCategory.value,
    categories: CATEGORIES.map((c) => c.name),
  }
}

function hasUsablePrice(analysis: AIAnalysis): boolean {
  return analysis.suggestedMinPrice > 0 || analysis.suggestedMaxPrice > 0
}

function buildFallbackAnalysis(): AIAnalysis {
  const { t, categoryText } = useI18n()
  const cat = categoryText(selectedCategory.value)
  return {
    summary: t('ai.fallbackSummary', { category: cat }),
    description: t('ai.fallbackDescription', { category: cat }),
    category: selectedCategory.value,
    complexity: 'Média',
    estimatedTime: t('ai.fallbackTime'),
    materialsNeeded: [t('ai.fallbackMaterial1'), t('ai.fallbackMaterial2')],
    suggestedMinPrice: 0,
    suggestedMaxPrice: 0,
    technicalNotes: '',
    recommendedAction: 'Custo Direto',
  }
}

function withFallbackTexts(analysis: AIAnalysis): AIAnalysis {
  const fallback = buildFallbackAnalysis()
  return {
    ...analysis,
    summary: fallback.summary,
    description: fallback.description,
    estimatedTime: fallback.estimatedTime,
    materialsNeeded: fallback.materialsNeeded,
    technicalNotes: '',
    recommendedAction: fallback.recommendedAction,
    confidence: undefined,
    safetyRisk: undefined,
  }
}

function cancelAnalysisPolling(): void {
  analysisGeneration += 1
  isRefining.value = false
}

async function runAnalysisPolling(id: string, generation: number): Promise<void> {
  const result = await pollAnalysis(() => getAnalysis(id))
  if (generation !== analysisGeneration) return

  isRefining.value = false
  if (result.status === 'ready') {
    const normalized = result.analysis
      ? normalizeAnalysis(result.analysis, analysisOptions())
      : null
    if (normalized) {
      latestAiResult.value = result.fallback ? withFallbackTexts(normalized) : normalized
      aiFallback.value = result.fallback || !hasUsablePrice(normalized)
      if (!aiFallback.value) {
        trackEvent('ai_analysis_ready', { category: normalized.category, mode: 'poll' })
        aiReadyToast.value = true
        setTimeout(() => { aiReadyToast.value = false }, 6000)
      } else {
        trackEvent('ai_analysis_fallback', { category: normalized.category, status: 'poll' })
      }
    } else {
      aiFallback.value = true
      trackEvent('ai_analysis_error', { category: selectedCategory.value, status: 'invalid' })
    }
    return
  }

  // error/timeout: mantém a análise preliminar já exibida.
  analysisTimedOut.value = true
  trackEvent('ai_analysis_error', { category: selectedCategory.value, status: result.status })
}

async function handleAnalyzeWithAI() {
  const { t, lang } = useI18n()
  const { authUser, authRole, authView, authError, showAuth } = useAuth()
  if (!hasAnalysisInput(Boolean(imagePreview.value), notes.value)) {
    pushToast('warning', t('toasts.needPhotoOrNotes'))
    return
  }
  if (!authUser.value) {
    pendingAnalysis.value = true
    authRole.value = 'client'
    authView.value = 'register'
    authError.value = ''
    showAuth.value = true
    return
  }
  pendingAnalysis.value = false

  const generation = ++analysisGeneration
  isAnalyzing.value = true
  latestAiResult.value = null
  analysisId.value = null
  isRefining.value = false
  analysisTimedOut.value = false
  aiReadyToast.value = false
  aiFallback.value = false
  trackEvent('ai_analysis_started', {
    category: selectedCategory.value,
    hasImage: Boolean(imagePreview.value),
    lang: lang.value,
  })

  try {
    const res = await analyzeWithAI(
      imagePreview.value?.startsWith('data:') ? imagePreview.value : undefined,
      selectedCategory.value,
      notes.value,
      lang.value,
      CATEGORIES.map((c) => c.name),
    )
    if (generation !== analysisGeneration) return

    analysisId.value = res.analysisId
    const normalized = res.analysis
      ? normalizeAnalysis(res.analysis, analysisOptions())
      : null
    let analysis = normalized ?? buildFallbackAnalysis()
    if (res.fallback || !normalized) {
      analysis = withFallbackTexts(analysis)
      aiFallback.value = true
    }
    if (!hasUsablePrice(analysis)) aiFallback.value = true
    latestAiResult.value = analysis
    if (aiFallback.value) {
      trackEvent('ai_analysis_fallback', { category: analysis.category, status: res.status })
    } else if (res.status === 'ready') {
      trackEvent('ai_analysis_ready', { category: analysis.category, mode: 'fast' })
    }
    aiReadyToast.value = res.status === 'ready' && !aiFallback.value
    if (aiReadyToast.value) setTimeout(() => { aiReadyToast.value = false }, 6000)

    if (res.status === 'processing' && res.analysisId) {
      isRefining.value = true
      void runAnalysisPolling(res.analysisId, generation)
    }
  } catch (err) {
    if (generation !== analysisGeneration) return
    console.error(err)
    const rateLimited = (err as { statusCode?: number }).statusCode === 429
    latestAiResult.value = buildFallbackAnalysis()
    aiFallback.value = true
    trackEvent(rateLimited ? 'ai_analysis_rate_limited' : 'ai_analysis_error', {
      category: selectedCategory.value,
      status: 'request',
    })
    pushToast('warning', t(rateLimited ? 'toasts.aiRateLimited' : 'toasts.aiUnavailable'))
  } finally {
    if (generation === analysisGeneration) isAnalyzing.value = false
  }
}

async function handleConfirmOrder() {
  const { authUser, authRole, authView, authError, showAuth } = useAuth()
  const { requests } = useRequests()
  const { t, categoryText } = useI18n()
  if (isSubmitting.value) return
  if (!latestAiResult.value || !sendMode.value) return
  formError.value = ''

  // Login no fim: visitante escolhe antes, autentica ao confirmar
  if (!authUser.value) {
    authRole.value = 'client'
    authView.value = 'register'
    authError.value = ''
    showAuth.value = true
    return
  }

  const errors = validateQuoteForm(
    {
      clientName: clientName.value,
      clientPhone: clientPhone.value,
      clientAddress: clientAddress.value,
      clientCity: clientCity.value,
      clientUf: clientUf.value,
    },
    {
      clientName: t('validation.clientName'),
      clientPhone: t('validation.clientPhone'),
      clientAddress: t('validation.clientAddress'),
      clientCity: t('validation.clientCity'),
      clientUf: t('validation.clientUf'),
    },
  )
  if (Object.keys(errors).length > 0) {
    formError.value = errors.clientName || errors.clientPhone || errors.clientAddress
      || errors.clientCity || errors.clientUf || t('toasts.verifyData')
    return
  }

  if (sendMode.value === 'direct' && !selectedProfessional.value) {
    formError.value = t('toasts.needProForDirect')
    return
  }

  isSubmitting.value = true
  try {
    let photoUrl = imagePreview.value || ''
    if (photoFile.value) {
      try {
        photoUrl = await uploadServicePhoto(photoFile.value, authUser.value.id)
      } catch (err) {
        console.error('Erro ao enviar foto:', err)
        pushToast('error', t('toasts.photoUploadError'))
        formError.value = t('toasts.photoFailed')
        return
      }
    }

    const payload = buildQuotePayload({
      clientId: authUser.value?.id ?? null,
      form: {
        clientName: clientName.value,
        clientPhone: clientPhone.value,
        clientAddress: clientAddress.value,
        clientCity: clientCity.value,
        clientUf: clientUf.value,
      },
      category: selectedCategory.value,
      photoUrl,
      notes: notes.value || '',
      aiAnalysis: latestAiResult.value,
      analysisId: analysisId.value,
      sendMode: sendMode.value,
      professionalId: selectedProfessional.value?.id ?? null,
    })
    const newOrder = payload as unknown as Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at'>

    const created = await createServiceRequest(newOrder)
    requests.value = [created, ...requests.value]

    let whatsAppUrl = ''
    if (sendMode.value === 'direct' && selectedProfessional.value?.phone) {
      const pro = selectedProfessional.value
      const msg = [
        t('ai.waIntro', { name: pro.name }),
        '',
        t('ai.waBody', { category: categoryText(selectedCategory.value), description: latestAiResult.value.description }),
        '',
        t('ai.waAsk'),
      ].join('\n')
      // WhatsApp no Brasil, SMS nos EUA — mesmo telefone e mensagem.
      whatsAppUrl = buildContactLink(pro.phone, msg, useI18n().lang.value)
    }

    createdOrderSuccess.value = created
    createdOrderWhatsApp.value = whatsAppUrl
    resetForm()
    nextTick(() => {
      document.getElementById('order-success')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  } catch (err) {
    console.error('Erro ao criar pedido:', err)
    formError.value = t('toasts.requestError', {
      reason: err instanceof Error ? err.message : t('toasts.serverError'),
    })
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  cancelAnalysisPolling()
  latestAiResult.value = null
  aiReadyToast.value = false
  analysisId.value = null
  isAnalyzing.value = false
  analysisTimedOut.value = false
  selectedProfessional.value = null
  sendMode.value = null
  formError.value = ''
  imagePreview.value = null
  photoFile.value = null
  notes.value = ''
  clientName.value = ''
  clientPhone.value = ''
  clientPhoneCountry.value = 'BR'
  clientAddress.value = ''
  clientCity.value = ''
  clientUf.value = ''
  aiFallback.value = false
  pendingAnalysis.value = false
  selectedCategory.value = 'Eletricista'
}

export function useQuoteForm() {
  return {
    selectedCategory, clientName, clientPhone, clientPhoneCountry, clientAddress, clientCity, clientUf, notes,
    imagePreview, photoFile,
    isAnalyzing, isSubmitting, latestAiResult,
    isRefining, analysisTimedOut,
    createdOrderSuccess, createdOrderWhatsApp,
    sendMode, formError,
    selectedProfessional,
    aiReadyToast, aiFallback, pendingAnalysis,
    directCandidates,
    handlePhotoUpload, handleAnalyzeWithAI, handleConfirmOrder,
    handleChooseProfessional, clearProfessionalSelection,
    prefillClientData,
    resetForm, cancelAnalysisPolling,
  }
}

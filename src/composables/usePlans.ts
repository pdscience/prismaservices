import { ref, computed } from 'vue'
import type { Plan } from '../types'
import { createCheckoutSession, createPortalSession } from '../api/insforgeService'
import { User, Sparkles } from 'lucide-vue-next'
import { useAuth } from './useAuth'
import { useNavigation } from './useNavigation'
import { pushToast } from './useUi'
import { useI18n } from './useI18n'
import { maxPhotosForPlan, maxCategoriesForPlan } from '../lib/planLimits'
import { currencyForCountry, formatPlanPrice, stripeEnvironment, type PlanCurrency } from '../lib/pricing'

const plans = ref<Plan[]>([])

const planMap = computed(() => {
  const m = new Map<string, Plan>()
  for (const p of plans.value) m.set(p.id, p)
  return m
})

function planLimitText(id: string, fallback: string): string {
  const { t } = useI18n()
  const row = planMap.value.get(id)
  if (row) {
    return row.request_limit === null
      ? t('plans.unlimited')
      : t('plans.perMonthShort', { count: row.request_limit })
  }
  // Ainda sem a linha de plans: reaproveita o número do fallback com o texto
  // traduzido (o fallback é pt e vazaria para en/es).
  const count = fallback.match(/\d+/)?.[0]
  return count ? t('plans.perMonthShort', { count: Number(count) }) : fallback
}

const currentPlanRow = computed(() => planMap.value.get(useAuth().proProfile.value.plan) ?? null)

const planFeatures = computed(() => {
  const { proProfile } = useAuth()
  const plan = proProfile.value.plan
  const row = currentPlanRow.value
  // Limites e visibilidade vêm da tabela plans (fonte única); request_limit NULL = ilimitado
  const maxRequests = row ? (row.request_limit === null ? Infinity : row.request_limit) : 0
  return {
    maxRequests,
    maxPhotos: maxPhotosForPlan(row?.max_photos),
    maxCategories: maxCategoriesForPlan(row?.max_categories),
    prioritySearch: plan === 'ouro' || plan === 'prata',
    verifiedBadge: plan === 'ouro',
    advancedReports: plan === 'ouro',
    whatsappVisible: row ? row.show_whatsapp_to_client : false,
    isGratuito: plan === 'gratuito',
    isBronze: plan === 'bronze',
    isPrata: plan === 'prata',
    isOuro: plan === 'ouro',
  }
})

const requestUsage = computed(() => {
  const { proProfile } = useAuth()
  const current = proProfile.value.requests_this_month || 0
  const limit = planFeatures.value.maxRequests
  return {
    current,
    limit,
    percentage: limit === Infinity ? 0 : (current / limit) * 100,
    isNearLimit: limit !== Infinity && current >= limit - 2,
    isAtLimit: limit !== Infinity && current >= limit,
  }
})

const canReceiveRequests = computed(() =>
  currentPlanRow.value?.receives_broadcasts ?? useAuth().proProfile.value.plan !== 'gratuito')

function hasFeature(feature: 'whatsappVisible' | 'advancedReports' | 'verifiedBadge'): boolean {
  return Boolean(planFeatures.value[feature])
}

// Cada plano guarda chaves de i18n (não texto) para que nome, tagline,
// features e cta sejam reescritos a cada troca de idioma.
// Interface trabalha apenas com Gratuito e Premium. Bronze/Prata continuam
// aceitos no banco/código antigo, mas não são mais exibidos.
const PLANS = [
  {
    id: 'gratuito', icon: User,
    nameKey: 'plans.gratuito', taglineKey: 'plans.taglineGratuito',
    featureKeys: ['plans.featureFreeProfile', 'plans.featureBasicProfile'],
    ctaKey: 'plans.ctaStartFree',
  },
  {
    id: 'ouro', icon: Sparkles,
    nameKey: 'plans.ouro', taglineKey: 'plans.taglineOuro',
    featureKeys: [
      'plans.featureUnlimitedOrders', 'plans.feature5Photos', 'plans.featureUnlimitedCategories',
      'plans.featureHighlight', 'plans.featureVerifiedBadge', 'plans.featureAdvancedStats',
    ],
    ctaKey: 'plans.ctaSubscribeOuro',
  },
]

// Rótulos legíveis por id de plano (traduzidos e reativos ao idioma).
// 'gratuito' é traduzido; o id legado 'ouro' é exibido como Premium.
const PLAN_LABELS = computed<Record<string, string>>(() => {
  const { planText } = useI18n()
  return {
    gratuito: planText('gratuito'),
    bronze: planText('bronze'),
    prata: planText('prata'),
    ouro: planText('ouro'),
  }
})

// Preço de fallback (seed) usado quando a tabela plans ainda não tem a linha
const PLAN_FALLBACK_CENTS: Record<PlanCurrency, Record<string, number>> = {
  BRL: { gratuito: 0, bronze: 3490, prata: 5490, ouro: 4990 },
  USD: { gratuito: 0, bronze: 600, prata: 1000, ouro: 9990 },
}

// Assinatura existente manda; caso contrário, o país do cadastro define a moeda.
const planCurrency = computed<PlanCurrency>(() => {
  const { proProfile } = useAuth()
  const hasActiveSubscription = !!proProfile.value.stripe_subscription_id
    && (proProfile.value.plan_status === 'active' || proProfile.value.plan_status === 'past_due')
  return currencyForCountry(
    proProfile.value.country_code,
    hasActiveSubscription ? proProfile.value.billing_currency : null,
  )
})

function dbPlanPrice(id: string, currency: PlanCurrency = planCurrency.value): string {
  const { lang } = useI18n()
  const row = planMap.value.get(id)
  const cents = row
    ? (currency === 'USD' ? row.monthly_price_usd : row.monthly_price)
    : (PLAN_FALLBACK_CENTS[currency][id] ?? 0)
  return formatPlanPrice(cents, currency, lang.value)
}
const PLAN_PRICES = computed<Record<string, string>>(() => ({
  gratuito: dbPlanPrice('gratuito'),
  bronze: dbPlanPrice('bronze'),
  prata: dbPlanPrice('prata'),
  ouro: dbPlanPrice('ouro'),
}))

// Limite da feature ("N pedidos por mês" / "Pedidos ilimitados") lido do banco.
// Recebe a chave da feature para casar pelo identificador, não pelo texto traduzido.
function withDbLimit(planId: string, featureKey: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const row = planMap.value.get(planId)
  if (featureKey === 'plans.featureOrdersPerMonth') {
    if (!row) return t(featureKey, { count: 0 })
    return row.request_limit === null
      ? t('plans.featureUnlimitedOrders')
      : t('plans.featureOrdersPerMonth', { count: row.request_limit })
  }
  if (featureKey === 'plans.featureUnlimitedOrders' && row && row.request_limit !== null) {
    return t('plans.featureOrdersPerMonth', { count: row.request_limit })
  }
  return t(featureKey)
}

// PLANS com nome/tagline/features/cta traduzidos + preço/limite mesclados do banco
const displayPlans = computed(() => {
  const { t } = useI18n()
  return PLANS.map((p) => ({
    id: p.id,
    icon: p.icon,
    name: t(p.nameKey),
    tagline: t(p.taglineKey),
    cta: t(p.ctaKey),
    price: dbPlanPrice(p.id),
    features: p.featureKeys.map((f) => withDbLimit(p.id, f, t)),
  }))
})

const upgradeRecommendation = computed(() => {
  const current = useAuth().proProfile.value.plan
  const order: Record<string, number> = { gratuito: 0, ouro: 1 }
  const next = displayPlans.value.find((p) => order[p.id] === order[current] + 1)
  if (!next) return null
  return { plan: next.id, label: next.name, price: next.price, features: next.features }
})

async function subscribePlan(targetPlan: string) {
  const { proProfile } = useAuth()
  const { goToTab } = useNavigation()
  const { t } = useI18n()
  const currency = planCurrency.value
  try {
    if (!proProfile.value.id) {
      pushToast('warning', t('toasts.needLoginPro'))
      return
    }
    if (proProfile.value.plan === targetPlan) return
    const hasActiveSubscription = !!proProfile.value.stripe_subscription_id
      && (proProfile.value.plan_status === 'active' || proProfile.value.plan_status === 'past_due')
    if (hasActiveSubscription) {
      await handleOpenPortal()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proProfile.value.email)) {
      pushToast('warning', t('toasts.invalidEmail'))
      goToTab('perfil_pro')
      return
    }
    const { url } = await createCheckoutSession(
      proProfile.value.id,
      targetPlan,
      proProfile.value.email,
      currency,
      stripeEnvironment(),
    )
    if (url) window.location.href = url
  } catch (err) {
    console.error('Erro ao assinar plano:', err)
    const message = err instanceof Error ? err.message : ''
    if (message.includes('PRICE_NOT_CONFIGURED:')) {
      pushToast('warning', t('toasts.priceNotConfigured', { currency }))
    } else {
      pushToast('error', t('toasts.subscribeError'))
    }
  }
}

async function handleOpenPortal() {
  const { proProfile } = useAuth()
  const { t } = useI18n()
  try {
    if (!proProfile.value.id) return
    const environment = proProfile.value.stripe_subscription_id
      ? (proProfile.value.billing_environment ?? stripeEnvironment())
      : stripeEnvironment()
    const { url } = await createPortalSession(proProfile.value.id, environment)
    if (url) window.location.href = url
  } catch (err) {
    console.error('Erro ao abrir portal de assinatura:', err)
    pushToast('error', t('toasts.portalError'))
  }
}

export function usePlans() {
  return {
    plans, planMap,
    PLANS, PLAN_LABELS, displayPlans, PLAN_PRICES, planCurrency,
    planFeatures, requestUsage, canReceiveRequests, currentPlanRow, upgradeRecommendation,
    hasFeature,
    dbPlanPrice, planLimitText,
    subscribePlan, handleOpenPortal,
  }
}

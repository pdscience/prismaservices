<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { trackEvent, getWhatsAppNumber } from '../../lib/analytics'
import { buildWhatsAppLink } from '../../lib/whatsapp'
import { CATEGORIES, CATEGORY_UNLISTED } from '../../lib/categories'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useProfessionals } from '../../composables/useProfessionals'
import { usePlans } from '../../composables/usePlans'
import { useQuoteForm } from '../../composables/useQuoteForm'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileText,
  Hammer,
  Handshake,
  MessageCircle,
  MessageSquare,
  Paintbrush,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-vue-next'

const { isLanding } = useAuth()
const route = useRoute()
const { t, lang, categoryText, planText } = useI18n()
const {
  activeTab, activeSection, teslaSections,
  goToTab, goToModule, scrollToId, trackCta,
} = useNavigation()
const { filterCategory, directoryPage } = useProfessionals()
const { landingCategory } = useUi()
const { dbPlanPrice } = usePlans()
const { selectedCategory } = useQuoteForm()

const contactForm = ref({
  name: '',
  email: '',
  phone: '',
  zip: '',
  category: '',
  categoryOther: '',
  subject: '',
  message: '',
})
const contactSubmitting = ref(false)
const contactSuccess = ref(false)

/** Categoria real escolhida na grade de cartoes da landing. */
const contactCategory = computed(() => landingCategory.value)

/** O visitante digitou um servico que nao esta na lista. */
const contactUnlisted = computed(() => contactForm.value.category === CATEGORY_UNLISTED)

function clearContactCategory(): void {
  landingCategory.value = ''
  contactForm.value.category = ''
  contactForm.value.categoryOther = ''
}

const handleContactSubmit = () => {
  contactSubmitting.value = true
  const { name, email, phone, zip, category, subject, message } = contactForm.value
  const isUnlisted = category === CATEGORY_UNLISTED
  const categoryLine = isUnlisted
    ? `${t('landing.waCategoria')}: ${contactForm.value.categoryOther} (${t('landing.waCategoriaSugerida')})`
    : contactCategory.value ? `${t('landing.waCategoria')}: ${categoryText(contactCategory.value)}` : ''
  // Experiência sem sair da página: abre WhatsApp em nova aba + mantém toast
  const waMessage = [
    t('landing.waOla'),
    ``,
    `${t('landing.waNome')}: ${name}`,
    `${t('landing.waEmail')}: ${email}`,
    phone ? `${t('landing.waTelefone')}: ${phone}` : '',
    zip ? `${t('landing.zipCode')}: ${zip}` : '',
    categoryLine,
    subject ? `${t('landing.waAssunto')}: ${subject}` : '',
    ``,
    `${t('landing.waMensagem')}: ${message}`,
  ].filter(Boolean).join('\n')

  trackEvent('lead_whatsapp', { category: isUnlisted ? 'categoria_sugerida' : (category || 'geral'), subject: subject || '' })
  try {
    window.open(buildWhatsAppLink(getWhatsAppNumber(), waMessage), '_blank', 'noopener')
  } catch { /* noop */ }

  setTimeout(() => {
    contactSubmitting.value = false
    contactSuccess.value = true
    contactForm.value = { name: '', email: '', phone: '', zip: '', category: '', categoryOther: '', subject: '', message: '' }
    landingCategory.value = ''
    setTimeout(() => { contactSuccess.value = false }, 6000)
  }, 500)
}

// ---------- Landing premium (página única) ----------
const heroVideoUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_HERO_VIDEO_URL || ''
const openFaq = ref<number | null>(0)
const faqs = computed(() => [
  { q: t('landing.faq1Q'), a: t('landing.faq1A') },
  { q: t('landing.faq2Q'), a: t('landing.faq2A') },
  { q: t('landing.faq3Q'), a: t('landing.faq3A') },
  {
    q: t('landing.faq4Q'),
    a: `${planText('gratuito')} (${dbPlanPrice('gratuito')}): ${t('plans.featureFreeProfile')}. ${planText('ouro')} (${dbPlanPrice('ouro', 'BRL')} / ${dbPlanPrice('ouro', 'USD')}): ${t('plans.featureUnlimitedOrders')}, ${t('plans.featureHighlight')}, ${t('plans.featureVerifiedBadge')} e ${t('plans.featureAdvancedStats')}.`,
  },
  { q: t('landing.faq5Q'), a: t('landing.faq5A') },
])
const partnerLogos = computed(() => lang.value === 'en'
  ? ['Pro Electric Co.', 'Prime Plumbing', 'Paint & Co.', 'CoolAir', 'Custom Carpentry', 'Easy Renovation', 'Gold Key 24h', 'Total Clean']
  : ['Eletricistas PRO', 'Hidráulica Prime', 'Pinturas & Cia', 'ClimaFrio', 'Marcenaria Alto Padrão', 'Reforma Fácil', 'Chave Ouro 24h', 'Limpa Total'])

const usServices = computed(() => [
  {
    icon: Sparkles,
    title: t('landing.usSvcCleaning'),
    desc: t('landing.usSvcCleaningDesc'),
    category: 'Limpeza Geral',
  },
  {
    icon: Hammer,
    title: t('landing.usSvcHandyman'),
    desc: t('landing.usSvcHandymanDesc'),
    category: 'Marido de Aluguel',
  },
  {
    icon: Paintbrush,
    title: t('landing.usSvcPainting'),
    desc: t('landing.usSvcPaintingDesc'),
    category: 'Pintor',
  },
])

const usTrust = computed(() => [
  { icon: BadgeCheck, title: t('landing.usTrustVerified'), desc: t('landing.usTrustVerifiedDesc') },
  { icon: FileText, title: t('landing.usTrustEstimates'), desc: t('landing.usTrustEstimatesDesc') },
  { icon: CheckCircle2, title: t('landing.usTrustNoObligation'), desc: t('landing.usTrustNoObligationDesc') },
  { icon: Star, title: t('landing.usTrustReviews'), desc: t('landing.usTrustReviewsDesc') },
])

function startUsService(category: string) {
  trackCta('us_service_' + category)
  selectedCategory.value = category
  goToModule('client', 'register')
}

function handleTilt(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement | null
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = el.getBoundingClientRect()
  const rx = ((e.clientY - r.top) / r.height - 0.5) * -10
  const ry = ((e.clientX - r.left) / r.width - 0.5) * 10
  el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`
}
function resetTilt(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement | null
  if (el) el.style.transform = ''
}

const cursorGlow = ref<HTMLElement | null>(null)
function onCursorMove(e: PointerEvent) {
  if (!cursorGlow.value || e.pointerType === 'touch') return
  cursorGlow.value.style.left = `${e.clientX}px`
  cursorGlow.value.style.top = `${e.clientY}px`
}

let gsapCtx: { revert?: () => void } | null = null
function initPremiumMotion() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Fallback reveal via IntersectionObserver (funciona sem GSAP)
  const els = document.querySelectorAll('.reveal')
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('in')
        io.unobserve(en.target)
      }
    })
  }, { threshold: 0.12 })
  els.forEach((el) => io.observe(el))

  if (reduced) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
    return
  }
  try {
    gsap.registerPlugin(ScrollTrigger)
    gsapCtx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.gs-reveal').forEach((el) => {
        gsap.fromTo(el, { y: 36, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        })
      })
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count || '0')
        const obj = { v: 0 }
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: () => gsap.to(obj, {
            v: target, duration: 1.6, ease: 'power2.out',
            onUpdate: () => { el.textContent = `${Math.round(obj.v)}${el.dataset.suffix || ''}` },
          }),
        })
      })
    })
  } catch { /* GSAP opcional */ }
}

function handleLandingCategory(categoryName: string) {
  trackCta('categoria_' + categoryName)
  filterCategory.value = categoryName
  const isRealCategory = CATEGORIES.some(c => c.name === categoryName)
  selectedCategory.value = isRealCategory ? categoryName : selectedCategory.value
  // A grade de cartoes e a unica lista de categorias da landing: o formulario
  // de contato reusa a categoria escolhida aqui em vez de repetir a lista.
  landingCategory.value = isRealCategory ? categoryName : ''
  // Escolher (ou limpar) um cartao descarta o servico digitado a mao, senao o
  // estado "nao esta na lista" ficaria preso e enviaria a categoria errada.
  contactForm.value.category = ''
  contactForm.value.categoryOther = ''
  directoryPage.value = 1
  if (activeTab.value !== 'profissionais') {
    goToTab('profissionais')
    window.scrollTo({ top: 0 })
  }
}

const lojaUrl = '/loja.png'

onMounted(() => {
  const ref = typeof route.query.ref === 'string' ? route.query.ref : ''
  if (/^[A-Z0-9]{8}$/.test(ref)) {
    try { localStorage.setItem('casaobra_ref', ref) } catch { /* privado: segue sem referral */ }
  }
  window.addEventListener('pointermove', onCursorMove, { passive: true })
  nextTick(() => initPremiumMotion())
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onCursorMove)
  try { gsapCtx?.revert?.() } catch { /* noop */ }
})
</script>

<template>
  <div ref="cursorGlow" id="cursor-glow" aria-hidden="true"></div>
  <!-- LANDING TESLA STACK -->
  <div v-if="isLanding" class="tesla-stack">
    <!-- 1/5 HERO TESLA fullscreen -->
    <section id="inicio" class="tesla-section tesla-section-hero">
      <div class="tesla-media tesla-media-hero">
        <video v-if="heroVideoUrl" :src="heroVideoUrl" autoplay muted loop playsinline :poster="lojaUrl" class="opacity-70" />
        <img v-else :src="lojaUrl" :alt="t('landing.heroImageAlt')" class="opacity-65" />
      </div>
      <div class="tesla-media tesla-media-obra" aria-hidden="true"><img src="/obrasereparo.png" alt="" loading="eager" /></div>
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div class="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] bg-orange-600/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style="animation-delay: 1.5s" />

      <div class="relative z-10 w-full max-w-[1383px] mx-auto px-6 pt-24 pb-20 flex flex-col items-start text-left">
        <p class="tesla-title text-white text-[32px] sm:text-[32px] leading-tight max-w-xl">{{ t('landing.heroTitle') }}</p>
        <p class="mt-3 text-[14px] text-slate-200/90 max-w-xl">{{ t('landing.heroSubtitle') }}</p>
        <div class="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:min-w-[520px] justify-start">
          <button @click="trackCta('hero_cliente'); goToModule('client', 'register')" class="tesla-cta-primary flex-1 px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.ctaQuote') }}</button>
          <button @click="trackCta('hero_pro'); goToModule('pro', 'register')" class="tesla-cta-secondary flex-1 px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.ctaPro') }}</button>
        </div>
        <p class="mt-4 text-[14px] text-slate-300/60">{{ t('landing.heroBadges') }}</p>
      </div>
    </section>

    <!-- OUR SERVICES (US market) -->
    <section v-if="lang === 'en'" id="our-services" class="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-14 scroll-mt-24">
      <div class="gs-reveal text-center space-y-2 mb-6">
        <h3 class="text-xl sm:text-2xl font-extrabold text-white">{{ t('landing.usServicesTitle') }}</h3>
        <p class="text-xs sm:text-sm text-slate-400">{{ t('landing.usServicesSubtitle') }}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="svc in usServices" :key="svc.category" class="glass group rounded-3xl p-6 border border-slate-800 hover:border-amber-500/40 hover:-translate-y-1 transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-400/15 text-amber-400 flex items-center justify-center border border-amber-500/25 group-hover:scale-110 transition-transform">
            <component :is="svc.icon" class="w-6 h-6" />
          </div>
          <h4 class="mt-4 font-bold text-white text-base">{{ svc.title }}</h4>
          <p class="mt-2 text-xs text-slate-400 leading-relaxed">{{ svc.desc }}</p>
          <button @click="startUsService(svc.category)" class="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200">
            {{ t('landing.usSvcCta') }} <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>

    <!-- TRUST FACTORS (US market) -->
    <section v-if="lang === 'en'" class="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10">
      <div class="gs-reveal glass rounded-3xl p-6 sm:p-8 border border-slate-800">
        <h3 class="text-center text-lg sm:text-xl font-extrabold text-white">{{ t('landing.usTrustTitle') }}</h3>
        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div v-for="trust in usTrust" :key="trust.title" class="flex items-start gap-3">
            <div class="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
              <component :is="trust.icon" class="w-4 h-4" />
            </div>
            <div>
              <p class="text-xs font-bold text-white">{{ trust.title }}</p>
              <p class="mt-1 text-[11px] text-slate-400 leading-relaxed">{{ trust.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAIXA LOGOS abaixo do hero -->
    <div class="w-full bg-slate-950 py-10 sm:py-14">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 gs-reveal space-y-4">
        <p class="text-center text-[11px] font-bold tracking-[0.25em] text-slate-500 uppercase">{{ t('landing.partnersTitle') }}</p>
        <div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 py-4">
          <div class="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
          <div class="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
          <div class="flex animate-marquee gap-4 px-4" style="width: max-content;">
            <span v-for="(logo, i) in [...partnerLogos, ...partnerLogos]" :key="'logo-'+i" class="glass flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-slate-200 whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300"></span>{{ logo }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2/5 ELÉTRICA & HIDRÁULICA split -->
    <section id="servicos-eletrica" class="w-full max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-24">
      <div class="tesla-card-split gs-reveal grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
        <div class="p-6 sm:p-10 flex flex-col justify-center text-left">
          <span class="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold"><Zap class="w-4 h-4" /> {{ t('landing.eletricaBadge') }}</span>
          <p class="tesla-title text-white text-[28px] sm:text-[36px] leading-tight mt-4">{{ t('landing.eletricaTitle') }}</p>
          <p class="mt-3 text-[14px] text-slate-300 max-w-md">{{ t('landing.eletricaDesc') }}</p>
          <div class="mt-6 flex flex-col sm:flex-row gap-3">
            <button @click="trackCta('eletrica_orcamento'); goToModule('client', 'register')" class="tesla-cta-primary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.pedidoOrcamento') }}</button>
            <button @click="scrollToId('como-funciona')" class="tesla-cta-secondary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.comoFunciona') }}</button>
          </div>
        </div>
        <div class="relative min-h-[240px] lg:min-h-[320px] bg-slate-950">
          <img src="https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?auto=compress&cs=tinysrgb&w=1200" :alt="t('landing.eletricaImageAlt')" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/20 to-transparent"></div>
          <div class="absolute bottom-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/85 border border-amber-500/30"><Zap class="w-4 h-4 text-amber-300" /><span class="text-[11px] font-bold text-white">{{ t('landing.resposta24h') }}</span></div>
        </div>
      </div>
    </section>

    <!-- 3/5 PINTURA & REFORMAS split -->
    <section id="servicos-reforma" class="w-full max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-24">
      <div class="tesla-card-split gs-reveal grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
        <div class="relative min-h-[240px] lg:min-h-[320px] bg-slate-950 order-2 lg:order-1">
          <img src="https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1200" :alt="t('landing.pinturaImageAlt')" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-l from-slate-900 via-slate-900/20 to-transparent"></div>
          <div class="absolute bottom-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/85 border border-amber-500/30"><Sparkles class="w-4 h-4 text-amber-300" /><span class="text-[11px] font-bold text-white">{{ t('landing.avaliacao49') }}</span></div>
        </div>
        <div class="p-6 sm:p-10 flex flex-col justify-center text-left order-1 lg:order-2">
          <span class="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold"><Sparkles class="w-4 h-4" /> {{ t('landing.pinturaBadge') }}</span>
          <p class="tesla-title text-white text-[28px] sm:text-[36px] leading-tight mt-4">{{ t('landing.pinturaTitle') }}</p>
          <p class="mt-3 text-[14px] text-slate-300 max-w-md">{{ t('landing.pinturaDesc') }}</p>
          <div class="mt-6 flex flex-col sm:flex-row gap-3">
            <button @click="trackCta('reforma_orcamento'); goToModule('client', 'register')" class="tesla-cta-primary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.pedidoOrcamento') }}</button>
            <button @click="scrollToId('categorias')" class="tesla-cta-secondary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.verServicos') }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- resto compacto -->
    <div class="w-full max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-12">

    <!-- HOW IT WORKS DUAL WORKFLOW -->
    <div class="space-y-6">
      <h3 class="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <Smartphone class="w-5 h-5 text-amber-400" />
        {{ t('landing.dinamicaTitulo') }}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- WORKFLOW CLIENT -->
        <div class="bg-slate-900/80 rounded-3xl p-6 border border-slate-800 space-y-5 relative overflow-hidden backdrop-blur-sm hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
          <div class="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-0 pointer-events-none" />
          <div class="relative z-10 space-y-4">
            <div class="flex items-center gap-3 text-amber-400 font-bold text-sm border-b border-slate-800 pb-3">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/30 to-yellow-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <User class="w-4 h-4" />
              </div>
              {{ t('landing.jornadaCliente') }}
            </div>

            <ul class="space-y-0">
              <li v-for="(step, idx) in [
                { t: t('landing.step1Cli'), d: t('landing.step1CliDesc') },
                { t: t('landing.step2Cli'), d: t('landing.step2CliDesc') },
                { t: t('landing.step3Cli'), d: t('landing.step3CliDesc') },
                { t: t('landing.step4Cli'), d: t('landing.step4CliDesc') },
              ]" :key="'cli-'+idx" class="relative flex items-start gap-3 pb-4 group/step animate-in fade-in slide-in-from-bottom-2 duration-500" :style="{ animationDelay: (idx*120)+'ms' }">
                <div class="flex flex-col items-center shrink-0">
                  <span class="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 text-slate-950 font-bold flex items-center justify-center text-[10px] shadow-lg shadow-amber-500/20 group-hover/step:scale-110 transition-transform z-10">{{ idx + 1 }}</span>
                  <span v-if="idx < 3" class="flex-1 w-px bg-gradient-to-b from-amber-500/50 to-slate-700 my-1 min-h-5" />
                </div>
                <div>
                  <strong class="text-white block text-xs sm:text-sm">{{ step.t }}</strong>
                  <p class="text-xs text-slate-400 leading-relaxed mt-0.5">{{ step.d }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- WORKFLOW PRO -->
        <div class="bg-slate-900/80 rounded-3xl p-6 border border-slate-800 space-y-5 relative overflow-hidden backdrop-blur-sm hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
          <div class="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-0 pointer-events-none" />
          <div class="relative z-10 space-y-4">
            <div class="flex items-center gap-3 text-amber-400 font-bold text-sm border-b border-slate-800 pb-3">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/30 to-yellow-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wrench class="w-4 h-4" />
              </div>
              {{ t('landing.jornadaPro') }}
            </div>

            <ul class="space-y-0">
              <li v-for="(step, idx) in [
                { t: t('landing.step1Pro'), d: t('landing.step1ProDesc') },
                { t: t('landing.step2Pro'), d: t('landing.step2ProDesc') },
                { t: t('landing.step3Pro'), d: t('landing.step3ProDesc') },
                { t: t('landing.step4Pro'), d: t('landing.step4ProDesc') },
              ]" :key="'pro-'+idx" class="relative flex items-start gap-3 pb-4 group/step animate-in fade-in slide-in-from-bottom-2 duration-500" :style="{ animationDelay: (idx*120)+'ms' }">
                <div class="flex flex-col items-center shrink-0">
                  <span class="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 text-slate-950 font-bold flex items-center justify-center text-[10px] shadow-lg shadow-amber-500/20 group-hover/step:scale-110 transition-transform z-10">{{ idx + 1 }}</span>
                  <span v-if="idx < 3" class="flex-1 w-px bg-gradient-to-b from-amber-500/50 to-slate-700 my-1 min-h-5" />
                </div>
                <div>
                  <strong class="text-white block text-xs sm:text-sm">{{ step.t }}</strong>
                  <p class="text-xs text-slate-400 leading-relaxed mt-0.5">{{ step.d }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- KEY FEATURES GRID -->
    <div class="space-y-6">
      <h3 class="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <CheckSquare class="w-5 h-5 text-amber-400" />
        {{ t('landing.recursosTitulo') }}
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="(feat, i) in [
          { icon: Bot, t: t('landing.feat1'), d: t('landing.feat1Desc') },
          { icon: MessageSquare, t: t('landing.feat2'), d: t('landing.feat2Desc') },
          { icon: FileText, t: t('landing.feat3'), d: t('landing.feat3Desc') },
          { icon: TrendingUp, t: t('landing.feat4'), d: t('landing.feat4Desc') },
          { icon: Star, t: t('landing.feat5'), d: t('landing.feat5Desc') },
          { icon: ShieldCheck, t: t('landing.feat6'), d: t('landing.feat6Desc') },
        ]" :key="'feat-'+i" class="relative group bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm overflow-hidden">
          <span class="absolute -top-3 right-2 text-6xl font-black text-stroke-amber select-none pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="relative">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-400/15 text-amber-400 flex items-center justify-center border border-amber-500/25 group-hover:scale-110 group-hover:rotate-6 group-hover:text-amber-300 transition-all duration-300">
              <component :is="feat.icon" class="w-6 h-6" />
            </div>
          </div>
          <h4 class="font-bold text-white text-sm">{{ feat.t }}</h4>
          <p class="text-xs text-slate-400 leading-relaxed">{{ feat.d }}</p>
        </div>
      </div>
    </div>

    <!-- STATS + SVG ANIMADO -->
    <div id="como-funciona" class="gs-reveal glass rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center scroll-mt-24">
      <div class="space-y-5">
        <h3 class="text-2xl sm:text-3xl font-black text-white tracking-tight">{{ t('landing.cliqueAoRecibo') }}</h3>
        <p class="text-sm text-slate-300 leading-relaxed">{{ t('landing.fluxoResumo') }}</p>
        <div v-if="lang !== 'en'" class="grid grid-cols-3 gap-4">
          <div class="text-center"><div class="text-2xl sm:text-3xl font-black text-amber-300" data-count="200" data-suffix="+">0</div><div class="text-[11px] text-slate-400 mt-1">{{ t('landing.statProfissionais') }}</div></div>
          <div class="text-center"><div class="text-2xl sm:text-3xl font-black text-amber-300" data-count="49" data-suffix="">0</div><div class="text-[11px] text-slate-400 mt-1">{{ t('landing.statNota') }}</div></div>
          <div class="text-center"><div class="text-2xl sm:text-3xl font-black text-amber-300" data-count="24" data-suffix="h">0</div><div class="text-[11px] text-slate-400 mt-1">{{ t('landing.statResposta') }}</div></div>
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          <button @click="trackCta('stats_cliente'); goToModule('client','register')" class="btn-shine flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black hover:from-amber-400 hover:to-yellow-300 transition-all">{{ t('landing.pedirOrcamentoAgora') }}</button>
          <button @click="scrollToId('contato')" class="flex-1 px-5 py-3 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 hover:border-amber-500/50 hover:text-white transition-all">{{ t('landing.falarWhatsapp') }}</button>
        </div>
      </div>
      <div class="reveal relative rounded-2xl border border-white/10 bg-slate-950/60 p-6 overflow-hidden">
        <svg viewBox="0 0 300 160" class="w-full h-auto" fill="none" aria-hidden="true">
          <path class="svg-draw" d="M10 130 C 70 130, 70 60, 130 60 S 190 60, 190 30 S 250 20, 290 20" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
          <circle cx="10" cy="130" r="6" fill="#f59e0b" /><circle cx="130" cy="60" r="6" fill="#22c55e" /><circle cx="190" cy="30" r="6" fill="#38bdf8" /><circle cx="290" cy="20" r="6" fill="#facc15" />
        </svg>
        <div class="grid grid-cols-4 gap-2 mt-4 text-center text-[10px] font-bold text-slate-300">
          <span>{{ t('landing.flowPhoto') }}</span><span>{{ t('landing.flowAi') }}</span><span>{{ t('landing.flowWhatsapp') }}</span><span>{{ t('landing.flowReceipt') }}</span>
        </div>
      </div>
    </div>

    <!-- CATEGORIAS GLASSMORPHISM com tilt 3D -->
    <div id="categorias" class="space-y-5 scroll-mt-24">
      <div class="gs-reveal flex items-end justify-between gap-4">
        <div><h3 class="text-xl sm:text-2xl font-extrabold text-white">{{ t('landing.servicosDestaque') }}</h3><p class="text-xs text-slate-400 mt-1">{{ t('landing.cliqueProfissao') }}</p></div>
        <button @click="handleLandingCategory('Todas')" class="hidden sm:flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200">{{ t('landing.verTudo') }} <ArrowRight class="w-4 h-4" /></button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="cat in CATEGORIES" :key="'glass-'+cat.name" @mousemove="handleTilt" @mouseleave="resetTilt" class="tilt-3d glass group rounded-2xl overflow-hidden cursor-pointer transition-shadow hover:shadow-amber-500/20 hover:shadow-2xl" @click="handleLandingCategory(cat.name)">
          <div class="relative h-28 sm:h-32 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br opacity-80" :class="cat.gradient" />
            <img v-if="cat.img" :src="cat.img" :alt="categoryText(cat.name)" loading="lazy" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" @error="($event.target as HTMLImageElement).style.display='none'" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
          </div>
          <div class="tilt-inner p-3.5 flex items-center gap-2.5">
            <component :is="cat.icon" class="w-5 h-5 text-amber-300 shrink-0" />
            <span class="text-xs font-bold text-white leading-tight">{{ categoryText(cat.name) }}</span>
          </div>
        </div>
      </div>
    </div>

    </div><!-- /resto compacto parte 1 -->

    <!-- 4/5 PROFISSIONAIS split -->
    <section id="profissionais" class="w-full max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-24">
      <div class="tesla-card-split gs-reveal grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900">
        <div class="p-6 sm:p-10 flex flex-col justify-center text-left">
          <span class="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold"><Handshake class="w-4 h-4" /> {{ t('landing.paraProfissionais') }}</span>
          <p class="tesla-title text-white text-[28px] sm:text-[36px] leading-tight mt-4">{{ t('landing.recebaChamados') }}</p>
          <p class="mt-3 text-[14px] text-slate-300 max-w-md">{{ t('landing.recebaChamadosDesc') }}</p>
          <div class="mt-5 flex flex-wrap gap-2 text-[12px] font-medium">
            <span class="px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200">{{ planText('gratuito') }} {{ dbPlanPrice('gratuito') }}</span>
            <span class="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950">{{ planText('ouro') }} {{ dbPlanPrice('ouro', 'BRL') }} / {{ dbPlanPrice('ouro', 'USD') }}</span>
          </div>
          <p class="mt-2 text-[11px] text-slate-400">{{ t('plans.billedInBrl') }} · {{ t('plans.billedInUsd') }} · {{ t('plans.cardOnly') }}</p>
          <div class="mt-6 flex flex-col sm:flex-row gap-3">
            <button @click="trackCta('pro_cadastrar'); goToModule('pro','register')" class="tesla-cta-primary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.cadastrarProfissional') }}</button>
            <button @click="scrollToId('contato')" class="tesla-cta-secondary px-8 py-2.5 rounded-full text-[14px] font-medium">{{ t('landing.falarWhatsapp') }}</button>
          </div>
        </div>
        <div class="relative min-h-[240px] lg:min-h-[320px] bg-slate-950">
          <img :src="lojaUrl" :alt="t('landing.storeImageAlt')" loading="lazy" class="absolute inset-0 w-full h-full object-cover" style="object-position: center 22%;" />
          <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/20 to-transparent"></div>
          <div class="absolute bottom-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/85 border border-amber-500/30"><BadgeCheck class="w-4 h-4 text-emerald-400" /><span class="text-[11px] font-bold text-white">{{ t('landing.seloVerificado') }}</span></div>
        </div>
      </div>
    </section>

    <!-- resto compacto parte 2 -->
    <div class="w-full max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-12">
    <!-- FAQ com animações -->
    <div id="faq" class="gs-reveal max-w-3xl mx-auto w-full space-y-4 scroll-mt-24">
      <div class="text-center space-y-2"><h3 class="text-xl sm:text-2xl font-extrabold text-white">{{ t('landing.faqTitulo') }}</h3><p class="text-xs text-slate-400">{{ t('landing.faqSubtitulo') }}</p></div>
      <div class="space-y-2.5">
        <div v-for="(f, i) in faqs" :key="'faq-'+i" class="glass rounded-2xl overflow-hidden">
          <button @click="openFaq = openFaq === i ? null : i" class="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
            <span class="text-xs sm:text-sm font-bold text-white">{{ f.q }}</span>
            <ChevronDown :class="['w-4 h-4 shrink-0 text-amber-300 transition-transform duration-300', openFaq === i ? 'rotate-180' : '']" />
          </button>
          <div :class="['faq-panel px-5', openFaq === i ? 'open' : '']"><div class="faq-inner"><p class="pb-5 text-xs text-slate-300 leading-relaxed">{{ f.a }}</p></div></div>
        </div>
      </div>
    </div>

    </div><!-- /resto compacto parte 2 -->

    <!-- 5/5 CONTATO split -->
    <section id="contato" class="w-full max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-24">
      <div class="tesla-card-split gs-reveal grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900/70">
        <div class="p-6 sm:p-10 flex flex-col justify-center text-left">
          <span class="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"><MessageCircle class="w-4 h-4" /> {{ t('landing.respostaRapida') }}</span>
          <p class="tesla-title text-white text-[28px] sm:text-[36px] leading-tight mt-4">{{ t('landing.faleWhatsappTitulo') }}</p>
          <p class="mt-3 text-[14px] text-slate-300 max-w-md">{{ t('landing.faleWhatsappDesc') }}</p>
          <div class="mt-4 flex items-center gap-2 text-[12px] text-slate-400"><ShieldCheck class="w-4 h-4 text-emerald-400" /> {{ t('landing.dadosIniciamConversa') }}</div>
        </div>
      <form @submit.prevent="handleContactSubmit" class="bg-slate-950/70 p-5 sm:p-8 space-y-4 border-t lg:border-t-0 lg:border-l border-white/10">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input v-model="contactForm.name" required :placeholder="t('auth.seuNome') + ' *'" class="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
          <input v-model="contactForm.phone" :placeholder="t('landing.phonePlaceholder')" class="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input v-model="contactForm.email" type="email" required :placeholder="t('auth.emailPlaceholder') + ' *'" class="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
          <input v-model="contactForm.zip" :required="lang === 'en'" :placeholder="t('landing.zipCode') + (lang === 'en' ? ' *' : '')" inputmode="numeric" autocomplete="postal-code" class="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-[11px] text-slate-400 font-medium">{{ t('auth.categoria') }}</label>
          <div v-if="contactCategory" class="flex items-center gap-2">
            <span class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold">
              {{ categoryText(contactCategory) }}
              <button type="button" @click="clearContactCategory" :aria-label="t('common.close')" class="hover:text-white transition-colors">
                <X class="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
          <div v-else-if="contactUnlisted" class="flex items-center gap-2">
            <span class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold">
              {{ contactForm.categoryOther || t('landing.servicoNaoLista') }}
              <button type="button" @click="clearContactCategory" :aria-label="t('common.close')" class="hover:text-white transition-colors">
                <X class="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
          <button
            v-else
            type="button"
            @click="scrollToId('categorias')"
            class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:border-emerald-500/40 transition-all text-left"
          >
            {{ t('landing.escolhaServicoAcima') }}
          </button>
          <button
            v-if="!contactCategory && !contactUnlisted"
            type="button"
            @click="contactForm.category = CATEGORY_UNLISTED"
            class="text-[11px] text-slate-500 hover:text-emerald-300 underline transition-colors"
          >
            {{ t('landing.servicoNaoLista') }}
          </button>
        </div>
        <div v-if="contactForm.category === CATEGORY_UNLISTED" class="space-y-1.5">
          <input v-model="contactForm.categoryOther" required :placeholder="t('landing.qualServico') + ' *'" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
          <p class="text-[11px] text-slate-500">{{ t('landing.digaQualServico') }}</p>
        </div>
        <input v-model="contactForm.subject" required :placeholder="t('landing.assunto') + ' *'" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
        <textarea v-model="contactForm.message" required rows="3" :placeholder="t('landing.descrevaNecessidade')" class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all resize-none" />
        <div v-if="contactSuccess" class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2"><CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" /><p class="text-xs text-emerald-300">{{ t('landing.whatsOpened') }}</p></div>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="submit" :disabled="contactSubmitting" class="tesla-cta-primary flex-1 px-8 py-2.5 rounded-full text-[14px] font-medium disabled:opacity-50">{{ contactSubmitting ? t('landing.opening') : t('landing.enviarViaWhatsapp') }}</button>
        </div>
      </form>
      </div>
    </section>

    <!-- dots laterais Tesla -->
    <div class="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-2.5">
      <button v-for="s in teslaSections" :key="'dot-'+s.id" @click="scrollToId(s.id)" :title="s.label" :class="['tesla-dot w-2.5 h-2.5 rounded-full', activeSection === s.id ? 'bg-amber-400 scale-125' : 'bg-white/30 hover:bg-white/60']" />
    </div>

    <!-- FAQ compacto pós-stack -->
    <div class="w-full max-w-3xl mx-auto px-4 sm:px-6 py-14">
      <div class="text-center space-y-2"><p class="text-[13px] font-medium text-slate-300">{{ t('landing.duvidasFinal') }}</p></div>
    </div>
  </div>
</template>

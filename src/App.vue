<script setup lang="ts">
import { onMounted, onUnmounted, watch, nextTick, ref } from 'vue'
import { trackEvent } from './lib/analytics'
import { CATEGORIES } from './lib/categories'
import { useAuth } from './composables/useAuth'
import { useNavigation } from './composables/useNavigation'
import { useRequests } from './composables/useRequests'
import { useI18n } from './composables/useI18n'
import ProfileEditModal from './components/ProfileEditModal.vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import ToastHost from './components/layout/ToastHost.vue'
import AuthModal from './components/auth/AuthModal.vue'
import UpgradeModal from './components/modals/UpgradeModal.vue'
import OnboardingPlansModal from './components/modals/OnboardingPlansModal.vue'
import ScheduleModal from './components/modals/ScheduleModal.vue'
import RateModal from './components/modals/RateModal.vue'
import ReceiptModal from './components/modals/ReceiptModal.vue'
import ProfessionalProfileModal from './components/ProfessionalProfileModal.vue'

const {
  authUser, userProfile, userMode,
  showAuth,
  proProfile, showProfileModal, isLanding,
  hydrateAuth, handleProfileModalSaved, loadProfessionalProfile,
} = useAuth()

const {
  onPageScroll,
} = useNavigation()

const { t, lang } = useI18n()

const {
  loadData,
} = useRequests()

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}
const installPrompt = ref<BeforeInstallPromptEvent | null>(null)

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  installPrompt.value = e as BeforeInstallPromptEvent
}
async function installApp() {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  installPrompt.value = null
}

// ---------- Views públicas (landing + diretório) em src/views ----------

onMounted(async () => {
  loadData()
  await hydrateAuth()
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  if (sessionId && proProfile.value.auth_id) {
    await loadProfessionalProfile(proProfile.value.auth_id)
    const url = new URL(window.location.href)
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', url.toString())
  }
  trackEvent('page_view_landing', { path: window.location.pathname })
  window.addEventListener('scroll', onPageScroll, { passive: true })
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', () => { installPrompt.value = null })
  onPageScroll()
  // Reavalia o header quando a landing entra em cena (scroll state global fica no shell — ruling 8)
  watch(isLanding, (v) => {
    if (v) nextTick(() => { onPageScroll() })
  })
})

// Título e meta description acompanham o idioma selecionado
watch(lang, () => {
  if (typeof document === 'undefined') return
  document.title = t('app.title')
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', t('app.description'))
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('scroll', onPageScroll)
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
</script>
<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
    <AppHeader />

    <AuthModal v-if="showAuth" />

    <!-- MAIN CONTENT AREA -->
    <main :class="[isLanding ? 'flex-1 w-full' : 'flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-20']">
      <router-view />
    </main>

    <UpgradeModal />
    <OnboardingPlansModal />

    <ScheduleModal />

    <RateModal />

    <ReceiptModal />

    <ProfessionalProfileModal />

    <!-- MODAL DE EDIÇÃO DE PERFIL / CONTA -->
    <ProfileEditModal
      :open="showProfileModal"
      :role="userMode === 'pro' ? 'pro' : 'client'"
      :professional="proProfile.id ? proProfile : null"
      :auth-id="authUser?.id ?? null"
      :user="userProfile"
      :categories="CATEGORIES.map(c => c.name)"
      @close="showProfileModal = false"
      @saved="handleProfileModalSaved"
    />

    <AppFooter />
    <ToastHost />

    <!-- Banner de instalação PWA -->
    <div
      v-if="installPrompt"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 border border-amber-500/30 rounded-2xl px-4 py-3 shadow-xl"
    >
      <p class="text-xs text-slate-200 font-bold">{{ t('app.install') }}</p>
      <button
        @click="installApp"
        class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all whitespace-nowrap"
      >
        {{ t('app.installCta') }}
      </button>
      <button
        @click="installPrompt = null"
        class="text-slate-400 hover:text-white text-xs font-bold px-1"
        :title="t('app.dismiss')"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style>
@keyframes carousel {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-carousel {
  animation: carousel 30s linear infinite;
}
.animate-carousel:hover {
  animation-play-state: paused;
}
</style>

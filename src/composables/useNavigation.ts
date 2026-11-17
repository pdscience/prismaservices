import { ref, nextTick, computed } from 'vue'
import { trackEvent } from '../lib/analytics'
import { useAuth } from './useAuth'
import { useI18n } from './useI18n'

export type TabId = 'boas_vindas' | 'profissionais' | 'solicitar' | 'meus_pedidos' | 'recibos_cliente'
  | 'historico_cliente' | 'pedidos_pro' | 'faturamento' | 'perfil_pro' | 'historico_pro'
  | 'mensagens_cliente' | 'mensagens_pro' | 'profissionais_cliente'

const activeTab = ref<TabId>('boas_vindas')
const isScrolled = ref(false)
const activeSection = ref('inicio')
// Rótulos traduzidos: depends on the reactive language, so it is a computed.
const teslaSections = computed(() => {
  const { t } = useI18n()
  return [
    { id: 'inicio', label: t('nav.inicio') },
    { id: 'servicos-eletrica', label: t('nav.eletrica') },
    { id: 'servicos-reforma', label: t('nav.pintura') },
    { id: 'contato', label: t('nav.contato') },
  ]
})

// Mapa único tab ↔ path (consumido pelo router na Task 8)
const TAB_PATHS: Record<TabId, string> = {
  boas_vindas: '/', profissionais: '/profissionais',
  solicitar: '/cliente/solicitar', meus_pedidos: '/cliente/pedidos',
  recibos_cliente: '/cliente/recibos', historico_cliente: '/cliente/historico',
  pedidos_pro: '/pro/pedidos', faturamento: '/pro/faturamento',
  perfil_pro: '/pro/perfil', historico_pro: '/pro/historico',
  mensagens_cliente: '/cliente/mensagens', mensagens_pro: '/pro/mensagens',
  profissionais_cliente: '/cliente/profissionais',
}
export function tabToPath(tab: TabId): string { return TAB_PATHS[tab] }
export function pathToTab(path: string): TabId | null {
  return (Object.entries(TAB_PATHS).find(([, p]) => p === path)?.[0] as TabId) ?? null
}
export function setTab(tab: TabId): void { activeTab.value = tab }

// Adapter: preenchido pelo router (Task 8); null = modo tab-based
let navigator: ((path: string) => void) | null = null
export function registerNavigator(fn: (path: string) => void): void { navigator = fn }

export function goToTab(tab: TabId): void {
  activeTab.value = tab
  navigator?.(TAB_PATHS[tab])
}

export function openProfessionalsPage(): void {
  goToTab('profissionais')
  window.scrollTo({ top: 0 })
}

export function trackCta(label: string): void { trackEvent('cta_click', { label }) }

export function scrollToId(id: string): void {
  goToTab('boas_vindas')
  // Com o router, a LandingView pode montar de forma assíncrona após o push;
  // tenta até o elemento existir (sem mudar a assinatura nem o comportamento visual).
  const attempt = (tries: number): void => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (tries > 0) setTimeout(() => { attempt(tries - 1) }, 50)
  }
  nextTick(() => { attempt(20) })
}

export function onPageScroll(): void {
  isScrolled.value = window.scrollY > 24
  // dots: acha seção mais visível
  let current = 'inicio'
  for (const s of teslaSections.value) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.45) current = s.id
  }
  activeSection.value = current
}

export function goToModule(role: 'client' | 'pro', view: 'login' | 'register' = 'login'): void {
  const { authUser, userProfile, authRole, authView, authError, showAuth } = useAuth()
  if (authUser.value && userProfile.value?.role === role) {
    goToTab(role === 'client' ? 'solicitar' : 'pedidos_pro')
    return
  }
  authRole.value = role
  authView.value = view
  authError.value = ''
  showAuth.value = true
}

export function useNavigation() {
  return { activeTab, isScrolled, activeSection, teslaSections, goToTab, setTab, goToModule,
    openProfessionalsPage, scrollToId, trackCta, onPageScroll }
}

import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import type { Component } from 'vue'
import { evaluateRouteGuard } from './guards'
import { useAuth } from '../composables/useAuth'
import { registerNavigator, pathToTab, setTab } from '../composables/useNavigation'
import LandingView from '../views/landing/LandingView.vue'
import DirectoryView from '../views/professionals/DirectoryView.vue'
import SolicitarView from '../views/client/SolicitarView.vue'
import MeusPedidosView from '../views/client/MeusPedidosView.vue'
import RecibosView from '../views/client/RecibosView.vue'
import ClienteHistoricoView from '../views/client/HistoricoView.vue'
import PedidosProView from '../views/pro/PedidosProView.vue'
import FaturamentoView from '../views/pro/FaturamentoView.vue'
import PerfilProView from '../views/pro/PerfilProView.vue'
import MensagensView from '../views/chat/MensagensView.vue'
import ProHistoricoView from '../views/pro/HistoricoView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const client = (name: string, component: Component, path: string): RouteRecordRaw => ({
  path, name, component, meta: { requiresAuth: true, role: 'client' },
})
const pro = (name: string, component: Component, path: string): RouteRecordRaw => ({
  path, name, component, meta: { requiresAuth: true, role: 'pro' },
})

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingView },
    { path: '/profissionais', name: 'profissionais', component: DirectoryView },
    client('cliente-solicitar', SolicitarView, '/cliente/solicitar'),
    client('cliente-pedidos', MeusPedidosView, '/cliente/pedidos'),
    client('cliente-mensagens', MensagensView, '/cliente/mensagens'),
    client('cliente-recibos', RecibosView, '/cliente/recibos'),
    client('cliente-historico', ClienteHistoricoView, '/cliente/historico'),
    pro('pro-pedidos', PedidosProView, '/pro/pedidos'),
    pro('pro-mensagens', MensagensView, '/pro/mensagens'),
    pro('pro-faturamento', FaturamentoView, '/pro/faturamento'),
    pro('pro-perfil', PerfilProView, '/pro/perfil'),
    pro('pro-historico', ProHistoricoView, '/pro/historico'),
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

router.beforeEach(async (to) => {
  const { authUser, userProfile, hydrateAuth, showAuth, authView } = useAuth()
  if (!authUser.value) await hydrateAuth()
  const result = evaluateRouteGuard({
    requiresAuth: !!to.meta.requiresAuth,
    role: to.meta.role as 'client' | 'pro' | undefined,
    isAuthenticated: !!authUser.value,
    currentRole: userProfile.value?.role ?? null,
    fullPath: to.fullPath,
  })
  if (result.action === 'allow') return true
  if (result.openAuth) { authView.value = result.openAuth; showAuth.value = true }
  return result.redirect ? { path: '/', query: { redirect: result.redirect } } : result.to
})

registerNavigator((path) => { void router.push(path) })
router.afterEach((to) => {
  const tab = pathToTab(to.path)
  if (tab) setTab(tab)
})

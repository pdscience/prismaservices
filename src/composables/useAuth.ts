import { ref, computed } from 'vue'
import type { Professional, User as UserProfile } from '../types'
import {
  signInAuth,
  signUpAuth,
  signOutAuth,
  getCurrentAuthUser,
  getUserByAuthId,
  createUserRecord,
  createProfessional,
  getProfessionalByAuthId,
  updateProfessional,
} from '../api/insforgeService'
import { useNavigation } from './useNavigation'
import { useUi, pushToast } from './useUi'
import { useProfessionals } from './useProfessionals'
import { useI18n } from './useI18n'
import { dialOf } from '../lib/geo'

const proProfile = ref<Professional>({
  id: '',
  name: '',
  category: '',
  categories: [],
  portfolio_items: [],
  email: '',
  phone: '',
  rating: 0,
  reviews_count: 0,
  avatar: '',
  pix_key: '',
  bio: '',
  coverage_bairros: [],
  cidade: '',
  uf: '',
  country_code: 'BR',
  state: '',
  municipality: '',
  phone_country_code: '55',
  plan: 'gratuito',
  plan_status: 'active',
  billing_currency: 'BRL',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  plan_expires_at: null,
  trial_used: false,
  referral_code: null,
  referred_by: null,
  requests_this_month: 0,
  requests_reset_at: null,
})

const authUser = ref<{ id: string; email: string; name?: string | null } | null>(null)
const userProfile = ref<UserProfile | null>(null)
const authLoading = ref(false)
const authError = ref('')
const showAuth = ref(false)
const authView = ref<'login' | 'register'>('login')
const authRole = ref<'client' | 'pro'>('client')

const loginEmail = ref('')
const loginPassword = ref('')

const registerForm = ref({
  name: '',
  email: '',
  password: '',
  birth_date: '',
  address: '',
  bairro: '',
  category: '',
  country_code: 'BR',
  state: '',
  state_code: '',
  municipality: '',
  phone: '',
  phone_country: 'BR',
})

const isRegistering = ref<boolean>(false)
const showProfileModal = ref<boolean>(false)

const userMode = computed<'client' | 'pro' | null>(() => userProfile.value?.role ?? null)
const isLanding = computed(() => !authUser.value && useNavigation().activeTab.value === 'boas_vindas')

async function hydrateAuth() {
  try {
    const user = await getCurrentAuthUser()
    if (!user) return
    authUser.value = user
    try {
      userProfile.value = await getUserByAuthId(user.id)
    } catch {
      userProfile.value = null
    }
    if (userProfile.value?.role === 'pro') {
      await loadProfessionalProfile(user.id)
    }
  } catch {
    authUser.value = null
  }
}

async function loadProfessionalProfile(authId: string) {
  try {
    const pro = await getProfessionalByAuthId(authId)
    if (pro) proProfile.value = pro
    if (
      proProfile.value.id &&
      proProfile.value.plan_status === 'trialing' &&
      proProfile.value.plan_expires_at &&
      new Date(proProfile.value.plan_expires_at).getTime() < Date.now()
    ) {
      try {
        const demoted = await updateProfessional(proProfile.value.id, {
          plan: 'gratuito',
          plan_status: 'active',
          plan_expires_at: null,
        })
        proProfile.value = demoted
        pushToast('info', useI18n().t('toasts.trialEnded'))
      } catch {
        // mantém o estado local; nova tentativa no próximo login
      }
    }
  } catch {
    // profile missing is handled by the UI
  }
}

async function handleLogin() {
  const { goToTab } = useNavigation()
  authError.value = ''
  authLoading.value = true
  try {
    const user = await signInAuth(loginEmail.value.trim(), loginPassword.value)
    authUser.value = user
    try {
      userProfile.value = await getUserByAuthId(user.id)
    } catch {
      userProfile.value = null
    }
    if (userProfile.value?.role === 'pro') {
      await loadProfessionalProfile(user.id)
    }
    goToTab(userProfile.value
      ? (userProfile.value.role === 'pro' ? 'pedidos_pro' : 'solicitar')
      : 'boas_vindas')
    showAuth.value = false
    loginEmail.value = ''
    loginPassword.value = ''
  } catch (err) {
    authError.value = err instanceof Error ? err.message : useI18n().t('auth.erroLogin')
  } finally {
    authLoading.value = false
  }
}

async function handleRegister() {
  const { goToTab } = useNavigation()
  const { t } = useI18n()
  authError.value = ''
  if (registerForm.value.password.length < 6) {
    authError.value = t('auth.erroSenhaCurta')
    return
  }
  authLoading.value = true
  try {
    const { user, requireEmailVerification } = await signUpAuth(
      registerForm.value.email.trim(),
      registerForm.value.password,
      registerForm.value.name.trim()
    )
    if (!user) {
      authError.value = requireEmailVerification
        ? t('auth.contaCriadaVerifique')
        : t('auth.naoFoiPossivelCriar')
      return
    }
    authUser.value = user
    const record = await createUserRecord({
      auth_id: user.id,
      role: authRole.value,
      name: registerForm.value.name.trim(),
      email: registerForm.value.email.trim(),
      birth_date: registerForm.value.birth_date,
      address: registerForm.value.address,
      bairro: registerForm.value.bairro,
      cidade: registerForm.value.municipality.trim(),
      uf: registerForm.value.state_code.trim().toUpperCase(),
      country_code: registerForm.value.country_code,
      state: registerForm.value.state.trim(),
      municipality: registerForm.value.municipality.trim(),
      phone: registerForm.value.phone,
      phone_country_code: dialOf(registerForm.value.phone_country),
      category: authRole.value === 'pro' ? registerForm.value.category : '',
    })
    userProfile.value = record
    if (authRole.value === 'pro') {
      let storedRef: string | null = null
      try { storedRef = localStorage.getItem('casaobra_ref') } catch { storedRef = null }
      if (storedRef && !/^[A-Z0-9]{8}$/.test(storedRef)) storedRef = null
      const pro = await createProfessional({
        auth_id: user.id,
        name: registerForm.value.name.trim(),
        category: registerForm.value.category,
        categories: registerForm.value.category ? [registerForm.value.category] : [],
        portfolio_items: [],
        referred_by: storedRef,
        email: registerForm.value.email.trim(),
        phone: registerForm.value.phone,
        phone_country_code: dialOf(registerForm.value.phone_country),
        rating: 0,
        reviews_count: 0,
        avatar: '',
        pix_key: '',
        bio: '',
        coverage_bairros: [],
        cidade: registerForm.value.municipality.trim(),
        uf: registerForm.value.state_code.trim().toUpperCase(),
        country_code: registerForm.value.country_code,
        state: registerForm.value.state.trim(),
        municipality: registerForm.value.municipality.trim(),
        plan: 'gratuito',
        plan_status: 'active',
        billing_currency: 'BRL',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        plan_expires_at: null,
        trial_used: false,
        requests_this_month: 0,
        requests_reset_at: null,
      })
      proProfile.value = pro
      // Só consome o código de indicação depois do cadastro dar certo, para
      // não perder a atribuição se createProfessional falhar.
      try { localStorage.removeItem('casaobra_ref') } catch { /* ignora */ }
      useUi().showOnboardingPlans.value = true
    }
    goToTab(authRole.value === 'pro' ? 'pedidos_pro' : 'solicitar')
    showAuth.value = false
    registerForm.value = {
      name: '', email: '', password: '', birth_date: '', address: '', bairro: '',
      category: '', country_code: 'BR', state: '', state_code: '',
      municipality: '', phone: '', phone_country: 'BR',
    }
    authRole.value = 'client'
    authView.value = 'login'
  } catch (err) {
    authError.value = err instanceof Error ? err.message : useI18n().t('auth.erroCadastro')
  } finally {
    authLoading.value = false
  }
}

async function handleLogout() {
  const { goToTab } = useNavigation()
  const { resetDirectoryFilters, directoryPage } = useProfessionals()
  try {
    await signOutAuth()
  } catch {
    // ignore sign-out errors
  }
  authUser.value = null
  userProfile.value = null
  proProfile.value = {
    id: '',
    name: '',
    category: '',
    categories: [],
    portfolio_items: [],
    email: '',
    phone: '',
    rating: 0,
    reviews_count: 0,
    avatar: '',
    pix_key: '',
    bio: '',
    coverage_bairros: [],
    cidade: '',
    uf: '',
    country_code: 'BR',
    state: '',
    municipality: '',
    phone_country_code: '55',
    referral_code: null,
    referred_by: null,
    plan: 'gratuito',
    plan_status: 'active',
    billing_currency: 'BRL',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan_expires_at: null,
    trial_used: false,
    requests_this_month: 0,
    requests_reset_at: null,
  }
  resetDirectoryFilters()
  directoryPage.value = 1
  goToTab('boas_vindas')
}

function handleHeaderProfileClick() {
  showProfileModal.value = true
}

function handleProfileModalSaved(payload: Professional | UserProfile) {
  if (userMode.value === 'pro') {
    proProfile.value = { ...proProfile.value, ...(payload as Professional) }
  } else if (payload) {
    userProfile.value = payload as UserProfile
  }
}

export function useAuth() {
  return {
    authUser, userProfile, userMode, authLoading, authError,
    showAuth, authView, authRole,
    loginEmail, loginPassword, registerForm, isRegistering,
    proProfile,
    showProfileModal,
    isLanding,
    hydrateAuth,
    handleLogin, handleRegister, handleLogout,
    loadProfessionalProfile,
    handleHeaderProfileClick,
    handleProfileModalSaved,
  }
}

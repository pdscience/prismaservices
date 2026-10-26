<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../composables/useI18n'
import { CATEGORIES } from '../../lib/categories'
import AddressFields from '../AddressFields.vue'
import PhoneInput from '../PhoneInput.vue'
import { X, LogIn, User, Wrench } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { t, categoryText } = useI18n()

const {
  showAuth, authView, authRole, authError, authLoading,
  loginEmail, loginPassword, registerForm,
  handleLogin, handleRegister,
} = useAuth()

async function consumeSavedRedirect(savedRedirect: unknown): Promise<void> {
  // Login/registro com falha mantém o modal aberto com o erro — sem navegar.
  if (authError.value) return
  if (typeof savedRedirect === 'string' && savedRedirect.startsWith('/')) {
    await router.push(savedRedirect)
  }
}

async function onLoginSubmit(): Promise<void> {
  // Captura ANTES: handleLogin navega via goToTab e trocaria a rota (perdendo o query).
  const savedRedirect = route.query.redirect
  await handleLogin()
  await consumeSavedRedirect(savedRedirect)
}

async function onRegisterSubmit(): Promise<void> {
  const savedRedirect = route.query.redirect
  await handleRegister()
  await consumeSavedRedirect(savedRedirect)
}

const logoUrl = '/logo_casa.png'
</script>

<template>
<!-- AUTH MODAL (LOGIN / REGISTER) -->
<div class="fixed inset-0 z-50 overflow-y-auto">
  <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" @click="showAuth = false"></div>
  <div class="relative min-h-full flex items-center justify-center p-4">
    <div class="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
      <div class="relative bg-slate-950 p-6 border-b border-slate-800 overflow-hidden">
        <div class="absolute -top-20 -right-16 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div class="relative flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img :src="logoUrl" alt="Casa Obras e Reparos" class="w-9 h-9 rounded-xl object-cover" />
            <h2 class="font-black text-white text-lg tracking-tight">
              {{ authView === 'login' ? t('auth.entrar') : t('auth.criarConta') }}
              <span class="block text-[11px] font-medium text-slate-400">Prisma Services e Repair</span>
            </h2>
          </div>
          <button @click="showAuth = false" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all">
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div class="p-6 space-y-5">
        <!-- VIEW SWITCH -->
        <div class="bg-slate-950 p-1 rounded-xl border border-slate-800 flex">
          <button
            @click="authView = 'login'; authError = ''"
            :class="[
              'flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all',
              authView === 'login' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
            ]"
          >
            <LogIn class="w-3.5 h-3.5 inline mr-1" /> {{ t('auth.entrar') }}
          </button>
          <button
            @click="authView = 'register'; authError = ''"
            :class="[
              'flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all',
              authView === 'register' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
            ]"
          >
            <User class="w-3.5 h-3.5 inline mr-1" /> {{ t('auth.cadastrar') }}
          </button>
        </div>

        <!-- LOGIN FORM -->
        <form v-if="authView === 'login'" @submit.prevent="onLoginSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.email') }} *</label>
            <input
              v-model="loginEmail"
              type="email"
              required
              :placeholder="t('auth.emailPlaceholder')"
              class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.senha') }} *</label>
            <input
              v-model="loginPassword"
              type="password"
              required
              :placeholder="t('auth.suaSenha')"
              class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
            />
          </div>

          <div v-if="authError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <X class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p class="text-xs text-red-300">{{ authError }}</p>
          </div>

          <button
            type="submit"
            :disabled="authLoading"
            class="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
          >
            <LogIn class="w-4 h-4" />
            {{ authLoading ? t('auth.entrando') : t('auth.entrar') }}
          </button>

          <p class="text-center text-xs text-slate-400">
            {{ t('auth.aindaNaoTemConta') }}
            <button type="button" @click="authView = 'register'; authError = ''" class="text-amber-400 font-bold hover:underline">{{ t('auth.cadastreSe') }}</button>
          </p>
        </form>

        <!-- REGISTER FORM -->
        <form v-else @submit.prevent="onRegisterSubmit" class="space-y-4">
          <!-- ROLE TOGGLE -->
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.euSou') }}</label>
            <div class="bg-slate-950 p-1 rounded-xl border border-slate-800 flex gap-1">
              <button
                type="button"
                @click="authRole = 'client'"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  authRole === 'client' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
                ]"
              >
                <User class="w-3.5 h-3.5" /> {{ t('common.cliente') }}
              </button>
              <button
                type="button"
                @click="authRole = 'pro'"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  authRole === 'pro' ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20' : 'text-slate-400 hover:text-white'
                ]"
              >
                <Wrench class="w-3.5 h-3.5" /> {{ t('common.profissional') }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.nomeCompleto') }} *</label>
              <input
                v-model="registerForm.name"
                type="text"
                required
                :placeholder="t('auth.seuNome')"
                class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.dataNascimento') }}</label>
              <input
                v-model="registerForm.birth_date"
                type="date"
                class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.email') }} *</label>
            <input
              v-model="registerForm.email"
              type="email"
              required
              :placeholder="t('auth.emailPlaceholder')"
              class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.senha') }} * <span class="text-slate-500 font-normal">({{ t('auth.senhaMin') }})</span></label>
            <input
              v-model="registerForm.password"
              type="password"
              required
              :placeholder="t('auth.crieUmaSenha')"
              class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
            />
          </div>

          <div v-if="authRole === 'pro'">
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.categoria') }} *</label>
            <select
              v-model="registerForm.category"
              required
              class="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 hover:border-slate-600 transition-all"
            >
              <option value="">{{ t('auth.selecioneCategoria') }}</option>
              <option v-for="cat in CATEGORIES" :key="cat.name" :value="cat.name">{{ categoryText(cat.name) }}</option>
            </select>
          </div>

          <AddressFields
            v-model:country-code="registerForm.country_code"
            v-model:state-code="registerForm.state_code"
            v-model:state-name="registerForm.state"
            v-model:municipality="registerForm.municipality"
            v-model:street="registerForm.address"
            v-model:neighborhood="registerForm.bairro"
          />

          <PhoneInput
            v-model:phone="registerForm.phone"
            v-model:phone-country="registerForm.phone_country"
          />

          <div v-if="authError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <X class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p class="text-xs text-red-300">{{ authError }}</p>
          </div>

          <button
            type="submit"
            :disabled="authLoading"
            class="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
          >
            <User class="w-4 h-4" />
            {{ authLoading ? t('auth.criando') : t('auth.criarConta') }}
          </button>

          <p class="text-center text-xs text-slate-400">
            {{ t('auth.jaTemConta') }}
            <button type="button" @click="authView = 'login'; authError = ''" class="text-amber-400 font-bold hover:underline">{{ t('auth.entrar') }}</button>
          </p>
        </form>
      </div>
    </div>
  </div>
</div>
</template>

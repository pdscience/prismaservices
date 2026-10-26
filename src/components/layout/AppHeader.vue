<script setup lang="ts">
import { trackEvent } from '../../lib/analytics'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import LanguageSelector from './LanguageSelector.vue'
import { LayoutDashboard, User, LogOut, LogIn, Menu, X } from 'lucide-vue-next'

const { t } = useI18n()

const {
  authUser, userProfile, userMode, proProfile, isLanding,
  showAuth, authView, handleLogout, handleHeaderProfileClick,
} = useAuth()
const {
  activeTab, isScrolled, activeSection, teslaSections,
  goToModule, openProfessionalsPage, scrollToId,
} = useNavigation()
const { isMobileMenuOpen } = useUi()

const logoUrl = '/logo_casa.png'
</script>

<template>
<!-- HEADER TESLA: flutuante transparente sobre hero -->
<header :class="[isLanding && !isScrolled ? 'bg-transparent border-transparent' : 'bg-slate-950/85 backdrop-blur-md border-slate-800/80 shadow-lg shadow-black/20', 'fixed top-0 inset-x-0 z-40 border-b transition-all duration-300']">
  <div class="max-w-[1383px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
        <img :src="logoUrl" alt="Prisma Services e Repair" class="w-10 h-10 rounded-xl object-cover" />
      </div>
      <div>
        <h1 class="font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
          Prisma Services e Repair
        </h1>
        <p class="text-xs text-slate-400 hidden sm:block">
          
        </p>
      </div>
    </div>

    <!-- NAV TESLA (desktop, 5 seções) -->
    <nav v-if="isLanding || activeTab === 'profissionais'" class="hidden md:flex items-center gap-1">
      <button v-for="s in teslaSections" :key="s.id" @click="scrollToId(s.id)" :class="['px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300', activeSection === s.id ? 'text-white bg-white/10' : 'text-slate-200/90 hover:text-white hover:bg-white/10']">
        {{ s.label }}
      </button>
      <button @click="openProfessionalsPage" :class="['px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300', activeTab === 'profissionais' ? 'text-white bg-white/10' : 'text-slate-200/90 hover:text-white hover:bg-white/10']">
        {{ t('nav.profissionais') }}
      </button>
    </nav>

    <div class="flex items-center gap-2">
      <!-- LANGUAGE SELECTOR -->
      <LanguageSelector />

      <!-- AUTH (login/logout) -->
      <template v-if="authUser">
        <button
          @click="goToModule(userProfile?.role === 'pro' ? 'pro' : 'client')"
          class="hidden sm:flex px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all items-center gap-1.5"
          :title="t('nav.meuPainel')"
        >
          <LayoutDashboard class="w-3.5 h-3.5" />
          {{ t('nav.meuPainel') }}
        </button>
        <button
          type="button"
          class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left"
          :title="t('nav.editarDados')"
          @click="handleHeaderProfileClick"
        >
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center shrink-0">
            <User class="w-3.5 h-3.5 text-slate-950" />
          </div>
          <span class="text-xs font-bold text-white max-w-[120px] truncate">{{ (userMode === 'pro' ? proProfile.name : userProfile?.name) || authUser.name || authUser.email }}</span>
        </button>
        <button
          @click="handleLogout"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:border-red-500/50 hover:text-red-400 transition-all flex items-center gap-1.5"
          :title="t('nav.sair')"
        >
          <LogOut class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('nav.sair') }}</span>
        </button>
      </template>
      <button
        v-else
        @click="trackEvent('login_start', {}); showAuth = true; authView = 'login'"
        class="btn-shine px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-xs hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
      >
        <LogIn class="w-4 h-4" />
        {{ t('nav.entrar') }}
      </button>

      <button
        class="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        @click="isMobileMenuOpen = true"
      >
        <Menu class="w-5 h-5" />
      </button>
    </div>
    </div>
</header>

<!-- MOBILE NAVIGATION DRAWER -->
<div v-if="isMobileMenuOpen" class="fixed inset-0 z-50 md:hidden">
  <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" @click="isMobileMenuOpen = false"></div>
  <div class="absolute right-0 top-0 h-full w-72 bg-slate-900 border-l border-slate-800 shadow-2xl p-4 space-y-4 overflow-y-auto">
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <span class="font-bold text-white text-sm">{{ t('nav.navegacao') }}</span>
      <button @click="isMobileMenuOpen = false" class="text-slate-400 hover:text-white">
        <X class="w-5 h-5" />
      </button>
    </div>

    <div class="space-y-2">
      <button
        v-if="authUser"
        @click="goToModule(userProfile?.role === 'pro' ? 'pro' : 'client'); isMobileMenuOpen = false"
        class="w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-amber-500/15 text-amber-300 border border-amber-500/40"
      >
        <LayoutDashboard class="w-4 h-4" />
        {{ t('nav.meuPainel') }}
      </button>
      <template v-if="isLanding || activeTab === 'profissionais'">
        <button v-for="s in teslaSections" :key="'m-'+s.id" @click="scrollToId(s.id); isMobileMenuOpen = false" class="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2 text-slate-200 hover:text-white hover:bg-white/10">
          {{ s.label }}
        </button>
        <button @click="openProfessionalsPage(); isMobileMenuOpen = false" :class="['w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2', activeTab === 'profissionais' ? 'text-white bg-white/10' : 'text-slate-200 hover:text-white hover:bg-white/10']">
          {{ t('nav.profissionais') }}
        </button>
      </template>
    </div>
  </div>
</div>
</template>

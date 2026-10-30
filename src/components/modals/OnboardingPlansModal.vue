<script setup lang="ts">
import { usePlans } from '../../composables/usePlans'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import { Sparkles, Check } from 'lucide-vue-next'

const { displayPlans, subscribePlan, planCurrency } = usePlans()
const { showOnboardingPlans } = useUi()
const { t } = useI18n()
</script>

<template>
<!-- ONBOARDING PLANS (after pro registration) -->
<div v-if="showOnboardingPlans" class="fixed inset-0 z-50 overflow-y-auto">
  <div class="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"></div>
  <div class="relative min-h-full flex items-center justify-center p-4 py-8">
    <div class="w-full max-w-3xl bg-slate-900 rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
      <div class="relative bg-slate-950 p-6 border-b border-slate-800 text-center overflow-hidden">
        <div class="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div class="relative">
          <Sparkles class="w-9 h-9 text-amber-400 mx-auto mb-3" />
          <h3 class="text-xl sm:text-2xl font-black text-white">{{ t('modals.welcomeTitle') }}</h3>
          <p class="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            {{ t('modals.welcomeDesc') }}
          </p>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="p in displayPlans"
            :key="p.id"
            :class="[
              'bg-slate-950/60 rounded-2xl p-4 border transition-all flex flex-col',
              p.id === 'ouro' ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-800'
            ]"
          >
            <div class="flex items-center gap-2 mb-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <component :is="p.icon" class="w-4.5 h-4.5 text-amber-400" style="width:18px;height:18px" />
              </div>
              <div>
                <h4 class="font-bold text-white text-sm">{{ p.name }}</h4>
                <p class="text-amber-400 font-extrabold text-sm">{{ p.price }}<span class="text-[10px] text-slate-400 font-medium">{{ t('pro.perMonth') }}</span></p>
                <p class="text-[10px] text-slate-400">{{ planCurrency === 'BRL' ? t('plans.billedInBrl') : t('plans.billedInUsd') }} · {{ t('plans.cardOnly') }}</p>
              </div>
            </div>
            <p class="text-[10px] text-slate-400 mb-2">{{ p.tagline }}</p>
            <ul class="space-y-1.5 flex-1 mb-3">
              <li v-for="feature in p.features" :key="feature" class="flex items-center gap-1.5">
                <Check class="w-3 h-3 text-green-400 shrink-0" />
                <span class="text-[11px] text-slate-300">{{ feature }}</span>
              </li>
            </ul>
            <button
              v-if="p.id === 'gratuito'"
              @click="showOnboardingPlans = false"
              class="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
            >
              {{ t('plans.ctaContinueFree') }}
            </button>
            <button
              v-else
              @click="subscribePlan(p.id); showOnboardingPlans = false"
              class="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black hover:from-amber-400 hover:to-yellow-300 transition-all shadow-md shadow-amber-500/20"
            >
              {{ p.cta }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-800">
          <p class="text-xs text-slate-400">{{ t('modals.choosePlanLater') }}</p>
          <button
            @click="showOnboardingPlans = false"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          >
            {{ t('modals.skipForNow') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

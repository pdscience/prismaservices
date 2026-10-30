<script setup lang="ts">
import { usePlans } from '../../composables/usePlans'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import { X, Sparkles, Check, Zap } from 'lucide-vue-next'

const { upgradeRecommendation, subscribePlan, planCurrency } = usePlans()
const { showUpgradeModal } = useUi()
const { t } = useI18n()
</script>

<template>
<!-- UPGRADE MODAL -->
<div v-if="showUpgradeModal && upgradeRecommendation" class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" @click="showUpgradeModal = false"></div>
  <div class="relative bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl max-w-md w-full space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-xl font-extrabold text-white">{{ t('modals.upgrade') }}</h3>
      <button @click="showUpgradeModal = false" class="text-slate-400 hover:text-white">
        <X class="w-5 h-5" />
      </button>
    </div>

    <div class="bg-gradient-to-br from-amber-500/10 to-yellow-400/10 rounded-2xl p-6 border border-amber-500/20">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Sparkles class="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h4 class="font-bold text-white text-lg">{{ t('modals.planLabel', { plan: upgradeRecommendation.label }) }}</h4>
          <p class="text-amber-400 font-extrabold text-xl">{{ upgradeRecommendation.price }}<span class="text-sm text-slate-400 font-medium">{{ t('pro.perMonth') }}</span></p>
          <p class="text-[10px] text-slate-400">{{ planCurrency === 'BRL' ? t('plans.billedInBrl') : t('plans.billedInUsd') }} · {{ t('plans.cardOnly') }}</p>
        </div>
      </div>
      <ul class="space-y-2 text-sm text-slate-300">
        <li v-for="feature in upgradeRecommendation.features" :key="feature" class="flex items-center gap-2">
          <Check class="w-4 h-4 text-green-400" />
          {{ feature }}
        </li>
      </ul>
    </div>

    <div class="flex gap-3">
      <button
        @click="showUpgradeModal = false"
        class="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-all"
      >
        {{ t('modals.cancel') }}
      </button>
      <button
        @click="subscribePlan(upgradeRecommendation.plan); showUpgradeModal = false"
        class="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold rounded-xl hover:from-amber-400 hover:to-yellow-300 transition-all flex items-center justify-center gap-2"
      >
        <Zap class="w-5 h-5" />
        {{ t('modals.subscribeNow') }}
      </button>
    </div>
  </div>
</div>
</template>

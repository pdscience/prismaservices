<script setup lang="ts">
import { useNavigation, type TabId } from '../../composables/useNavigation'
import { useChat } from '../../composables/useChat'
import { useI18n } from '../../composables/useI18n'
import { SlidersHorizontal, TrendingUp, Star, History, MessageSquare } from 'lucide-vue-next'

defineProps<{ active: TabId }>()
const { goToTab } = useNavigation()
const { unreadTotal } = useChat()
const { t } = useI18n()
</script>

<template>
  <!-- PRO SUB-TABS -->
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
    <button
      @click="goToTab('pedidos_pro')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'pedidos_pro' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <SlidersHorizontal class="w-3.5 h-3.5" />
      {{ t('pro.dashboard') }}
    </button>
    <button
      @click="goToTab('faturamento')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'faturamento' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <TrendingUp class="w-3.5 h-3.5" />
      {{ t('pro.revenue') }}
    </button>
    <button
      @click="goToTab('perfil_pro')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'perfil_pro' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <Star class="w-3.5 h-3.5" />
      {{ t('pro.myProfile') }}
    </button>
    <button
      @click="goToTab('historico_pro')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'historico_pro' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <History class="w-3.5 h-3.5" />
      {{ t('pro.history') }}
    </button>
    <button
      @click="goToTab('mensagens_pro')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'mensagens_pro' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50', 'relative']"
    >
      <MessageSquare class="w-3.5 h-3.5" />
      {{ t('chat.tab') }}
      <span v-if="unreadTotal > 0" class="bg-amber-400 text-slate-950 font-bold text-[9px] min-w-3.5 h-3.5 px-1 rounded-full flex items-center justify-center">
        {{ unreadTotal }}
      </span>
    </button>
  </div>
</template>

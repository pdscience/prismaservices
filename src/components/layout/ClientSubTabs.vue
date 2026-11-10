<script setup lang="ts">
import { useNavigation, type TabId } from '../../composables/useNavigation'
import { useRequests } from '../../composables/useRequests'
import { useChat } from '../../composables/useChat'
import { useI18n } from '../../composables/useI18n'
import { Bot, Clock, FileText, MessageCircle } from 'lucide-vue-next'

defineProps<{ active: TabId }>()
const { goToTab } = useNavigation()
const { myRequests } = useRequests()
const { unreadTotal } = useChat()
const { t } = useI18n()
</script>

<template>
  <!-- CLIENT SUB-TABS -->
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
    <button
      @click="goToTab('solicitar')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'solicitar' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <Bot class="w-3.5 h-3.5" />
      {{ t('client.requestWithAi') }}
    </button>
    <button
      @click="goToTab('meus_pedidos')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'meus_pedidos' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50', 'relative']"
    >
      <Clock class="w-3.5 h-3.5" />
      {{ t('client.myRequests') }}
      <span v-if="myRequests.length > 0" class="bg-amber-400 text-slate-950 font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
        {{ myRequests.length }}
      </span>
    </button>
    <button
      @click="goToTab('recibos_cliente')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'recibos_cliente' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50']"
    >
      <FileText class="w-3.5 h-3.5" />
      {{ t('client.myReceipts') }}
    </button>
    <button
      @click="goToTab('mensagens_cliente')"
      :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5', active === 'mensagens_cliente' ? 'bg-slate-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50', 'relative']"
    >
      <MessageCircle class="w-3.5 h-3.5" />
      {{ t('chat.tab') }}
      <span v-if="unreadTotal > 0" class="bg-amber-400 text-slate-950 font-bold text-[9px] min-w-3.5 h-3.5 px-1 rounded-full flex items-center justify-center">
        {{ unreadTotal }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { formatRequestDate } from '../../lib/requestStatus'
import type { ServiceRequest } from '../../types'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useRequests } from '../../composables/useRequests'
import { useProfessionals } from '../../composables/useProfessionals'
import { useQuoteForm } from '../../composables/useQuoteForm'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import ClientSubTabs from '../../components/layout/ClientSubTabs.vue'
import { History, MessageSquare, Printer, RotateCcw, Star } from 'lucide-vue-next'

const { t, statusText, categoryText } = useI18n()

const router = useRouter()
const { userMode } = useAuth()
const { activeTab, goToTab } = useNavigation()
const { historicClientRequests } = useRequests()
const { findProfessional } = useProfessionals()

const { handleChooseProfessional } = useQuoteForm()
const { viewReceiptModal, rateOrderModal } = useUi()

function openChat(requestId: string): void {
  void router.push({ name: 'cliente-mensagens', query: { request_id: requestId } })
}

function handleRehire(req: ServiceRequest): void {
  const pro = findProfessional(req.professional_id)
  if (pro) handleChooseProfessional(pro)
}
</script>

<template>
      <!-- MODE CLIENT: HISTÓRICO DE PEDIDOS -->
      <div v-if="userMode === 'client' && activeTab === 'historico_cliente'" class="space-y-6 animate-in fade-in duration-300">
        <ClientSubTabs :active="activeTab" />

        <div>
          <h2 class="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History class="w-5 h-5 text-amber-400" />
            {{ t('clientHistory.title') }}
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ t('clientHistory.desc') }}
          </p>
        </div>

        <div v-if="historicClientRequests.length === 0" class="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <History class="w-10 h-10 text-slate-600 mx-auto" />
          <p class="text-sm text-slate-400">{{ t('clientHistory.empty') }}</p>
          <button
            @click="goToTab('meus_pedidos')"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition-all"
          >
            {{ t('clientHistory.trackActive') }}
          </button>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="req in historicClientRequests"
            :key="req.id"
            class="bg-slate-900 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <img
                  v-if="req.photo_url"
                  :src="req.photo_url"
                  :alt="t('clientHistory.servicePhotoAlt')"
                  class="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0"
                />
                <div class="min-w-0">
                  <p class="font-bold text-white text-sm truncate">{{ req.ai_analysis?.summary || req.category }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    {{ formatRequestDate(req.created_at) }} • {{ categoryText(req.category) }} • {{ findProfessional(req.professional_id)?.name || 'Broadcast' }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  :class="[
                    'text-xs font-bold px-3 py-1 rounded-full border',
                    req.status === 'Concluído'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  ]"
                >
                  {{ statusText(req.status) }}
                </span>
                <span class="text-xs font-extrabold text-white bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                  R$ {{ req.final_price ?? 0 }},00
                </span>
              </div>
            </div>
            <div v-if="req.rating" class="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <Star class="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span><strong class="text-white">{{ req.rating.stars }}/5</strong> — {{ req.rating.comment }}</span>
            </div>
            <div class="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                v-if="req.receipt_issued"
                @click="viewReceiptModal = req"
                class="flex-1 py-2 rounded-xl bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Printer class="w-3.5 h-3.5" /> {{ t('clientHistory.viewReceipt') }}
              </button>
              <button
                v-if="req.status === 'Concluído' && !req.rating"
                @click="rateOrderModal = req"
                class="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
              >
                <Star class="w-3.5 h-3.5" /> {{ t('clientHistory.rateService') }}
              </button>
              <button
                v-if="findProfessional(req.professional_id)"
                @click="handleRehire(req)"
                class="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw class="w-3.5 h-3.5" /> {{ t('clientHistory.requestAgain') }}
              </button>
              <!-- BOTÃO CONVERSAR -->
                <button
                  v-if="req.professional_id"
                  @click="openChat(req.id)"
                  class="flex-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare class="w-3.5 h-3.5" /> {{ t('chat.conversar') }}
                </button>
            </div>
          </div>
        </div>
      </div>
</template>

<script setup lang="ts">
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useRequests } from '../../composables/useRequests'
import { useProfessionals } from '../../composables/useProfessionals'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import ClientSubTabs from '../../components/layout/ClientSubTabs.vue'
import { FileText, Printer } from 'lucide-vue-next'

const { t, categoryText } = useI18n()

const { userMode, proProfile } = useAuth()
const { activeTab } = useNavigation()
const { requests } = useRequests()
const { findProfessional } = useProfessionals()
const { viewReceiptModal } = useUi()
</script>

<template>
      <!-- MODE CLIENT: TAB 3 - MEUS RECIBOS DIGITAIS -->
      <div v-if="userMode === 'client' && activeTab === 'recibos_cliente'" class="space-y-6 animate-in fade-in duration-300">
        <ClientSubTabs :active="activeTab" />

        <div>
          <h2 class="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText class="w-5 h-5 text-amber-400" />
            {{ t('clientReceipts.title') }}
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            {{ t('clientReceipts.desc') }}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="req in requests.filter(r => r.status === 'Concluído' || r.receipt_issued)"
            :key="req.id"
            class="bg-slate-900 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
          >
            <div class="space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="font-mono font-bold text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                  {{ req.id }}
                </span>
                <span class="text-[11px] text-slate-400">
                  {{ t('clientReceipts.date') }}: {{ req.agendamento?.data || '2026-07-29' }}
                </span>
              </div>
              <h4 class="font-bold text-white text-sm">
                {{ req.ai_analysis?.summary || categoryText(req.category) }}
              </h4>
              <p class="text-slate-400">
                {{ t('clientReceipts.responsible') }}: <strong class="text-slate-200">{{ findProfessional(req.professional_id)?.name || proProfile.name }}</strong>
              </p>
              <div class="text-base font-extrabold text-amber-400 pt-1">
                R$ {{ req.final_price ?? req.ai_analysis?.suggestedMinPrice ?? 0 }},00 <span class="text-[10px] text-slate-500 font-normal">({{ t('clientReceipts.amountPaid') }})</span>
              </div>
            </div>

            <button
              @click="viewReceiptModal = req"
              class="w-full py-2.5 rounded-xl bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Printer class="w-4 h-4" /> {{ t('clientReceipts.viewPrint') }}
            </button>
          </div>
        </div>
      </div>
</template>

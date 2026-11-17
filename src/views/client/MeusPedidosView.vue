<script setup lang="ts">
import { useRouter } from 'vue-router'
import { statusSteps, clientStatusGroup } from '../../lib/requestStatus'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useRequests } from '../../composables/useRequests'
import { useProfessionals } from '../../composables/useProfessionals'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import ClientSubTabs from '../../components/layout/ClientSubTabs.vue'
import { Calendar, Clock, FileText, MapPin, MessageSquare, Star, User } from 'lucide-vue-next'

const { t, statusText } = useI18n()

const router = useRouter()
const { userMode } = useAuth()
const { activeTab, goToTab } = useNavigation()
const { myRequests, filteredClientRequests, clientStatusFilter } = useRequests()
const { findProfessional } = useProfessionals()

const { viewReceiptModal, rateOrderModal, ratingStars } = useUi()

function openChat(requestId: string): void {
  void router.push({ name: 'cliente-mensagens', query: { request_id: requestId } })
}
</script>

<template>
      <!-- MODE CLIENT: TAB 2 - MEUS PEDIDOS & STATUS -->
      <div v-if="userMode === 'client' && activeTab === 'meus_pedidos'" class="space-y-6 animate-in fade-in duration-300">
        <ClientSubTabs :active="activeTab" />

        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Clock class="w-5 h-5 text-amber-400" />
              {{ t('clientRequests.title') }}
            </h2>
            <p class="text-xs text-slate-400 mt-1">
              {{ t('clientRequests.desc') }}
            </p>
          </div>
        </div>

        <!-- FILTRO POR STATUS -->
        <div v-if="myRequests.length > 0" class="flex flex-wrap gap-2">
          <button
            v-for="f in ([
              { id: 'todas', label: t('clientRequests.filterAll') },
              { id: 'pendentes', label: t('clientRequests.filterPending') },
              { id: 'andamento', label: t('clientRequests.filterOngoing') },
              { id: 'concluidas', label: t('clientRequests.filterDone') },
            ] as const)"
            :key="f.id"
            @click="clientStatusFilter = f.id"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border',
              clientStatusFilter === f.id
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            ]"
          >
            {{ f.label }}
            <span
              :class="[
                'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                clientStatusFilter === f.id ? 'bg-slate-950/20' : 'bg-slate-800'
              ]"
            >
              {{ f.id === 'todas' ? myRequests.length : myRequests.filter((r) => clientStatusGroup(r.status) === f.id).length }}
            </span>
          </button>
        </div>

        <div v-if="myRequests.length === 0" class="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <p class="text-sm text-slate-400">{{ t('clientRequests.empty') }}</p>
          <button
            @click="goToTab('solicitar')"
            class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all"
          >
            {{ t('clientRequests.firstQuote') }}
          </button>
        </div>

        <div v-else-if="filteredClientRequests.length === 0" class="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <p class="text-sm text-slate-400">{{ t('clientRequests.emptyFilter') }}</p>
          <button
            @click="clientStatusFilter = 'todas'"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition-all"
          >
            {{ t('clientRequests.seeAll') }}
          </button>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="req in filteredClientRequests"
            :key="req.id"
            class="bg-slate-900 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all space-y-5"
          >
            <!-- HEADER LINE -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono font-bold bg-slate-950 text-amber-400 px-2.5 py-1 rounded-lg border border-slate-800">
                  {{ req.id }}
                </span>
                <div>
                  <h3 class="font-bold text-white text-sm">
                    {{ req.ai_analysis?.summary || req.category }}
                  </h3>
                  <p class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <MapPin class="w-3 h-3 text-slate-500" />
                    {{ req.client_address }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {{ statusText(req.status) }}
                </span>
                <span class="text-xs font-extrabold text-white bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                  R$ {{ req.final_price ?? req.ai_analysis?.suggestedMinPrice ?? 0 }},00
                </span>
              </div>
            </div>

            <!-- STEP TIMELINE -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div
                v-for="(step, idx) in statusSteps"
                :key="step"
                :class="[
                  'p-2.5 rounded-xl border text-center transition-all',
                  statusSteps.indexOf(req.status) >= idx
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                ]"
              >
                <div class="text-[10px] uppercase tracking-wider mb-0.5">{{ t('clientRequests.stage') }} {{ idx + 1 }}</div>
                <div class="text-xs truncate">{{ statusText(step) }}</div>
              </div>
            </div>

            <!-- DETAIL CARD CONTENT -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div class="md:col-span-3">
                <img :src="req.photo_url" :alt="t('clientRequests.equipmentAlt')" class="w-full h-28 object-cover rounded-lg border border-slate-800" />
              </div>

              <div class="md:col-span-6 space-y-2 text-xs">
                <p class="text-slate-300">
                  <strong class="text-white">{{ t('clientRequests.aiDescription') }}</strong> {{ req.ai_analysis?.description }}
                </p>
                <div v-if="req.agendamento" class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-amber-300 flex items-center gap-2">
                  <Calendar class="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>{{ t('clientRequests.scheduledVisit') }}</strong> {{ req.agendamento.data }} {{ t('clientRequests.at') }} {{ req.agendamento.hora }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-slate-400">
                  <User class="w-3.5 h-3.5 text-slate-500" />
                  <span>{{ t('clientRequests.serviceProvider') }} <strong>{{ findProfessional(req.professional_id)?.name || t('common.naoAtribuido') }}</strong></span>
                </div>
              </div>

              <div class="md:col-span-3 space-y-2 flex flex-col justify-center">
                <!-- BOTÃO CONVERSAR -->
                <button
                  v-if="req.professional_id"
                  @click="openChat(req.id)"
                  class="w-full py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageSquare class="w-4 h-4" />
                  {{ t('chat.conversar') }}
                </button>

                <!-- RECEIPT BUTTON -->
                <button
                  v-if="req.status === 'Concluído'"
                  @click="viewReceiptModal = req"
                  class="w-full py-2 px-3 rounded-xl bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-slate-700 flex items-center justify-center gap-1.5"
                >
                  <FileText class="w-4 h-4" />
                  {{ t('clientRequests.viewReceipt') }}
                </button>

                <!-- RATING BUTTON -->
                <button
                  v-if="req.status === 'Concluído' && !req.rating"
                  @click="rateOrderModal = req; ratingStars = 5"
                  class="w-full py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 flex items-center justify-center gap-1.5"
                >
                  <Star class="w-4 h-4 fill-amber-400 text-amber-400" />
                  {{ t('clientRequests.rateProvider') }}
                </button>

                <div v-if="req.rating" class="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 text-slate-300 space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-medium">{{ t('clientRequests.yourRating') }}</span>
                    <span class="text-amber-400 font-bold flex items-center">
                      {{ req.rating.stars }} <Star class="w-3 h-3 fill-amber-400 text-amber-400 ml-0.5" />
                    </span>
                    <span class="truncate max-w-[150px]">&quot;{{ req.rating.comment }}&quot;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
</template>

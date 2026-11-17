<script setup lang="ts">
import { computed, watch } from 'vue'
import { filterProfessionals, paginate } from '../../lib/directoryFilters'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { CARDS_PER_PAGE, useProfessionals } from '../../composables/useProfessionals'
import { usePlans } from '../../composables/usePlans'
import { useQuoteForm } from '../../composables/useQuoteForm'
import { useUi } from '../../composables/useUi'
import { useI18n } from '../../composables/useI18n'
import type { Professional } from '../../types'
import ClientSubTabs from '../../components/layout/ClientSubTabs.vue'
import ProfessionalCard from '../../components/ProfessionalCard.vue'
import { Building2 } from 'lucide-vue-next'

const { userMode } = useAuth()
const { t, categoryText, planText } = useI18n()
const { activeTab } = useNavigation()
const {
  filterPlan, filterUf, filterCidade, filterBairro,
  directoryPage,
  availableUfs, availableCidades, availableBairros,
  visibleProfessionals,
  resetDirectoryFilters,
} = useProfessionals()
const { planMap } = usePlans()
const {
  selectedProfessional,
  handleChooseProfessional, clearProfessionalSelection,
} = useQuoteForm()
const { profileModalPro } = useUi()

function openProfile(pro: Professional): void {
  profileModalPro.value = pro
}

// Nesta aba a categoria e escolhida no formulario e nao existe um filtro de
// categoria no diretorio. Por isso a grade ignora o filtro global de categoria
// — senao profissionais sumiriam sem o cliente perceber.
const gridProfessionals = computed(() =>
  filterProfessionals(visibleProfessionals.value, {
    category: 'Todas',
    plan: filterPlan.value,
    uf: filterUf.value,
    cidade: filterCidade.value,
    bairro: filterBairro.value,
  }),
)
const gridTotalPages = computed(() =>
  Math.max(1, Math.ceil(gridProfessionals.value.length / CARDS_PER_PAGE)),
)
const gridPaginated = computed(() =>
  paginate(gridProfessionals.value, Math.min(directoryPage.value, gridTotalPages.value), CARDS_PER_PAGE),
)
// Mantém o indicador de página coerente quando a lista filtrada encolhe.
watch(gridTotalPages, (tp) => {
  if (directoryPage.value > tp) directoryPage.value = tp
})
</script>

<template>
  <!-- MODE CLIENT: TAB - PROFISSIONAIS DISPONÍVEIS -->
  <div v-if="userMode === 'client' && activeTab === 'profissionais_cliente'" class="space-y-6 animate-in fade-in duration-300">
    <ClientSubTabs :active="activeTab" />

    <!-- PROFESSIONAL DIRECTORY -->
    <div v-if="visibleProfessionals.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <Building2 class="w-4 h-4 text-amber-400" />
            {{ t('client.availableProfessionals') }}
          </h3>
          <p class="text-[10px] text-slate-400 mt-0.5">
            {{ gridProfessionals.length }} {{ t('client.foundCount') }}
            <span v-if="selectedProfessional" class="text-amber-300">· {{ t('client.selectedLabel') }}: {{ selectedProfessional.name }}</span>
          </p>
        </div>
      </div>

      <!-- FILTERS -->
      <div class="flex flex-wrap gap-2">
        <select
          v-model="filterPlan"
          class="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        >
          <option value="Todos">🏷️ {{ t('common.allPlans') }}</option>
          <option value="ouro">⭐ {{ planText('ouro') }}</option>
        </select>
        <select
          v-model="filterUf"
          class="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        >
          <option v-for="u in availableUfs" :key="'uf-' + u" :value="u">
            {{ u === 'Todas' ? '📍 ' + t('directory.allUfs') : u }}
          </option>
        </select>
        <select
          v-model="filterCidade"
          class="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        >
          <option v-for="c in availableCidades" :key="'cidade-' + c" :value="c">
            {{ c === 'Todas' ? '🏙️ ' + t('directory.allCities') : c }}
          </option>
        </select>
        <select
          v-model="filterBairro"
          class="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        >
          <option v-for="b in availableBairros" :key="'bairro-' + b" :value="b">
            {{ b === 'Todos' ? '🏘️ ' + t('directory.allNeighborhoods') : b }}
          </option>
        </select>
        <button
          v-if="filterPlan !== 'Todos' || filterUf !== 'Todas' || filterCidade !== 'Todas' || filterBairro !== 'Todos'"
          type="button"
          @click="resetDirectoryFilters"
          class="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-all"
        >
          {{ t('directory.clearFilters') }}
        </button>
      </div>

      <!-- CARDS GRID -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ProfessionalCard
          v-for="pro in gridPaginated"
          :key="pro.id"
          :professional="pro"
          :plan-info="planMap.get(pro.plan) ?? null"
          :selectable="true"
          :selected="selectedProfessional?.id === pro.id"
          @choose="handleChooseProfessional"
          @clear="clearProfessionalSelection"
          @view="openProfile"
        />
      </div>

      <div v-if="gridProfessionals.length === 0" class="bg-slate-900 rounded-2xl p-8 text-center border border-slate-800">
        <p class="text-sm text-slate-400">{{ t('client.noProfessionals') }}</p>
      </div>

      <!-- PAGINATION -->
      <div v-if="gridTotalPages > 1" class="flex items-center justify-center gap-2 pt-2">
        <button
          type="button"
          @click="directoryPage = Math.max(1, directoryPage - 1)"
          :disabled="directoryPage === 1"
          :class="[
            'px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all',
            directoryPage === 1
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          ]"
        >
          ← {{ t('common.prev') }}
        </button>
        <span class="text-[10px] text-slate-400">
          {{ t('common.page') }} {{ directoryPage }} {{ t('common.of') }} {{ gridTotalPages }}
        </span>
        <button
          type="button"
          @click="directoryPage = Math.min(gridTotalPages, directoryPage + 1)"
          :disabled="directoryPage === gridTotalPages"
          :class="[
            'px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all',
            directoryPage === gridTotalPages
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          ]"
        >
          {{ t('common.next') }} →
        </button>
      </div>
    </div>

    <div v-if="selectedProfessional" class="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <p class="text-xs text-amber-200">{{ t('client.requestingFor') }} <strong>{{ selectedProfessional.name }}</strong> ({{ categoryText(selectedProfessional.category) }})</p>
      <button type="button" @click="clearProfessionalSelection" class="text-[11px] text-slate-300 hover:text-white underline">{{ t('client.switchCancel') }}</button>
    </div>
  </div>
</template>

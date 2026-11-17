<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORIES } from '../../lib/categories'
import { trackEvent } from '../../lib/analytics'
import { useAuth } from '../../composables/useAuth'
import { useNavigation } from '../../composables/useNavigation'
import { useProfessionals } from '../../composables/useProfessionals'
import { usePlans } from '../../composables/usePlans'
import { useQuoteForm } from '../../composables/useQuoteForm'
import { useI18n } from '../../composables/useI18n'
import ClientSubTabs from '../../components/layout/ClientSubTabs.vue'
import PhoneInput from '../../components/PhoneInput.vue'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Upload,
  User,
  Users,
  X,
} from 'lucide-vue-next'

const { userMode, authUser, userProfile } = useAuth()
const { t, categoryText, complexityText } = useI18n()
const router = useRouter()
const { activeTab, goToTab } = useNavigation()
const {
  findProfessional,
  availableUfs, availableCidades,
  premiumCount,
} = useProfessionals()
const { PLAN_LABELS } = usePlans()
const {
  selectedCategory, clientName, clientPhone, clientPhoneCountry, clientAddress, clientCity, clientUf, notes,
  imagePreview, photoFile, isAnalyzing, isSubmitting, latestAiResult, createdOrderSuccess, createdOrderWhatsApp,
  sendMode, formError, selectedProfessional, aiReadyToast, aiFallback, directCandidates, pendingAnalysis,
  isRefining, analysisTimedOut,
  handlePhotoUpload, handleAnalyzeWithAI, handleConfirmOrder,
  clearProfessionalSelection, prefillClientData, cancelAnalysisPolling,
} = useQuoteForm()

onUnmounted(cancelAnalysisPolling)

const suggestedCategory = computed(() => {
  const suggested = latestAiResult.value?.category
  if (!suggested || suggested === selectedCategory.value) return null
  return CATEGORIES.some((c) => c.name === suggested) ? suggested : null
})

function applySuggestedCategory(): void {
  if (!suggestedCategory.value) return
  trackEvent('ai_category_applied', {
    from: selectedCategory.value,
    to: suggestedCategory.value,
  })
  selectedCategory.value = suggestedCategory.value
}

watch(userProfile, (profile) => prefillClientData(profile), { immediate: true })
watch(authUser, (user) => {
  if (user && pendingAnalysis.value && !isAnalyzing.value) {
    void handleAnalyzeWithAI()
  }
})

function clearOrderSuccess(): void {
  createdOrderSuccess.value = null
  createdOrderWhatsApp.value = ''
}

function openChat(requestId: string): void {
  void router.push({ name: 'cliente-mensagens', query: { request_id: requestId } })
}

const fileInputRef = ref<HTMLInputElement | null>(null)
const ufOptions = computed(() => availableUfs.value.filter((uf) => uf !== 'Todas'))
const cityOptions = computed(() => availableCidades.value.filter((cidade) => cidade !== 'Todas'))
</script>

<template>
      <!-- MODE CLIENT: TAB 1 - SOLICITAR COM IA -->
      <div v-if="userMode === 'client' && activeTab === 'solicitar'" class="space-y-6 animate-in fade-in duration-300">
        <ClientSubTabs :active="activeTab" />

        <!-- SUCCESS BANNER WHEN ORDER CREATED -->
        <div id="order-success" v-if="createdOrderSuccess" class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <CheckCircle2 class="w-6 h-6" />
            </div>
            <div>
              <h3 class="font-bold text-white text-base">
                {{ t('client.requestSent', { id: createdOrderSuccess.id }) }}
              </h3>
              <p v-if="createdOrderSuccess.broadcast" class="text-xs text-slate-300 mt-1">
                {{ t('client.broadcastSent') }}
              </p>
              <p v-else class="text-xs text-slate-300 mt-1">
                {{ t('client.proNotified', { name: findProfessional(createdOrderSuccess.professional_id)?.name || t('common.prestador') }) }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              v-if="createdOrderSuccess && !createdOrderSuccess.broadcast"
              @click="openChat(createdOrderSuccess.id)"
              class="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
            >
              {{ t('chat.conversar') }}
              <MessageSquare class="w-4 h-4" />
            </button>
            <button
              @click="goToTab('meus_pedidos'); clearOrderSuccess()"
              class="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {{ t('client.trackRequest') }}
              <ArrowRight class="w-4 h-4" />
            </button>
            <button
              @click="clearOrderSuccess()"
              class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              {{ t('common.close') }}
            </button>
          </div>
        </div>

        <!-- HERO INTRODUCTION -->
        <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />
          <div class="relative z-10 space-y-3">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Sparkles class="w-3.5 h-3.5" /> {{ t('client.aiTechnicalQuote') }}
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {{ t('client.aiTitle') }}
            </h2>
            <p class="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {{ t('client.aiDesc') }}
            </p>
          </div>
        </div>

        <div v-if="selectedProfessional" class="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p class="text-xs text-amber-200">{{ t('client.requestingFor') }} <strong>{{ selectedProfessional.name }}</strong> ({{ categoryText(selectedProfessional.category) }})</p>
          <button type="button" @click="clearProfessionalSelection" class="text-[11px] text-slate-300 hover:text-white underline">{{ t('client.switchCancel') }}</button>
        </div>

        <div id="solicitar-form" class="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-24">
          <!-- LEFT COLUMN: UPLOAD & INPUTS -->
          <div class="lg:col-span-7 bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-5">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <Camera class="w-5 h-5 text-amber-400" />
              {{ t('client.photoStep') }}
            </h3>

            <!-- UPLOAD ZONE -->
            <div class="space-y-3">
              <input
                type="file"
                ref="fileInputRef"
                @change="handlePhotoUpload"
                accept="image/*"
                class="hidden"
              />

              <div v-if="imagePreview" class="relative rounded-xl overflow-hidden border border-slate-700 group bg-slate-950">
                <img :src="imagePreview" alt="Preview" class="w-full h-64 object-cover" />
                <div class="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                  <button
                    @click="fileInputRef?.click()"
                    class="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5"
                  >
                    <RefreshCw class="w-4 h-4" /> {{ t('client.trocarFoto') }}
                  </button>
                  <button
                    @click="imagePreview = null; photoFile = null"
                    class="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-medium hover:bg-rose-500/30 border border-rose-500/30 flex items-center gap-1.5"
                  >
                    <X class="w-4 h-4" /> {{ t('client.remover') }}
                  </button>
                </div>
              </div>

              <div
                v-else
                @click="fileInputRef?.click()"
                class="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/50 hover:bg-slate-950 group"
              >
                <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload class="w-7 h-7" />
                </div>
                <p class="text-sm font-semibold text-slate-200">
                  {{ t('client.uploadHint') }}
                </p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ t('client.uploadFormats') }}
                </p>
                <p class="text-[11px] text-amber-400/80 mt-2">
                  {{ t('client.photoOptional') }}
                </p>
              </div>
            </div>

            <!-- CATEGORY SELECTOR -->
            <div class="space-y-2 pt-2">
              <label class="text-xs font-semibold text-slate-300">
                {{ t('client.categoryStep') }}
              </label>
              <select
                v-model="selectedCategory"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500 transition-all"
              >
                <option v-for="cat in CATEGORIES" :key="cat.name" :value="cat.name">{{ categoryText(cat.name) }}</option>
              </select>
            </div>

            <!-- CLIENT DETAILS FORM -->
            <div class="space-y-3 pt-2 border-t border-slate-800">
              <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {{ t('client.dataStep') }} <span class="text-amber-400 normal-case">{{ t('client.dataStepHint') }}</span>
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('client.fullName') }} *</label>
                  <input
                    type="text"
                    v-model="clientName"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                    placeholder="Ex: Carlos Costa"
                  />
                </div>
                <PhoneInput
                  v-model:phone="clientPhone"
                  v-model:phone-country="clientPhoneCountry"
                  :label="t('client.phoneNotify')"
                />
              </div>
              <div>
                <label class="text-[11px] text-slate-400 font-medium">{{ t('client.serviceAddress') }} *</label>
                <input
                  type="text"
                  v-model="clientAddress"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-1"
                  placeholder="Ex: Rua Funchal, 200 - Bairro"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">{{ t('common.cidade') }} *</label>
                  <input
                    type="text"
                    v-model="clientCity"
                    list="client-cities"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-1"
                    placeholder="Ex: Dourados"
                  />
                  <datalist id="client-cities">
                    <option v-for="cidade in cityOptions" :key="cidade" :value="cidade" />
                  </datalist>
                </div>
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">{{ t('common.estadoProvincia') }} *</label>
                  <input
                    type="text"
                    v-model="clientUf"
                    list="client-ufs"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-amber-500 mt-1"
                    placeholder="MS"
                  />
                  <datalist id="client-ufs">
                    <option v-for="uf in ufOptions" :key="uf" :value="uf" />
                  </datalist>
                </div>
              </div>
              <div>
                <label class="text-[11px] text-slate-400 font-medium">{{ t('client.extraNote') }}</label>
                <textarea
                  v-model="notes"
                  rows="2"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-1 resize-none"
                  :placeholder="t('client.notePlaceholder')"
                />
              </div>
            </div>

            <!-- AI SUBMIT BUTTON -->
            <button
              type="button"
              @click="handleAnalyzeWithAI"
              :disabled="isAnalyzing"
              class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-extrabold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <template v-if="isAnalyzing">
                <RefreshCw class="w-5 h-5 animate-spin" />
                {{ t('client.analyzingImage') }}
              </template>
              <template v-else>
                <Bot class="w-5 h-5" />
                {{ t('client.analyzeAndQuote') }}
              </template>
            </button>
          </div>

          <!-- RIGHT COLUMN: AI RESULT BREAKDOWN & CONFIRMATION -->
          <div class="lg:col-span-5 space-y-5">
            <div class="bg-slate-900 rounded-2xl p-6 border border-slate-800 h-full flex flex-col justify-between">
              <div class="space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 class="font-bold text-white text-base flex items-center gap-2">
                    <Sparkles class="w-5 h-5 text-amber-400" />
                    {{ t('client.aiResultTitle') }}
                  </h3>
                  <span v-if="latestAiResult" class="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded-full border border-amber-500/20">
                    {{ t('client.ready') }}
                  </span>
                </div>

                <div v-if="!latestAiResult && !isAnalyzing" class="text-center py-12 text-slate-400 space-y-3">
                  <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Bot class="w-6 h-6" />
                  </div>
                  <p class="text-xs max-w-xs mx-auto leading-relaxed">
                    {{ t('client.emptyResult') }}
                  </p>
                </div>

                <div v-if="isAnalyzing" class="text-center py-12 space-y-4">
                  <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto animate-bounce">
                    <Bot class="w-6 h-6" />
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-bold text-amber-400">
                      {{ t('client.processing') }}
                    </p>
                    <p class="text-[11px] text-slate-400">
                      {{ t('client.processingSub') }}
                    </p>
                  </div>
                </div>

                <div v-if="latestAiResult && !isAnalyzing" class="space-y-4 text-xs animate-in fade-in duration-200">
                  <div v-if="latestAiResult.suggestedMinPrice === 0 && latestAiResult.suggestedMaxPrice === 0" class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
                    <Bot class="w-4 h-4 text-blue-400 shrink-0" />
                    <p class="text-[11px] text-blue-300">{{ t('client.preliminary') }}</p>
                  </div>
                  <div v-if="aiReadyToast" class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
                    <p class="text-[11px] text-emerald-300">{{ t('client.aiDone') }}</p>
                  </div>
                  <div v-if="isRefining" class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
                    <RefreshCw class="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
                    <p class="text-[11px] text-blue-300">{{ t('client.aiRefining') }}</p>
                  </div>
                  <div v-if="analysisTimedOut" class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle :size="14" class="mt-0.5 shrink-0 text-amber-400" />
                    <p class="text-[11px] text-amber-200">{{ t('client.aiTimeout') }}</p>
                  </div>
                  <div v-if="suggestedCategory" class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <Sparkles class="w-4 h-4 text-amber-400 shrink-0" />
                      <p class="text-[11px] text-amber-200">
                        {{ t('client.aiSuggestedCategory', { category: categoryText(suggestedCategory) }) }}
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="applySuggestedCategory"
                      class="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-bold hover:bg-amber-400 transition-colors"
                    >
                      {{ t('client.useSuggestedCategory') }}
                    </button>
                  </div>
                  <!-- SUMMARY HEADER -->
                  <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] uppercase font-bold text-slate-400">
                        {{ t('client.problemFound') }}
                      </span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {{ t('client.complexity') }} {{ complexityText(latestAiResult.complexity) }}
                      </span>
                    </div>
                    <h4 class="text-sm font-bold text-white">
                      {{ latestAiResult.summary }}
                    </h4>
                    <p class="text-slate-300 leading-relaxed text-[11px]">
                      {{ latestAiResult.description }}
                    </p>
                    <div class="flex flex-wrap gap-1.5 pt-1">
                      <span v-if="latestAiResult.confidence !== undefined" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {{ t('client.aiConfidence') }} {{ Math.round(latestAiResult.confidence * 100) }}%
                      </span>
                      <span v-if="latestAiResult.urgency" class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {{ t('client.aiUrgency') }} {{ complexityText(latestAiResult.urgency) }}
                      </span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {{ t('client.aiRecommendation') }}
                        {{ latestAiResult.recommendedAction === 'Visita Técnica' ? t('ai.actionVisit') : t('ai.actionDirect') }}
                      </span>
                    </div>
                  </div>

                  <!-- ESTIMATED PRICE RANGE -->
                  <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                        {{ t('client.serviceEstimate') }}
                      </span>
                      <span v-if="latestAiResult.suggestedMinPrice > 0 || latestAiResult.suggestedMaxPrice > 0" class="text-xl font-extrabold text-white">
                        R$ {{ latestAiResult.suggestedMinPrice }},00 ~ R$ {{ latestAiResult.suggestedMaxPrice }},00
                      </span>
                      <span v-else class="text-base font-extrabold text-white">
                        {{ t('client.proWillProvide') }}
                      </span>
                      <span v-if="latestAiResult.suggestedMinPrice === 0 && latestAiResult.suggestedMaxPrice === 0" class="block text-[10px] text-slate-400 mt-0.5">
                        {{ t('client.forecastUnavailable') }}
                      </span>
                    </div>
                    <div class="text-right">
                      <span class="text-[10px] text-slate-400 block">{{ t('client.estTime') }}</span>
                      <span class="text-xs font-bold text-slate-200">
                        {{ latestAiResult.estimatedTime }}
                      </span>
                    </div>
                  </div>

                  <!-- MATERIALS NEEDED -->
                  <div v-if="aiFallback && latestAiResult"
                    class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle :size="14" class="mt-0.5 shrink-0" />
                    <span>{{ t('client.aiUnavailable') }}</span>
                  </div>
                  <div class="space-y-1.5">
                    <span class="font-bold text-slate-300 text-[11px] flex items-center gap-1">
                      <CheckCircle2 class="w-3.5 h-3.5 text-amber-400" />
                      {{ t('client.materials') }}
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="(mat, i) in latestAiResult.materialsNeeded"
                        :key="i"
                        class="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[10px]"
                      >
                        • {{ mat }}
                      </span>
                    </div>
                  </div>

                  <!-- TECHNICAL RECOMMENDATION -->
                  <div v-if="latestAiResult.technicalNotes" class="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                    <span class="font-bold text-amber-400 block">
                      {{ t('client.techNotes') }}
                    </span>
                    <p>{{ latestAiResult.technicalNotes }}</p>
                  </div>

                  <!-- SEND MODE CHOICE -->
                  <div v-if="!sendMode" class="space-y-2 pt-2">
                    <span class="font-bold text-amber-400 text-[11px] block">
                      {{ t('client.howToSend') }}
                    </span>
                    <button
                      v-if="selectedProfessional"
                      type="button"
                      @click="sendMode = 'direct'"
                      class="w-full p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 transition-all text-left flex items-start gap-3"
                    >
                      <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check class="w-5 h-5" />
                      </div>
                      <div>
                        <p class="font-bold text-white text-xs">{{ t('client.sendToPro') }} {{ selectedProfessional.name }}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">
                          {{ categoryText(selectedProfessional.category) }} · {{ t('client.directContact') }}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      @click="sendMode = 'broadcast'"
                      class="w-full p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all text-left flex items-start gap-3"
                    >
                      <div class="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Users class="w-5 h-5" />
                      </div>
                      <div>
                        <p class="font-bold text-white text-xs">{{ t('client.sendToAll') }}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">
                          {{ t('client.broadcastDesc', { count: premiumCount }) }}
                        </p>
                      </div>
                    </button>
                    <button
                      v-if="!selectedProfessional && directCandidates.length > 0"
                      type="button"
                      @click="sendMode = 'direct'"
                      class="w-full p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-left flex items-start gap-3"
                    >
                      <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles class="w-5 h-5" />
                      </div>
                      <div>
                        <p class="font-bold text-white text-xs">{{ t('client.chooseSpecific') }}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">
                          {{ t('client.chooseBelow', { category: categoryText(selectedCategory) }) }}
                        </p>
                      </div>
                    </button>
                  </div>

                  <!-- BROADCAST CONFIRM -->
                  <div v-if="sendMode === 'broadcast'" class="space-y-2">
                    <div class="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                      <p class="text-[10px] text-cyan-400 font-bold">
                        {{ t('client.sendingTo', { count: premiumCount }) }}
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="sendMode = null"
                      class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {{ t('client.backChoose') }}
                    </button>
                  </div>

                  <!-- DIRECT SELECTION (qualquer plano) -->
                  <div v-if="sendMode === 'direct'" class="space-y-2">
                    <button
                      type="button"
                      @click="clearProfessionalSelection"
                      class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {{ t('client.backChoose') }}
                    </button>
                    <span class="font-bold text-amber-400 text-[11px] block">
                      {{ t('client.selectPro', { category: categoryText(selectedCategory) }) }}
                    </span>
                    <div
                      v-for="pro in directCandidates"
                      :key="pro.id"
                      @click="selectedProfessional = pro"
                      :class="[
                        'p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all',
                        selectedProfessional?.id === pro.id
                          ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      ]"
                    >
                      <div class="flex items-center gap-3">
                        <img v-if="pro.avatar" :src="pro.avatar" :alt="pro.name" class="w-10 h-10 rounded-full object-cover border border-slate-700" />
                        <div v-else class="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <User class="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p class="font-bold text-white text-xs">{{ pro.name }}</p>
                          <p class="text-[10px] text-slate-400">{{ categoryText(pro.category) }} · {{ PLAN_LABELS[pro.plan] ?? pro.plan }}</p>
                        </div>
                      </div>
                      <div class="text-right">
                        <span class="text-xs font-bold text-amber-400 flex items-center gap-1">
                          <Star class="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {{ pro.rating ?? 0 }}
                        </span>
                        <span class="text-[9px] text-slate-400">({{ pro.reviews_count ?? 0 }})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CONFIRM ORDER BUTTON -->
              <div v-if="latestAiResult && !isAnalyzing && sendMode" class="pt-4 mt-4 border-t border-slate-800">
                <div v-if="formError" class="mb-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                  <X class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p class="text-xs text-red-300">{{ formError }}</p>
                </div>
                <button
                  type="button"
                  @click="handleConfirmOrder"
                  :disabled="isSubmitting || (sendMode === 'direct' && !selectedProfessional)"
                  :class="[
                    'w-full py-3 rounded-xl font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2',
                    (sendMode === 'broadcast' || (sendMode === 'direct' && selectedProfessional)) && !isSubmitting
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                  ]"
                >
                  <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
                  <Check v-else class="w-4 h-4" />
                  <template v-if="isSubmitting">
                    {{ t('client.sending') }}
                  </template>
                  <template v-else-if="sendMode === 'broadcast'">
                    {{ t('client.sendToN', { count: premiumCount }) }}
                  </template>
                  <template v-else-if="sendMode === 'direct' && selectedProfessional">
                    {{ t('client.sendToPro') }} {{ selectedProfessional.name }}
                  </template>
                  <template v-else>
                    {{ t('client.selectAPro') }}
                  </template>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
</template>

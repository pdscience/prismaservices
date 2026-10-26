<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Camera, User, Loader2, AlertCircle, MapPin } from 'lucide-vue-next'
import type { Professional, User as UserProfile } from '../types'
import { uploadProfessionalAvatar, updateProfessional, updateUserRecord, createProfessional } from '../api/insforgeService'
import { useNavigation } from '../composables/useNavigation'
import { usePlans } from '../composables/usePlans'
import { useI18n } from '../composables/useI18n'
import { canAddCategory, isOverCategoryLimit } from '../lib/planLimits'
import { dialOf } from '../lib/geo'
import { countryFromE164, validateE164 } from '../lib/phone'
import AddressFields from './AddressFields.vue'
import PhoneInput from './PhoneInput.vue'

const props = defineProps<{
  open: boolean
  role: 'pro' | 'client'
  professional: Professional | null
  user: UserProfile | null
  categories: string[]
  authId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', payload: Professional | UserProfile): void
}>()

const saving = ref(false)
const errorMessage = ref('')

const name = ref('')
const category = ref('')
const selectedCategories = ref<string[]>([])
const email = ref('')
const phone = ref('')
const pixKey = ref('')
const bio = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const coverageBairros = ref<string[]>([])
const newBairro = ref('')
const phoneCountry = ref('BR')
const proCountryCode = ref('BR')
const proStateCode = ref('')
const proStateName = ref('')
const proMunicipality = ref('')

const birthDate = ref('')
const address = ref('')
const bairro = ref('')
const userCountryCode = ref('BR')
const userStateCode = ref('')
const userStateName = ref('')
const userMunicipality = ref('')

const { t, categoryText } = useI18n()

const title = computed(() =>
  props.role === 'pro' && !props.professional
    ? t('profile.registerTitle')
    : (props.role === 'pro' ? t('profile.editProTitle') : t('profile.editMyData')),
)
const currentAvatar = computed(() => avatarPreview.value || props.professional?.avatar || '')

const { goToTab } = useNavigation()
const { planFeatures } = usePlans()
const maxCategories = computed(() => planFeatures.value.maxCategories)
const categoriesLabel = computed(() =>
  maxCategories.value === null
    ? t('profile.unlimitedCategories')
    : `${selectedCategories.value.length} de ${maxCategories.value}`,
)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    errorMessage.value = ''
    saving.value = false
    avatarFile.value = null
    avatarPreview.value = null

    if (props.role === 'pro') {
      name.value = props.professional?.name ?? ''
      category.value = props.professional?.category ?? ''
      const initialCats = [...(props.professional?.categories ?? [])]
      if (initialCats.length === 0 && props.professional?.category) initialCats.push(props.professional.category)
      selectedCategories.value = initialCats
      email.value = props.professional?.email ?? ''
      phone.value = props.professional?.phone ?? ''
      phoneCountry.value = countryFromE164(props.professional?.phone ?? '') || props.professional?.country_code || 'BR'
      pixKey.value = props.professional?.pix_key ?? ''
      bio.value = props.professional?.bio ?? ''
      coverageBairros.value = [...(props.professional?.coverage_bairros ?? [])]
      newBairro.value = ''
      proCountryCode.value = props.professional?.country_code || 'BR'
      proStateCode.value = props.professional?.uf || ''
      proStateName.value = props.professional?.state || ''
      proMunicipality.value = props.professional?.municipality || props.professional?.cidade || ''
      return
    }

    name.value = props.user?.name ?? ''
    birthDate.value = props.user?.birth_date ?? ''
    address.value = props.user?.address ?? ''
    bairro.value = props.user?.bairro ?? ''
    phone.value = props.user?.phone ?? ''
    phoneCountry.value = countryFromE164(props.user?.phone ?? '') || props.user?.country_code || 'BR'
    userCountryCode.value = props.user?.country_code || 'BR'
    userStateCode.value = props.user?.uf || ''
    userStateName.value = props.user?.state || ''
    userMunicipality.value = props.user?.municipality || props.user?.cidade || ''
  },
)

function handleAvatarUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  avatarFile.value = file
  const reader = new FileReader()
  reader.onloadend = () => {
    avatarPreview.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

function addBairro() {
  const value = newBairro.value.trim()
  if (!value) return
  const exists = coverageBairros.value.some((b) => b.toLowerCase() === value.toLowerCase())
  if (!exists) coverageBairros.value.push(value)
  newBairro.value = ''
}

function removeBairro(index: number) {
  coverageBairros.value.splice(index, 1)
}

function toggleCategory(cat: string) {
  const idx = selectedCategories.value.indexOf(cat)
  if (idx >= 0) {
    selectedCategories.value.splice(idx, 1)
    return
  }
  if (!canAddCategory(selectedCategories.value, maxCategories.value)) {
    fail(maxCategories.value === null
      ? t('profile.errPlanUnlimitedCategories')
      : t('profile.errPlanCategories', { count: maxCategories.value }))
    return
  }
  selectedCategories.value.push(cat)
}

function fail(message: string) {
  errorMessage.value = message
}

async function handleSave() {
  errorMessage.value = ''
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    fail(t('profile.errName'))
    return
  }

  if (props.role === 'pro') {
    const professional = props.professional
    if (!professional) {
      // Modo cadastro: cria a linha do profissional vinculada ao login atual
      if (!props.authId) {
        fail(t('profile.errLoginAgain'))
        return
      }
      const createPhone = validateE164(phone.value)
      if (!createPhone.ok) {
        fail(t('common.errTelefoneInvalido'))
        return
      }
      if (isOverCategoryLimit(selectedCategories.value, maxCategories.value)) {
        fail(t('profile.errCategoryLimit'))
        return
      }
      saving.value = true
      try {
        const ownerId = props.authId
        const avatarUrl = avatarFile.value ? await uploadProfessionalAvatar(avatarFile.value, ownerId) : ''
        let storedRef: string | null = null
        try { storedRef = localStorage.getItem('casaobra_ref') } catch { storedRef = null }
        if (storedRef && !/^[A-Z0-9]{8}$/.test(storedRef)) storedRef = null
        const created = await createProfessional({
          name: trimmedName,
          category: selectedCategories.value[0] ?? '',
          categories: [...selectedCategories.value],
          portfolio_items: [],
          email: email.value.trim(),
          phone: createPhone.e164,
          phone_country_code: dialOf(phoneCountry.value),
          pix_key: pixKey.value,
          bio: bio.value,
          coverage_bairros: [...coverageBairros.value],
          cidade: proMunicipality.value.trim(),
          uf: proStateCode.value.trim().toUpperCase(),
          country_code: proCountryCode.value,
          state: proStateName.value.trim(),
          municipality: proMunicipality.value.trim(),
          avatar: avatarUrl,
          auth_id: ownerId,
          rating: 0,
          reviews_count: 0,
          plan: 'gratuito',
          plan_status: 'active',
          billing_currency: 'BRL',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          plan_expires_at: null,
          trial_used: false,
          referred_by: storedRef,
          requests_this_month: 0,
          requests_reset_at: null,
        })
        try { localStorage.removeItem('casaobra_ref') } catch { /* mantém p/ próxima tentativa */ }
        emit('saved', created)
        emit('close')
      } catch (err) {
        console.error('Erro ao criar perfil profissional:', err)
        fail(t('profile.errSave'))
      } finally {
        saving.value = false
      }
      return
    }
    const phoneCheck = validateE164(phone.value)
    if (!phoneCheck.ok) {
      fail(t('common.errTelefoneInvalido'))
      return
    }
    if (isOverCategoryLimit(selectedCategories.value, maxCategories.value)) {
      fail(t('profile.errCategoryLimit'))
      return
    }
    saving.value = true
    try {
      const ownerId = professional.auth_id
      if (avatarFile.value && !ownerId) {
        fail(t('profile.errLoginPhoto'))
        return
      }
      const avatarUrl = avatarFile.value && ownerId ? await uploadProfessionalAvatar(avatarFile.value, ownerId) : professional.avatar
      const updated = await updateProfessional(professional.id, {
        name: trimmedName,
        category: selectedCategories.value[0] ?? '',
        categories: [...selectedCategories.value],
        email: email.value.trim(),
        phone: phoneCheck.e164,
        phone_country_code: dialOf(phoneCountry.value),
        pix_key: pixKey.value,
        bio: bio.value,
        coverage_bairros: [...coverageBairros.value],
        cidade: proMunicipality.value.trim(),
        uf: proStateCode.value.trim().toUpperCase(),
        country_code: proCountryCode.value,
        state: proStateName.value.trim(),
        municipality: proMunicipality.value.trim(),
        avatar: avatarUrl,
      })
      emit('saved', updated)
      emit('close')
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
      fail(t('profile.errSave'))
    } finally {
      saving.value = false
    }
    return
  }

  const user = props.user
  if (!user) return
  saving.value = true
  try {
    const clientPhone = validateE164(phone.value)
    if (phone.value.trim() && !clientPhone.ok) {
      fail(t('common.errTelefoneInvalido'))
      return
    }
    const payload: Partial<UserProfile> = {
      name: trimmedName,
      address: address.value,
      bairro: bairro.value,
      cidade: userMunicipality.value.trim(),
      uf: userStateCode.value.trim().toUpperCase(),
      country_code: userCountryCode.value,
      state: userStateName.value.trim(),
      municipality: userMunicipality.value.trim(),
      phone: phone.value.trim() ? clientPhone.e164 : '',
      phone_country_code: dialOf(phoneCountry.value),
    }
    if (birthDate.value) payload.birth_date = birthDate.value
    const updated = await updateUserRecord(user.auth_id, payload)
    emit('saved', updated)
    emit('close')
  } catch (err) {
    console.error('Erro ao salvar dados da conta:', err)
    fail(t('profile.errSave'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" @click="!saving && emit('close')"></div>
    <div class="relative min-h-full flex items-center justify-center p-4">
      <div class="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div class="relative bg-slate-950 p-6 border-b border-slate-800">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <component :is="role === 'pro' ? Camera : User" class="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 class="font-black text-white text-lg leading-tight">{{ title }}</h2>
                <p class="text-[11px] text-slate-400">{{ t('profile.updateInfo') }}</p>
              </div>
            </div>
            <button
              type="button"
              :disabled="saving"
              class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-40"
              :title="t('common.close')"
              @click="emit('close')"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="p-6 space-y-4">
          <!-- PRESTADOR: FOTO -->
          <div v-if="role === 'pro'" class="flex items-center gap-3">
            <div class="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
              <img v-if="currentAvatar" :src="currentAvatar" :alt="t('profile.photoAlt')" class="w-full h-full object-cover" />
              <User v-else class="w-6 h-6 text-slate-500" />
            </div>
            <label class="cursor-pointer px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 transition-all flex items-center gap-1.5">
              <Camera class="w-3.5 h-3.5" />
              {{ t('profile.choosePhoto') }}
              <input type="file" accept="image/*" class="hidden" @change="handleAvatarUpload" />
            </label>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.name') }}</label>
            <input
              v-model="name"
              type="text"
              :placeholder="role === 'pro' ? t('profile.proName') : t('auth.seuNome')"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          <!-- PRESTADOR -->
          <template v-if="role === 'pro'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.categories', { label: categoriesLabel }) }}</label>
                <div class="max-h-40 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <label
                    v-for="cat in categories"
                    :key="cat"
                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedCategories.includes(cat)"
                      :disabled="!selectedCategories.includes(cat) && !canAddCategory(selectedCategories, maxCategories)"
                      class="accent-amber-500"
                      @change="toggleCategory(cat)"
                    />
                    {{ categoryText(cat) }}
                  </label>
                </div>
                <p v-if="maxCategories !== null && !canAddCategory(selectedCategories, maxCategories)" class="text-[10px] text-amber-300 mt-1.5">
                  {{ t('plans.featureLimitReached') }}
                  <button type="button" class="font-bold underline" @click="emit('close'); goToTab('perfil_pro')">{{ t('profile.viewPlans') }}</button>
                </p>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.emailSubscription') }}</label>
                <input
                  v-model="email"
                  type="email"
                  :placeholder="t('auth.emailPlaceholder')"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <PhoneInput
                  v-model:phone="phone"
                  v-model:phone-country="phoneCountry"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.pixKey') }}</label>
                <input
                  v-model="pixKey"
                  type="text"
                  :placeholder="t('profile.pixPlaceholder')"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>
            <div>
              <AddressFields
                :with-street="false"
                v-model:country-code="proCountryCode"
                v-model:state-code="proStateCode"
                v-model:state-name="proStateName"
                v-model:municipality="proMunicipality"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.bio') }}</label>
              <textarea
                v-model="bio"
                rows="3"
                :placeholder="t('profile.bioPlaceholder')"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all resize-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('profile.coverageNeighborhoods') }}</label>
              <div v-if="coverageBairros.length > 0" class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="(bairro, idx) in coverageBairros"
                  :key="bairro"
                  class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300"
                >
                  <MapPin class="w-3 h-3" />
                  {{ bairro }}
                  <button
                    type="button"
                    class="text-amber-400/70 hover:text-red-400 transition-all"
                    :title="`Remover ${bairro}`"
                    @click="removeBairro(idx)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newBairro"
                  type="text"
                  :placeholder="t('profile.neighborhoodPlaceholder')"
                  class="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                  @keydown.enter.prevent="addBairro"
                />
                <button
                  type="button"
                  class="px-4 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-all shrink-0"
                  @click="addBairro"
                >
                  {{ t('profile.add') }}
                </button>
              </div>
              <p class="text-[10px] text-slate-500 mt-1.5">{{ t('profile.coverageHint') }}</p>
            </div>
          </template>

          <!-- CLIENTE -->
          <template v-else>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">{{ t('auth.dataNascimento') }}</label>
              <input
                v-model="birthDate"
                type="date"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-all [color-scheme:dark]"
              />
            </div>
            <PhoneInput
              v-model:phone="phone"
              v-model:phone-country="phoneCountry"
            />

            <AddressFields
              v-model:country-code="userCountryCode"
              v-model:state-code="userStateCode"
              v-model:state-name="userStateName"
              v-model:municipality="userMunicipality"
              v-model:street="address"
              v-model:neighborhood="bairro"
            />
          </template>

          <div v-if="errorMessage" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p class="text-xs text-red-300">{{ errorMessage }}</p>
          </div>

          <div class="flex gap-2 pt-1">
            <button
              type="button"
              :disabled="saving"
              @click="handleSave"
              class="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
              {{ saving ? t('common.saving') : t('profile.saveChanges') }}
            </button>
            <button
              type="button"
              :disabled="saving"
              @click="emit('close')"
              class="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all disabled:opacity-60"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

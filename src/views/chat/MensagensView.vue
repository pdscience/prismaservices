<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChat } from '../../composables/useChat'
import { useI18n } from '../../composables/useI18n'
import { ArrowLeft, MessageCircle, Send } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const {
  conversations,
  activeConversation,
  activeMessages,
  myRole,
  loadConversations,
  sendMessage,
  openConversation,
  closeConversation,
} = useChat()

const draft = ref('')
const sending = ref(false)
const error = ref('')
const scrollEl = ref<HTMLElement | null>(null)

const queryRequestId = computed(() =>
  typeof route.query.request_id === 'string' ? route.query.request_id : null,
)

function isMine(senderRole: 'client' | 'pro'): boolean {
  return senderRole === myRole.value
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60)
  if (diffHours < 1) return t('chat.justNow')
  if (diffHours < 24) return t('chat.hoursAgo', { hours: Math.floor(diffHours) })
  if (diffHours < 48) return t('chat.yesterday')
  return date.toLocaleDateString()
}

function scrollToBottom(): void {
  void nextTick(() => {
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  })
}

async function openConversationFromQuery(): Promise<void> {
  if (!queryRequestId.value) return
  await openConversation(queryRequestId.value)
  scrollToBottom()
}

async function open(requestId: string): Promise<void> {
  await openConversation(requestId)
  scrollToBottom()
}

function goBack(): void {
  if (activeConversation.value) {
    closeConversation()
    return
  }
  router.back()
}

async function send(): Promise<void> {
  const content = draft.value.trim()
  if (!content || !activeConversation.value) return
  error.value = ''
  sending.value = true
  try {
    await sendMessage(activeConversation.value.requestId, content)
    draft.value = ''
    scrollToBottom()
  } catch {
    error.value = t('chat.sendError')
  } finally {
    sending.value = false
  }
}

watch(activeMessages, () => scrollToBottom())

watch(
  queryRequestId,
  async (id) => {
    if (id) await openConversationFromQuery()
  },
)

onMounted(async () => {
  await loadConversations()
  await openConversationFromQuery()
})
</script>

<template>
  <div class="space-y-4 animate-in fade-in duration-300">
    <!-- Top bar -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3">
      <button
        @click="goBack"
        class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft class="w-4 h-4" />
        {{ activeConversation ? t('chat.back') : t('nav.inicio') }}
      </button>
      <h2 class="ml-auto text-sm font-bold text-slate-100 truncate">
        {{ activeConversation ? t('chat.with', { name: activeConversation.partnerName }) : t('chat.title') }}
      </h2>
    </div>

    <!-- Conversation thread -->
    <div
      v-if="activeConversation"
      class="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[calc(100vh-14rem)] min-h-[22rem]"
    >
      <div ref="scrollEl" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          v-for="message in activeMessages"
          :key="message.id"
          :class="isMine(message.sender_role) ? 'flex justify-end' : 'flex justify-start'"
        >
          <div
            :class="[
              'max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
              isMine(message.sender_role)
                ? 'bg-amber-500 text-slate-950 rounded-br-sm'
                : 'bg-slate-800 text-slate-100 rounded-bl-sm',
            ]"
          >
            {{ message.content }}
          </div>
        </div>
        <p v-if="activeMessages.length === 0" class="text-center text-xs text-slate-500 py-8">
          {{ t('chat.empty') }}
        </p>
      </div>

      <form @submit.prevent="send" class="border-t border-slate-800 p-3 space-y-2">
        <div class="flex items-center gap-2">
          <input
            v-model="draft"
            type="text"
            maxlength="2000"
            :placeholder="t('chat.placeholder')"
            class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            :disabled="sending || !draft.trim()"
            class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send class="w-3.5 h-3.5" />
            {{ t('chat.send') }}
          </button>
        </div>
        <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
      </form>
    </div>

    <!-- Conversations list -->
    <div v-else class="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
      <button
        v-for="conversation in conversations"
        :key="conversation.requestId"
        @click="open(conversation.requestId)"
        class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <img
          v-if="conversation.partnerAvatar"
          :src="conversation.partnerAvatar"
          :alt="conversation.partnerName"
          class="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div
          v-else
          class="w-10 h-10 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0"
        >
          {{ initials(conversation.partnerName) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-100 truncate">
              {{ conversation.partnerName }}
            </span>
            <span class="text-[10px] text-slate-500 shrink-0">
              {{ formatDate(conversation.lastMessage?.created_at) }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400 truncate">
              {{ conversation.lastMessage?.content || t('chat.empty') }}
            </span>
            <span
              v-if="conversation.unreadCount > 0"
              class="bg-amber-400 text-slate-950 font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center shrink-0"
            >
              {{ conversation.unreadCount }}
            </span>
          </div>
        </div>
      </button>

      <!-- Empty state -->
      <div v-if="conversations.length === 0" class="py-12 text-center px-6">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-4">
          <MessageCircle class="w-6 h-6 text-slate-500" />
        </div>
        <h3 class="text-sm font-bold text-slate-200 mb-1">{{ t('chat.empty') }}</h3>
        <p class="text-xs text-slate-500 max-w-xs mx-auto">{{ t('chat.emptyDesc') }}</p>
      </div>
    </div>
  </div>
</template>

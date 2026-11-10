import { ref, computed, watch } from 'vue'
import { insforge } from '../lib/insforge'
import { useAuth } from './useAuth'
import { useRequests } from './useRequests'
import { useProfessionals } from './useProfessionals'
import { useI18n } from './useI18n'
import {
  getChatMessages,
  sendChatMessage,
  markChatRead,
  getChatReads,
  type ChatMessage,
} from '../api/insforgeService'

export interface Conversation {
  requestId: string
  lastMessage: ChatMessage | null
  unreadCount: number
  partnerName: string
  partnerAvatar: string | null
}

interface ChatRealtimeMessage {
  id: string
  request_id: string
  sender_role: 'client' | 'pro'
  content: string
  created_at: string
  meta?: { channel?: string; timestamp?: string }
}

export interface UseChatReturn {
  connected: Readonly<typeof connected>
  conversations: Readonly<typeof conversations>
  activeRequestId: Readonly<typeof activeRequestId>
  activeConversation: Readonly<typeof activeConversation>
  activeMessages: Readonly<typeof activeMessages>
  unreadTotal: Readonly<typeof unreadTotal>
  myRole: Readonly<typeof myRole>
  loadConversations: () => Promise<void>
  sendMessage: (requestId: string, content: string) => Promise<ChatMessage>
  markRead: (requestId: string) => Promise<void>
  openConversation: (requestId: string) => Promise<void>
  closeConversation: () => void
}

const connected = ref(false)
const conversations = ref<Conversation[]>([])
const activeRequestId = ref<string | null>(null)
const activeConversation = ref<Conversation | null>(null)
const activeMessages = ref<ChatMessage[]>([])
const lastReadAt = ref<Record<string, string>>({})

const myRole = computed<'client' | 'pro'>(() => {
  const { userMode, proProfile } = useAuth()
  return userMode.value === 'pro' && proProfile.value?.id ? 'pro' : 'client'
})

const unreadTotal = computed(() =>
  conversations.value.reduce((sum, c) => sum + c.unreadCount, 0),
)

function readerId(): string | undefined {
  const { userMode, proProfile, authUser } = useAuth()
  return userMode.value === 'pro' ? proProfile.value?.id : authUser.value?.id
}

function myRequestIds(): string[] {
  const { requests, myRequests } = useRequests()
  if (myRole.value === 'client') {
    return myRequests.value.filter((r) => !!r.professional_id).map((r) => r.id)
  }
  const { proProfile } = useAuth()
  return requests.value
    .filter((r) => !!proProfile.value?.id && r.professional_id === proProfile.value.id)
    .map((r) => r.id)
}

async function loadConversations(): Promise<void> {
  const { requests, loadData } = useRequests()
  if (requests.value.length === 0) {
    await loadData()
  }

  const requestIds = myRequestIds()
  if (requestIds.length === 0) {
    conversations.value = []
    return
  }

  const { findProfessional } = useProfessionals()
  const { t } = useI18n()

  const [messagesList, reads] = await Promise.all([
    Promise.all(requestIds.map((id) => getChatMessages(id))),
    readerId() ? getChatReads(readerId() as string) : Promise.resolve({} as Record<string, string>),
  ])
  lastReadAt.value = reads

  const role = myRole.value
  const otherRole = role === 'client' ? 'pro' : 'client'

  conversations.value = requestIds.map((requestId, index) => {
    const msgs = messagesList[index] || []
    const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null
    const readAt = reads[requestId] || ''
    const unreadCount = msgs.filter(
      (m) => m.sender_role === otherRole && m.created_at > readAt,
    ).length

    const request = requests.value.find((r) => r.id === requestId)
    let partnerName = ''
    let partnerAvatar: string | null = null
    if (role === 'client') {
      const professional = findProfessional(request?.professional_id ?? null)
      partnerName = professional?.name || t('common.naoAtribuido')
      partnerAvatar = professional?.avatar || null
    } else {
      partnerName = request?.client_name || t('common.cliente')
    }

    return { requestId, lastMessage, unreadCount, partnerName, partnerAvatar }
  })
}

export function handleChatRealtimeMessage(payload: ChatRealtimeMessage): void {
  if (!payload?.request_id || !payload?.id) return
  const requestId = payload.request_id
  const index = conversations.value.findIndex((c) => c.requestId === requestId)
  if (index === -1) return

  const message: ChatMessage = {
    id: payload.id,
    request_id: requestId,
    sender_role: payload.sender_role,
    content: payload.content,
    created_at: payload.created_at,
  }

  if (activeRequestId.value === requestId) {
    const alreadyThere = activeMessages.value.some((m) => m.id === message.id)
    if (!alreadyThere) activeMessages.value = [...activeMessages.value, message]
  }

  if (message.sender_role === myRole.value) return

  conversations.value = conversations.value.map((c, i) =>
    i === index
      ? { ...c, lastMessage: message, unreadCount: c.unreadCount + 1 }
      : c,
  )
}

async function subscribeChannels(): Promise<void> {
  insforge.realtime.off('new_message', handleChatRealtimeMessage)

  for (const id of myRequestIds()) {
    await insforge.realtime.subscribe(`chat:${id}`)
  }

  insforge.realtime.on('new_message', handleChatRealtimeMessage)
}

async function markRead(requestId: string): Promise<void> {
  const id = readerId()
  if (!id) return
  const readAt = await markChatRead(requestId, id)
  lastReadAt.value = { ...lastReadAt.value, [requestId]: readAt }
  conversations.value = conversations.value.map((c) =>
    c.requestId === requestId ? { ...c, unreadCount: 0 } : c,
  )
}

async function sendMessage(requestId: string, content: string): Promise<ChatMessage> {
  const senderRole = myRole.value
  const message = await sendChatMessage(requestId, senderRole, content)

  if (activeRequestId.value === requestId) {
    activeMessages.value = [...activeMessages.value, message]
  }
  conversations.value = conversations.value.map((c) =>
    c.requestId === requestId ? { ...c, lastMessage: message } : c,
  )
  return message
}

async function openConversation(requestId: string): Promise<void> {
  activeRequestId.value = requestId
  activeConversation.value =
    conversations.value.find((c) => c.requestId === requestId) || null
  activeMessages.value = await getChatMessages(requestId)
  await markRead(requestId)
}

function closeConversation(): void {
  activeRequestId.value = null
  activeConversation.value = null
  activeMessages.value = []
}

let initialized = false
function initialize(): void {
  if (initialized) return
  initialized = true
  const { authUser } = useAuth()
  watch(
    authUser,
    async (user) => {
      if (user) {
        await loadConversations()
        await subscribeChannels()
        connected.value = true
      } else {
        connected.value = false
        conversations.value = []
        closeConversation()
      }
    },
    { immediate: true },
  )
}

export function useChat(): UseChatReturn {
  initialize()
  return {
    connected,
    conversations,
    activeRequestId,
    activeConversation,
    activeMessages,
    unreadTotal,
    myRole,
    loadConversations,
    sendMessage,
    markRead,
    openConversation,
    closeConversation,
  }
}

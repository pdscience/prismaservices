import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChat, handleChatRealtimeMessage } from './useChat'
import {
  getChatMessages,
  sendChatMessage,
  markChatRead,
  getChatReads,
  type ChatMessage,
} from '../api/insforgeService'

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  request_id: 'req-1',
  sender_role: 'client',
  content: 'Olá',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

vi.mock('../lib/insforge', () => ({
  insforge: {
    realtime: {
      on: vi.fn(),
      off: vi.fn(),
      subscribe: vi.fn(async () => ({ ok: true })),
    },
  },
}))

vi.mock('../api/insforgeService', () => ({
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  markChatRead: vi.fn(),
  getChatReads: vi.fn(),
}))

vi.mock('./useAuth', async () => {
  const { ref } = await import('vue')
  const authUser = ref<{ id: string } | null>({ id: 'user-1' })
  const userMode = ref<'client' | 'pro'>('client')
  const proProfile = ref<{ id: string | null }>({ id: null })
  return { useAuth: () => ({ authUser, userMode, proProfile }) }
})

vi.mock('./useRequests', async () => {
  const { ref, computed } = await import('vue')
  const requests = ref([
    { id: 'req-1', client_id: 'user-1', client_name: 'Ana', professional_id: 'pro-1' },
  ])
  const myRequests = computed(() => requests.value.filter((r) => r.client_id === 'user-1'))
  const loadData = vi.fn(async () => {})
  return { useRequests: () => ({ requests, myRequests, proRequests: myRequests, loadData }) }
})

vi.mock('./useProfessionals', () => ({
  useProfessionals: () => ({
    findProfessional: (id: string | null) =>
      id === 'pro-1' ? { id: 'pro-1', name: 'Carlos', avatar: 'carlos.png' } : undefined,
  }),
}))

vi.mock('./useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getChatMessages).mockResolvedValue([makeMessage()])
    vi.mocked(sendChatMessage).mockResolvedValue(makeMessage())
    vi.mocked(markChatRead).mockResolvedValue('2026-01-02T00:00:00.000Z')
    vi.mocked(getChatReads).mockResolvedValue({})
  })

  it('carrega conversas com última mensagem, parceiro e não lidas', async () => {
    vi.mocked(getChatMessages).mockResolvedValue([
      makeMessage({ id: 'm0', sender_role: 'pro', content: 'Oi', created_at: '2026-01-01T00:00:00.000Z' }),
    ])
    const { conversations, loadConversations } = useChat()
    await loadConversations()

    expect(conversations.value).toHaveLength(1)
    expect(conversations.value[0].lastMessage?.content).toBe('Oi')
    expect(conversations.value[0].partnerName).toBe('Carlos')
    expect(conversations.value[0].unreadCount).toBe(1)
  })

  it('não conta como não lida mensagem enviada por mim', async () => {
    vi.mocked(getChatMessages).mockResolvedValue([makeMessage({ sender_role: 'client' })])
    const { conversations, loadConversations } = useChat()
    await loadConversations()

    expect(conversations.value[0].unreadCount).toBe(0)
  })

  it('abre conversa, carrega histórico e marca como lida', async () => {
    const { openConversation, activeRequestId, activeMessages, conversations, loadConversations } =
      useChat()
    await loadConversations()
    await openConversation('req-1')

    expect(activeRequestId.value).toBe('req-1')
    expect(activeMessages.value).toHaveLength(1)
    expect(markChatRead).toHaveBeenCalledWith('req-1', 'user-1')
    expect(conversations.value[0].unreadCount).toBe(0)
  })

  it('envia mensagem com o papel do usuário e anexa ao histórico ativo', async () => {
    vi.mocked(getChatMessages).mockResolvedValue([])
    vi.mocked(sendChatMessage).mockResolvedValue(makeMessage({ id: 'm2', content: 'Novo' }))
    const { loadConversations, openConversation, sendMessage, activeMessages } = useChat()
    await loadConversations()
    await openConversation('req-1')

    const result = await sendMessage('req-1', 'Novo')

    expect(sendChatMessage).toHaveBeenCalledWith('req-1', 'client', 'Novo')
    expect(result.content).toBe('Novo')
    expect(activeMessages.value.some((m) => m.id === 'm2')).toBe(true)
  })

  it('aplica evento realtime no formato publicado pelo banco', async () => {
    vi.mocked(getChatMessages).mockResolvedValue([])
    const { conversations, loadConversations } = useChat()
    await loadConversations()

    handleChatRealtimeMessage({
      id: 'm9',
      request_id: 'req-1',
      sender_role: 'pro',
      content: 'Nova mensagem',
      created_at: '2026-01-03T00:00:00.000Z',
    })

    expect(conversations.value[0].lastMessage?.content).toBe('Nova mensagem')
    expect(conversations.value[0].unreadCount).toBe(1)
  })
})

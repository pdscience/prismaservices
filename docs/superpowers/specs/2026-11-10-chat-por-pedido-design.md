# Chat por pedido (cliente ↔ profissional dentro da plataforma)

Data: 2026-11-10

## Intenção

Permitir que cliente e profissional negociem o serviço **dentro do app**, amarrado a
um pedido. Hoje toda negociação sai da plataforma (WhatsApp no Brasil, SMS nos EUA);
com o chat, a conversa fica no produto, com histórico e badge de não lidas.

## Decisões (aprovadas em conversa)

- **Chat amarrado ao pedido**: um canal por `service_request`. Só existe quando há
  profissional vinculado — pedido direto desde a criação; broadcast quando um pro
  assume (`professional_id` preenchido).
- **Aba própria "Mensagens"** para cliente e pro (estilo inbox do WhatsApp): lista
  de conversas + conversa aberta + contador de não lidas.
- **Fonte da verdade é o banco** (`public.chat_messages`); realtime apenas entrega
  o evento `new_message` (publicado por trigger no INSERT). O frontend **nunca**
  publica direto no canal — todo envio passa pelo INSERT validado por RLS.
- **Sem envio direto de WhatsApp/SMS nos cards de pedido**: os botões de contato
  direto viram "Conversar". WhatsApp/SMS permanecem como canal de aviso offline
  (fase 2).
- País/idioma: chat é igual em todos os mercados (conteúdo do usuário, não cópia
  de interface). Sem PIX/WhatsApp envolvidos.

## Abordagens consideradas

1. **Mensagens persistentes + trigger realtime** (escolhida) — INSERT no banco
   publica no canal `chat:<request_id>`; quem entra depois vê o histórico; RLS
   valida participante e papel do remetente. Custo: trigger + migration realtime.
2. **Só realtime em memória** (descartada) — sem histórico ao reabrir; perde
   negociação em troca de "menos schema".
3. **Chat de terceiros embutido** (descartada) — dependência externa, custo,
   dados fora do InsForge já pago.

## Escopo desta fase

- Migration: `chat_messages`, `chat_reads`, RLS, helper `chat_participant`
  (SECURITY DEFINER), canal `chat:%`, trigger de publicação, RLS em
  `realtime.channels` (participantes do pedido).
- API: getChatMessages / sendChatMessage / markChatRead / getChatReads.
- `useChat`: inscrição nos canais das minhas conversas, dedupe por id, não lidas
  por `last_read_at`, abrir conversa a partir dos cards de pedido.
- View `MensagensView` única para os dois papéis; rotas `/cliente/mensagens` e
  `/pro/mensagens`; botões nas sub-abas com badge.
- Botão "Conversar" substitui WhatsApp/SMS em MeusPedidos, Historico (cliente),
  PedidosPro e no sucesso pós-pedido do Solicitar.

## Fora de escopo (fase 2)

- Aviso offline de nova mensagem via WhatsApp (BR) / SMS (EUA) — reusar padrão
  das functions `notify-pros*` com `country_code`.
- Push notifications PWA, presença "online", anexos de foto no chat,
  leitura no banco por mensagem (tick duplo).

## Chamadas do construtor (minhas)

- Sem upsert no SDK: `markChatRead` faz UPDATE e, sem linha, INSERT.
- `realtime.messages` fica SEM RLS (publicação só via trigger SECURITY DEFINER);
  `realtime.channels` fica COM RLS — só participantes se inscrevem.
- Badge de não lidas conta mensagens do outro papel após `last_read_at`.
- Conversas ordenadas por última mensagem; prévia truncada estilo inbox.

-- ============================================================
-- Chat por pedido: mensagens persistentes, leitura e realtime
-- Conversa entre cliente e profissional vinculado ao pedido.
-- ============================================================

-- ============ MENSAGENS ============
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'pro')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON public.chat_messages(request_id, created_at);

-- ============ ÚLTIMA LEITURA (não lidas por conversa) ============
CREATE TABLE IF NOT EXISTS public.chat_reads (
  request_id TEXT NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  reader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, reader_id)
);

-- ============ HELPER: participante do chat do pedido ============
-- SECURITY DEFINER evita recursão com as policies de service_requests.
-- 'client' = usuário autenticado é o cliente do pedido;
-- 'pro' = usuário autenticado é o auth_id do profissional vinculado.
CREATE OR REPLACE FUNCTION public.chat_participant(req_id TEXT, role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.id = req_id
      AND (
        (role = 'client' AND r.client_id = auth.uid())
        OR (
          role = 'pro'
          AND EXISTS (
            SELECT 1 FROM public.professionals p
            WHERE p.id = r.professional_id
              AND p.auth_id = auth.uid()::text
          )
        )
      )
  )
$$;

-- ============ RLS: chat_messages ============
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    public.chat_participant(request_id, 'client')
    OR public.chat_participant(request_id, 'pro')
  );

-- O papel do remetente precisa bater com quem insere (sem falsificação).
DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'client' AND public.chat_participant(request_id, 'client'))
    OR (sender_role = 'pro' AND public.chat_participant(request_id, 'pro'))
  );

-- ============ RLS: chat_reads (linhas do próprio leitor) ============
ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_reads_select ON public.chat_reads;
CREATE POLICY chat_reads_select ON public.chat_reads
  FOR SELECT TO authenticated
  USING (reader_id = auth.uid());

DROP POLICY IF EXISTS chat_reads_insert ON public.chat_reads;
CREATE POLICY chat_reads_insert ON public.chat_reads
  FOR INSERT TO authenticated
  WITH CHECK (reader_id = auth.uid());

DROP POLICY IF EXISTS chat_reads_update ON public.chat_reads;
CREATE POLICY chat_reads_update ON public.chat_reads
  FOR UPDATE TO authenticated
  USING (reader_id = auth.uid())
  WITH CHECK (reader_id = auth.uid());

-- ============ REALTIME: canal por pedido ============
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('chat:%', 'Chat por pedido (cliente e profissional vinculados)', true)
ON CONFLICT (pattern) DO UPDATE
  SET description = EXCLUDED.description,
      enabled = EXCLUDED.enabled;

-- Publicação automática no INSERT de mensagem (fonte da verdade = banco).
CREATE OR REPLACE FUNCTION public.chat_message_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.publish(
    'chat:' || NEW.request_id,
    'new_message',
    jsonb_build_object(
      'id', NEW.id,
      'request_id', NEW.request_id,
      'sender_role', NEW.sender_role,
      'content', NEW.content,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_publish ON public.chat_messages;
CREATE TRIGGER chat_messages_publish
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_message_published();

-- Inscrição no canal só para participantes do pedido.
-- (realtime.messages fica SEM RLS: publicação só acontece via trigger
-- SECURITY DEFINER; o frontend nunca publica direto.)
ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_participants_subscribe ON realtime.channels;
CREATE POLICY chat_participants_subscribe ON realtime.channels
  FOR SELECT TO authenticated
  USING (
    realtime.channel_name() LIKE 'chat:%'
    AND (
      public.chat_participant(NULLIF(split_part(realtime.channel_name(), ':', 2), ''), 'client')
      OR public.chat_participant(NULLIF(split_part(realtime.channel_name(), ':', 2), ''), 'pro')
    )
  );

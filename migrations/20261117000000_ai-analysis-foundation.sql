-- Fase 1 da fundação de IA: dono, idioma, observabilidade, vínculo com o pedido
-- e leitura restrita ao dono (o worker continua lendo processing/working).
--
-- Segurança pragmática: as functions operam com ANON_KEY (não há service role
-- na plataforma), então o worker precisa continuar lendo/gravando as linhas
-- em processamento. O risco residual é o mesmo já documentado em
-- notification_log: durante a janela de processamento a imagem ainda pode ser
-- lida por outro papel de runtime. Ao concluir, image_base64 é apagada.

ALTER TABLE public.service_analyses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS category_options JSONB,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'nvidia',
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS fallback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC;

CREATE INDEX IF NOT EXISTS idx_service_analyses_user_created
  ON public.service_analyses(user_id, created_at DESC);

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS analysis_id TEXT REFERENCES public.service_analyses(id) ON DELETE SET NULL;

-- SELECT: dono lê o próprio resultado; worker (anon) lê apenas a fila.
DROP POLICY IF EXISTS service_analyses_select ON public.service_analyses;
CREATE POLICY service_analyses_select ON public.service_analyses
  FOR SELECT TO anon, authenticated
  USING (
    status IN ('processing', 'working')
    OR user_id = auth.uid()
  );

-- INSERT: somente o usuário autenticado grava a própria análise.
DROP POLICY IF EXISTS service_analyses_insert ON public.service_analyses;
CREATE POLICY service_analyses_insert ON public.service_analyses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: o worker precisa avançar a fila; o dono pode atualizar a própria
-- linha. Sem service role, não é possível distinguir os dois papéis — risco
-- residual aceito nesta fase e documentado no topo deste arquivo.
DROP POLICY IF EXISTS service_analyses_update ON public.service_analyses;
CREATE POLICY service_analyses_update ON public.service_analyses
  FOR UPDATE TO anon, authenticated
  USING (
    status IN ('processing', 'working')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    status IN ('processing', 'working', 'ready', 'error')
    OR user_id = auth.uid()
  );

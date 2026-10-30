-- Ambiente Stripe da assinatura atual do profissional.
-- Assinaturas existentes foram criadas em test; novos checkouts gravam o
-- ambiente efetivamente usado.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS billing_environment TEXT NOT NULL DEFAULT 'test'
  CHECK (billing_environment IN ('test', 'live'));

UPDATE public.professionals
SET billing_environment = 'test'
WHERE billing_environment IS NULL;

CREATE INDEX IF NOT EXISTS idx_professionals_billing_environment
  ON public.professionals(billing_environment);

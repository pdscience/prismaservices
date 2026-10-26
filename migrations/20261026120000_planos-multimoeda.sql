-- Planos multi-moeda: BRL para pt-BR, USD para en/es.
-- stripe_price_id_usd fica nulo até o Price de US$ 99,90 ser criado no Stripe.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS monthly_price_usd INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_price_id_usd TEXT;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NOT NULL DEFAULT 'BRL';

UPDATE public.plans SET monthly_price = 4990, monthly_price_usd = 9990 WHERE id = 'ouro';
UPDATE public.plans SET monthly_price = 0,    monthly_price_usd = 0    WHERE id = 'gratuito';

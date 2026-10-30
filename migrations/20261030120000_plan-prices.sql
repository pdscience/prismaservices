-- Catalogo de Price IDs por plano, ambiente Stripe e moeda.
-- Price IDs nao sao segredos; a leitura publica permite o checkout no frontend.

CREATE TABLE IF NOT EXISTS public.plan_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  currency TEXT NOT NULL CHECK (currency IN ('BRL', 'USD')),
  stripe_price_id TEXT NOT NULL,
  unit_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, environment, currency)
);

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_prices_select ON public.plan_prices;
CREATE POLICY plan_prices_select ON public.plan_prices
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.plan_prices TO anon, authenticated;

INSERT INTO public.plan_prices (plan_id, environment, currency, stripe_price_id, unit_amount)
VALUES ('ouro', 'test', 'BRL', 'price_1U0CldKUfRcMtQSBbx4QJEO0', 4990)
ON CONFLICT (plan_id, environment, currency) DO UPDATE
SET stripe_price_id = EXCLUDED.stripe_price_id,
    unit_amount = EXCLUDED.unit_amount;

-- Corrige a regra de checkout sem assinatura: a excecao de primeiro checkout
-- so vale para profissionais ainda no ambiente padrao 'test'. Assim um evento
-- de teste nao consegue alterar um profissional que ja esta em live.

CREATE OR REPLACE FUNCTION public.billing_event_applies(
  p_billing_environment TEXT,
  p_event_environment TEXT,
  p_subscription_id TEXT,
  p_event_subscription_id TEXT,
  p_event_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_billing_environment = p_event_environment
    OR (p_subscription_id IS NOT NULL AND p_subscription_id = p_event_subscription_id)
    OR (p_billing_environment = 'test' AND p_subscription_id IS NULL AND p_event_type LIKE 'checkout.session.%');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

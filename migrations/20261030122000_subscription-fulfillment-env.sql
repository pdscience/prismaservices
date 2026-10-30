-- Fulfillment de assinatura isolado por ambiente Stripe.
-- O plano e a moeda sao resolvidos em public.plan_prices usando o ambiente do
-- evento; eventos de um ambiente nao alteram assinaturas do outro.

-- Regra pura de isolamento: o evento so pode alterar a assinatura quando e do
-- mesmo ambiente, quando o subscription_id bate, ou quando ainda nao ha
-- assinatura e o evento e de checkout.
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

CREATE OR REPLACE FUNCTION public.fulfill_professional_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_type TEXT;
  v_subject_id TEXT;
  v_plan TEXT;
  v_price_id TEXT;
  v_customer TEXT;
  v_subscription TEXT;
  v_currency TEXT;
  v_status TEXT;
BEGIN
  IF NEW.provider <> 'stripe' OR NEW.processing_status <> 'processed' THEN
    RETURN NEW;
  END IF;

  v_customer := NEW.payload -> 'data' -> 'object' ->> 'customer';
  v_subscription := COALESCE(
    NEW.payload -> 'data' -> 'object' ->> 'subscription',
    NEW.payload -> 'data' -> 'object' -> 'parent' -> 'subscription_details' ->> 'subscription',
    CASE
      WHEN NEW.event_type LIKE 'customer.subscription.%'
        THEN NEW.payload -> 'data' -> 'object' ->> 'id'
    END
  );

  -- Checkout: eventos sincronos e assincronos (Pix/cartao com confirmacao tardia).
  IF NEW.event_type IN (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed'
  ) THEN
    v_subject_type := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_type';
    v_subject_id := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_id';

    IF v_subject_id IS NULL THEN
      SELECT m.subject_type, m.subject_id
      INTO v_subject_type, v_subject_id
      FROM payments.customer_mappings m
      WHERE m.provider = NEW.provider
        AND m.provider_customer_id = v_customer
      LIMIT 1;
    END IF;

    IF v_subject_id IS NULL THEN
      RAISE WARNING 'Stripe % % has no resolvable billing subject', NEW.event_type, NEW.id;
      RETURN NEW;
    END IF;

    IF v_subject_type <> 'professional' THEN
      RETURN NEW;
    END IF;

    v_currency := UPPER(NEW.payload -> 'data' -> 'object' ->> 'currency');
    v_status := CASE
      WHEN NEW.event_type = 'checkout.session.async_payment_failed' THEN 'past_due'
      ELSE 'active'
    END;

    UPDATE public.professionals
    SET plan = COALESCE(NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'plan', plan),
        plan_status = v_status,
        billing_currency = COALESCE(v_currency, billing_currency),
        billing_environment = NEW.environment,
        stripe_customer_id = COALESCE(v_customer, stripe_customer_id),
        stripe_subscription_id = COALESCE(v_subscription, stripe_subscription_id),
        updated_at = NOW()
    WHERE id::text = v_subject_id
      AND public.billing_event_applies(
        billing_environment,
        NEW.environment,
        stripe_subscription_id,
        v_subscription,
        NEW.event_type
      );

    RETURN NEW;
  END IF;

  IF NEW.event_type IN (
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed'
  ) THEN
    v_subject_type := COALESCE(
      NEW.payload -> 'data' -> 'object' -> 'parent' -> 'subscription_details' -> 'metadata' ->> 'insforge_subject_type',
      NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_type'
    );
    v_subject_id := COALESCE(
      NEW.payload -> 'data' -> 'object' -> 'parent' -> 'subscription_details' -> 'metadata' ->> 'insforge_subject_id',
      NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_id'
    );

    IF v_subject_id IS NULL THEN
      SELECT m.subject_type, m.subject_id
      INTO v_subject_type, v_subject_id
      FROM payments.customer_mappings m
      WHERE m.provider = NEW.provider
        AND m.provider_customer_id = v_customer
      LIMIT 1;
    END IF;

    IF v_subject_id IS NULL OR v_subject_type <> 'professional' THEN
      RETURN NEW;
    END IF;

    v_price_id := COALESCE(
      NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 -> 'price' ->> 'id',
      NEW.payload -> 'data' -> 'object' -> 'lines' -> 'data' -> 0 -> 'price' ->> 'id'
    );

    IF v_price_id IS NOT NULL THEN
      SELECT pp.plan_id
      INTO v_plan
      FROM public.plan_prices pp
      WHERE pp.stripe_price_id = v_price_id
        AND pp.environment = NEW.environment
      LIMIT 1;
    END IF;

    IF NEW.event_type = 'customer.subscription.created' THEN
      v_currency := UPPER(NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 -> 'price' ->> 'currency');

      UPDATE public.professionals
      SET plan_status = CASE
            WHEN NEW.payload -> 'data' -> 'object' ->> 'status' = 'active' THEN 'active'
            WHEN NEW.payload -> 'data' -> 'object' ->> 'status' = 'past_due' THEN 'past_due'
            ELSE 'canceled'
          END,
          plan = COALESCE(v_plan, plan),
          billing_currency = COALESCE(v_currency, billing_currency),
          billing_environment = NEW.environment,
          stripe_subscription_id = COALESCE(v_subscription, stripe_subscription_id),
          stripe_customer_id = COALESCE(v_customer, stripe_customer_id),
          plan_expires_at = to_timestamp(
            (NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 ->> 'current_period_end')::bigint
          ),
          updated_at = NOW()
      WHERE id::text = v_subject_id
        AND public.billing_event_applies(
          billing_environment,
          NEW.environment,
          stripe_subscription_id,
          v_subscription,
          NEW.event_type
        );
    END IF;

    IF NEW.event_type = 'customer.subscription.updated' THEN
      v_currency := UPPER(NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 -> 'price' ->> 'currency');

      UPDATE public.professionals
      SET plan_status = CASE
            WHEN NEW.payload -> 'data' -> 'object' ->> 'status' = 'active' THEN 'active'
            WHEN NEW.payload -> 'data' -> 'object' ->> 'status' = 'past_due' THEN 'past_due'
            ELSE 'canceled'
          END,
          plan = COALESCE(v_plan, plan),
          billing_currency = COALESCE(v_currency, billing_currency),
          billing_environment = NEW.environment,
          plan_expires_at = to_timestamp(
            (NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 ->> 'current_period_end')::bigint
          ),
          updated_at = NOW()
      WHERE id::text = v_subject_id
        AND public.billing_event_applies(
          billing_environment,
          NEW.environment,
          stripe_subscription_id,
          v_subscription,
          NEW.event_type
        );
    END IF;

    IF NEW.event_type = 'customer.subscription.deleted' THEN
      UPDATE public.professionals
      SET plan_status = 'canceled',
          plan = 'gratuito',
          billing_environment = NEW.environment,
          updated_at = NOW()
      WHERE id::text = v_subject_id
        AND public.billing_event_applies(
          billing_environment,
          NEW.environment,
          stripe_subscription_id,
          v_subscription,
          NEW.event_type
        );
    END IF;

    IF NEW.event_type = 'invoice.paid' THEN
      UPDATE public.professionals
      SET plan_status = 'active',
          billing_currency = COALESCE(UPPER(NEW.payload -> 'data' -> 'object' ->> 'currency'), billing_currency),
          billing_environment = NEW.environment,
          plan_expires_at = to_timestamp(
            COALESCE(
              (NEW.payload -> 'data' -> 'object' ->> 'period_end')::bigint,
              (NEW.payload -> 'data' -> 'object' -> 'lines' -> 'data' -> 0 -> 'period' ->> 'end')::bigint
            )
          ),
          updated_at = NOW()
      WHERE id::text = v_subject_id
        AND public.billing_event_applies(
          billing_environment,
          NEW.environment,
          stripe_subscription_id,
          v_subscription,
          NEW.event_type
        );
    END IF;

    IF NEW.event_type = 'invoice.payment_failed' THEN
      UPDATE public.professionals
      SET plan_status = 'past_due',
          billing_environment = NEW.environment,
          updated_at = NOW()
      WHERE id::text = v_subject_id
        AND public.billing_event_applies(
          billing_environment,
          NEW.environment,
          stripe_subscription_id,
          v_subscription,
          NEW.event_type
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

# Assinaturas multi-moeda e ambientes Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar R$ 49,90/mês de profissionais no Brasil e US$ 99,90/mês dos demais, com assinatura recorrente no cartão e isolamento entre Stripe test e live.

**Architecture:** A moeda é derivada do `country_code` do profissional (ou da assinatura existente). Os Price IDs ficam em `public.plan_prices`, indexados por plano, ambiente e moeda. Checkout, portal, webhook e `change-plan` passam a receber/respeitar o ambiente. O webhook só altera assinaturas do mesmo ambiente.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, InsForge SDK, PostgreSQL/PL/pgSQL, Stripe Checkout/Billing Portal.

**Spec:** `docs/superpowers/specs/2026-10-30-assinaturas-multimoeda-design.md`

## Global Constraints

- Brasil: `country_code = 'BR'` → BRL, R$ 49,90/mês (4990 centavos).
- Exterior: qualquer outro `country_code` → USD, US$ 99,90/mês (9990 centavos).
- Assinatura existente sempre prevalece sobre o país.
- Ambientes permitidos: `test` e `live`; padrão `test`.
- Moedas permitidas: `BRL` e `USD`.
- Pix não faz parte da assinatura recorrente.
- Não sobrescrever `billing_currency` ao editar perfil.
- Não expor secrets no frontend.

## Review Focus

- Profissional brasileiro com assinatura USD existente deve continuar em USD.
- Profissional estrangeiro sem assinatura deve ver e pagar em USD.
- Evento Stripe de teste não pode alterar assinatura live.
- Checkout sem Price configurado deve falhar com mensagem clara, sem criar sessão.
- Editar perfil não pode trocar a moeda de uma assinatura ativa.

---

### Task 1: Migração do catálogo e do ambiente

**Files:**
- Create: `migrations/20261030120000_plan-prices.sql`
- Create: `migrations/20261030121000_billing-environment.sql`

**Interfaces:**
- Produces: tabela `public.plan_prices(plan_id, environment, currency, stripe_price_id, unit_amount)`.
- Produces: coluna `public.professionals.billing_environment`.

- [ ] **Step 1: Criar a tabela `plan_prices` com RLS de leitura pública**

```sql
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
CREATE POLICY plan_prices_select ON public.plan_prices
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.plan_prices TO anon, authenticated;
```

- [ ] **Step 2: Semear o Price de teste já existente**

```sql
INSERT INTO public.plan_prices (plan_id, environment, currency, stripe_price_id, unit_amount)
VALUES ('ouro', 'test', 'BRL', 'price_1U0CldKUfRcMtQSBbx4QJEO0', 4990)
ON CONFLICT (plan_id, environment, currency) DO UPDATE
SET stripe_price_id = EXCLUDED.stripe_price_id,
    unit_amount = EXCLUDED.unit_amount;
```

- [ ] **Step 3: Adicionar `billing_environment` e fazer backfill**

```sql
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS billing_environment TEXT NOT NULL DEFAULT 'test'
  CHECK (billing_environment IN ('test', 'live'));

UPDATE public.professionals
SET billing_environment = 'test'
WHERE billing_environment IS NULL;
```

- [ ] **Step 4: Aplicar as migrações no InsForge**

Run: `npx @insforge/cli db migrations up --project CasaOR` (ou o comando equivalente já usado no projeto).
Expected: migrações aplicadas sem erro.

- [ ] **Step 5: Verificar**

Run: `npx @insforge/cli db query --project CasaOR "select plan_id, environment, currency, unit_amount from public.plan_prices order by plan_id, environment, currency;"`
Expected: linha `ouro|test|BRL|4990`.

- [ ] **Step 6: Commit**

```bash
git add migrations/20261030120000_plan-prices.sql migrations/20261030121000_billing-environment.sql
git commit -m "feat: adiciona catalogo de precos por ambiente e moeda"
```

---

### Task 2: Webhook isolado por ambiente

**Files:**
- Create: `migrations/20261030122000_subscription-fulfillment-env.sql`
- Reference: `migrations/20261026121000_subscription-fulfillment-multimoeda.sql`

**Interfaces:**
- Consumes: `public.plan_prices`, `public.professionals.billing_environment`.
- Produces: `public.fulfill_professional_subscription()` que grava `billing_currency` e `billing_environment` e ignora eventos de outro ambiente.

- [ ] **Step 1: Substituir a função de fulfillment**

A nova função deve:

- Sair cedo se `NEW.provider <> 'stripe'` ou `NEW.processing_status <> 'processed'`.
- Resolver o profissional como a função atual.
- Em `checkout.session.completed`, `checkout.session.async_payment_succeeded` e `checkout.session.async_payment_failed`, gravar:
  - `plan` a partir do metadata.
  - `plan_status` (`active` em sucesso, `past_due` em falha).
  - `billing_currency = UPPER(object.currency)`.
  - `billing_environment = NEW.environment`.
- Em eventos de subscription/invoice, resolver o plano via:

```sql
SELECT pp.plan_id
FROM public.plan_prices pp
WHERE pp.stripe_price_id = v_price_id
  AND pp.environment = NEW.environment
LIMIT 1;
```

- Filtrar todo `UPDATE` com:

```sql
AND (
  billing_environment = NEW.environment
  OR stripe_subscription_id IS NULL
  OR stripe_subscription_id = v_subscription
)
```

- Tratar `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid` e `invoice.payment_failed` como hoje.
- Manter `SECURITY DEFINER`.

- [ ] **Step 2: Aplicar a migração**

Run: `npx @insforge/cli db migrations up --project CasaOR`
Expected: função substituída sem erro.

- [ ] **Step 3: Testar isolamento com SQL**

Inserir dois profissionais fictícios: um `billing_environment='test'` e outro `'live'`. Inserir um evento `customer.subscription.updated` de teste para o profissional live e confirmar que o `plan_status` não mudou. Repetir com evento live para o profissional test. Limpar os dados fictícios.

- [ ] **Step 4: Commit**

```bash
git add migrations/20261030122000_subscription-fulfillment-env.sql
git commit -m "feat: isola fulfillment de assinatura por ambiente stripe"
```

---

### Task 3: Regras de moeda e ambiente

**Files:**
- Modify: `src/lib/pricing.ts`
- Modify: `src/lib/pricing.test.ts`

**Interfaces:**
- Produces: `currencyForCountry(countryCode: string, billingCurrency?: string | null): PlanCurrency`.
- Produces: `stripeEnvironment(): 'test' | 'live'`.
- Produces: `selectPlanPrice(prices: PlanPrice[], planId: string, currency: PlanCurrency, environment: StripeEnvironment): PlanPrice | null`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from 'vitest'
import { currencyForCountry, selectPlanPrice, stripeEnvironment } from './pricing'

describe('currencyForCountry', () => {
  it('usa BRL para o Brasil sem assinatura', () => {
    expect(currencyForCountry('BR')).toBe('BRL')
  })
  it('usa USD para os Estados Unidos sem assinatura', () => {
    expect(currencyForCountry('US')).toBe('USD')
  })
  it('usa USD para qualquer outro pais', () => {
    expect(currencyForCountry('PT')).toBe('USD')
  })
  it('mantem a moeda da assinatura existente', () => {
    expect(currencyForCountry('US', 'BRL')).toBe('BRL')
    expect(currencyForCountry('BR', 'USD')).toBe('USD')
  })
  it('ignora moeda invalida', () => {
    expect(currencyForCountry('BR', 'EUR')).toBe('BRL')
  })
})

describe('selectPlanPrice', () => {
  const prices = [
    { plan_id: 'ouro', environment: 'test', currency: 'BRL', stripe_price_id: 'p_brl_test', unit_amount: 4990 },
    { plan_id: 'ouro', environment: 'live', currency: 'USD', stripe_price_id: 'p_usd_live', unit_amount: 9990 },
  ] as const
  it('seleciona pela combinacao plano/ambiente/moeda', () => {
    expect(selectPlanPrice(prices, 'ouro', 'BRL', 'test')?.stripe_price_id).toBe('p_brl_test')
    expect(selectPlanPrice(prices, 'ouro', 'USD', 'live')?.stripe_price_id).toBe('p_usd_live')
  })
  it('retorna null quando nao existe', () => {
    expect(selectPlanPrice(prices, 'ouro', 'USD', 'test')).toBeNull()
  })
})

describe('stripeEnvironment', () => {
  it('retorna live somente com a variavel live', () => {
    expect(stripeEnvironment('live')).toBe('live')
    expect(stripeEnvironment('test')).toBe('test')
    expect(stripeEnvironment(undefined)).toBe('test')
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test -- src/lib/pricing.test.ts`
Expected: FAIL porque as funções não existem.

- [ ] **Step 3: Implementar em `src/lib/pricing.ts`**

- `currencyForCountry` retorna a moeda da assinatura se for `BRL`/`USD`; senão `countryCode === 'BR' ? 'BRL' : 'USD'`.
- `stripeEnvironment(value = import.meta.env.VITE_STRIPE_ENVIRONMENT)` retorna `'live'` apenas quando `value === 'live'`.
- `selectPlanPrice` filtra a lista por `plan_id`, `environment` e `currency` e retorna o primeiro ou `null`.
- Manter `currencyForLang` e `planPriceColumns` para compatibilidade até a limpeza final.

- [ ] **Step 4: Rodar e confirmar o sucesso**

Run: `npm test -- src/lib/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat: resolve moeda por pais e preco por ambiente"
```

---

### Task 4: Tipos e cadastro do profissional

**Files:**
- Modify: `src/types.ts`
- Modify: `src/composables/useAuth.ts`
- Modify: `src/components/ProfileEditModal.vue`
- Modify: `src/api/insforgeService.ts` (tipo de criação)

**Interfaces:**
- Consumes: `currencyForCountry`, `stripeEnvironment`.
- Produces: `Professional.billing_environment: 'test' | 'live'`.
- Produces: `PlanPrice` e `StripeEnvironment` em `src/types.ts` ou `src/lib/pricing.ts`.

- [ ] **Step 1: Adicionar os tipos**

```ts
export type StripeEnvironment = 'test' | 'live'

export interface PlanPrice {
  plan_id: string
  environment: StripeEnvironment
  currency: 'BRL' | 'USD'
  stripe_price_id: string
  unit_amount: number
}
```

Adicionar `billing_environment: StripeEnvironment` em `Professional`.

- [ ] **Step 2: Atualizar defaults e cadastro**

- Em `useAuth.ts`, adicionar `billing_environment: stripeEnvironment()` nos dois objetos de `proProfile`.
- No cadastro de profissional, gravar `billing_environment: stripeEnvironment()` e `billing_currency: currencyForCountry(country_code)`.
- Em `ProfileEditModal.vue`, no `createProfessional`, trocar `billing_currency: 'BRL'` por `currencyForCountry(proCountryCode.value)` e adicionar `billing_environment: stripeEnvironment()`.
- No `updateProfessional`, não enviar `billing_currency` nem `billing_environment`.

- [ ] **Step 3: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/composables/useAuth.ts src/components/ProfileEditModal.vue src/api/insforgeService.ts
git commit -m "feat: grava ambiente e moeda inicial do profissional"
```

---

### Task 5: Checkout e portal por ambiente

**Files:**
- Modify: `src/api/insforgeService.ts`
- Modify: `src/lib/pricing.test.ts` (se extrair helper)
- Test: `src/lib/pricing.test.ts`

**Interfaces:**
- Consumes: `selectPlanPrice`, `stripeEnvironment`.
- Produces: `createCheckoutSession(professionalId, plan, email, currency, environment)`.
- Produces: `createPortalSession(professionalId, environment)`.

- [ ] **Step 1: Atualizar `createCheckoutSession`**

- Receber `environment: StripeEnvironment`.
- Buscar em `plan_prices` com `.eq('plan_id', plan).eq('environment', environment).eq('currency', currency).maybeSingle()`.
- Se não houver Price, lançar `new Error(\`PRICE_NOT_CONFIGURED:${currency}:${environment}\`)`.
- Passar `environment` para `insforge.payments.stripe.createCheckoutSession(environment, {...})`.
- Manter `mode: 'subscription'`, `metadata` e `successUrl`/`cancelUrl`.

- [ ] **Step 2: Atualizar `createPortalSession`**

- Receber `environment: StripeEnvironment`.
- Passar `environment` para `createCustomerPortalSession`.

- [ ] **Step 3: Rodar typecheck e testes**

Run: `npm run typecheck && npm test -- src/lib/pricing.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/api/insforgeService.ts
git commit -m "feat: checkout e portal respeitam ambiente stripe"
```

---

### Task 6: `usePlans` e interface

**Files:**
- Modify: `src/composables/usePlans.ts`
- Modify: `src/views/pro/PerfilProView.vue`
- Modify: `src/views/landing/LandingView.vue`
- Modify: `src/components/modals/UpgradeModal.vue`
- Modify: `src/components/modals/OnboardingPlansModal.vue`
- Modify: `src/i18n/pt.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

**Interfaces:**
- Consumes: `currencyForCountry`, `stripeEnvironment`, `createCheckoutSession`, `createPortalSession`.
- Produces: `planCurrency` por país; `subscribePlan` abre portal quando já existe assinatura.

- [ ] **Step 1: Trocar a moeda para país**

Em `usePlans.ts`, substituir `currencyForLang` por `currencyForCountry`:

```ts
const planCurrency = computed<PlanCurrency>(() =>
  currencyForCountry(
    proProfile.value.country_code,
    hasActiveSubscription ? proProfile.value.billing_currency : null,
  ),
)
```

- [ ] **Step 2: Ajustar `subscribePlan`**

- Calcular `environment = stripeEnvironment()`.
- Se já existe assinatura ativa/past_due, chamar `handleOpenPortal()` e retornar.
- Chamar `createCheckoutSession(proProfile.value.id, targetPlan, proProfile.value.email, currency, environment)`.
- Capturar `PRICE_NOT_CONFIGURED:` e mostrar toast `toasts.priceNotConfigured`.
- Remover o uso de `changePlan` no fluxo principal.

- [ ] **Step 3: Ajustar `handleOpenPortal`**

- Usar `proProfile.value.billing_environment` quando existir assinatura; senão `stripeEnvironment()`.
- Passar o ambiente para `createPortalSession`.

- [ ] **Step 4: Recarregar após checkout**

Em `PerfilProView.vue` (ou no `App.vue` se o retorno cair na landing), detectar `session_id` na URL e chamar `loadProfessionalProfile` do profissional logado. Remover o parâmetro da URL depois.

- [ ] **Step 5: Ajustar textos**

Adicionar em `pt.ts`, `en.ts` e `es.ts`:

- `toasts.priceNotConfigured`: “Pagamento em {currency} ainda não está configurado neste ambiente.”
- `plans.billedInBrl`: “Cobrança em R$ (Brasil)”
- `plans.billedInUsd`: “Billed in US$ (international)”
- `plans.cardOnly`: “Cartão de crédito ou débito”

Substituir `usdNotConfigured` por `priceNotConfigured` onde usado.

- [ ] **Step 6: Landing**

Na landing anônima, exibir os dois preços com nota: “Brasil R$ 49,90/mês · Exterior US$ 99,90/mês”. No painel logado, exibir apenas a moeda do país.

- [ ] **Step 7: Rodar typecheck, lint e testes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/composables/usePlans.ts src/views/pro/PerfilProView.vue src/views/landing/LandingView.vue src/components/modals/UpgradeModal.vue src/components/modals/OnboardingPlansModal.vue src/i18n/pt.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat: assinatura usa pais e ambiente na interface"
```

---

### Task 7: `change-plan` por ambiente

**Files:**
- Modify: `functions/change-plan.ts`

**Interfaces:**
- Consumes: `public.plan_prices`, `public.professionals.billing_environment`.
- Produces: endpoint que usa `STRIPE_LIVE_SECRET_KEY` quando o profissional está em live.

- [ ] **Step 1: Selecionar a chave por ambiente**

```ts
const environment = proData.billing_environment === 'live' ? 'live' : 'test'
const secretKey = environment === 'live'
  ? Deno.env.get('STRIPE_LIVE_SECRET_KEY')
  : Deno.env.get('STRIPE_TEST_SECRET_KEY')
if (!secretKey) throw new Error(`Missing Stripe ${environment} secret key`)
```

- [ ] **Step 2: Buscar o Price em `plan_prices`**

Substituir a leitura de `plans.stripe_price_id[_usd]` por uma consulta a `plan_prices` com `plan_id`, `environment` e `billing_currency`.

- [ ] **Step 3: Atualizar a assinatura**

- Atualizar o item da subscription com o novo Price.
- Gravar `billing_environment = environment` no profissional.
- Manter o comportamento de erro quando não houver Price.

- [ ] **Step 4: Rodar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/change-plan.ts
git commit -m "feat: change-plan suporta ambiente live"
```

---

### Task 8: Verificação final

**Files:**
- Modify: `.env.example`
- Modify: `README.md` (se necessário)

- [ ] **Step 1: Documentar as variáveis**

Adicionar em `.env.example`:

```env
# 'test' ou 'live'. Use 'live' no build de produção.
VITE_STRIPE_ENVIRONMENT=test

# Secrets gerenciadas no InsForge:
#   STRIPE_LIVE_SECRET_KEY
#   STRIPE_LIVE_WEBHOOK_SECRET
```

- [ ] **Step 2: Rodar a suíte completa**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: todos passam.

- [ ] **Step 3: Checklist manual Stripe/InsForge**

- [ ] Criar Price test USD 99,90 e inserir em `plan_prices`.
- [ ] Criar Prices live BRL 49,90 e USD 99,90 e inserir em `plan_prices`.
- [ ] Conectar Stripe test e live no InsForge.
- [ ] Configurar webhooks test e live para a mesma função.
- [ ] Configurar `STRIPE_LIVE_SECRET_KEY` e `STRIPE_LIVE_WEBHOOK_SECRET`.
- [ ] Definir `VITE_STRIPE_ENVIRONMENT=live` na Vercel e redeployar.
- [ ] Testar assinatura BR e US em test mode.
- [ ] Confirmar que evento test não altera assinatura live.
- [ ] Testar assinatura real, portal e cancelamento em live.

- [ ] **Step 4: Commit final**

```bash
git add .env.example README.md
git commit -m "docs: documenta ambientes de cobranca stripe"
```

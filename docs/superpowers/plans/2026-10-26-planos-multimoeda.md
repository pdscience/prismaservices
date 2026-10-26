# Planos multi-moeda (BRL/USD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar Premium em R$ 49,90 para pt-BR e US$ 99,90 para en/es, exibindo e cobrando na moeda correta sem quebrar assinaturas existentes.

**Architecture:** Duas colunas de preço/Price ID em `plans`, mais `professionals.billing_currency`. Novas assinaturas escolhem a moeda pelo idioma; assinaturas ativas usam a moeda gravada. Checkout, troca de plano e webhook selecionam o Price ID da moeda correspondente.

**Tech Stack:** Vue 3 + TypeScript, Vitest, InsForge/Postgres, Stripe (edge functions Deno).

**Spec:** `docs/superpowers/specs/2026-10-26-planos-multimoeda-design.md`

## Global Constraints

- Só Free e Premium são exibidos na interface.
- Premium BRL: `4990` centavos; Premium USD: `9990` centavos.
- `stripe_price_id_usd` começa nulo; checkout USD bloqueia com aviso claro até ser preenchido.
- Nunca trocar a moeda de uma assinatura existente.
- Manter paridade de chaves entre `pt.ts`, `en.ts` e `es.ts`.

---

### Task 1: Migration de dados

**Files:**
- Create: `migrations/20261026120000_planos-multimoeda.sql`

**Interfaces:**
- Produces: colunas `plans.monthly_price_usd`, `plans.stripe_price_id_usd`, `professionals.billing_currency`.

- [ ] **Step 1: Criar a migration**

```sql
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS monthly_price_usd INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_price_id_usd TEXT;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NOT NULL DEFAULT 'BRL';

UPDATE public.plans SET monthly_price = 4990, monthly_price_usd = 9990 WHERE id = 'ouro';
UPDATE public.plans SET monthly_price = 0,    monthly_price_usd = 0    WHERE id = 'gratuito';
```

- [ ] **Step 2: Verificar sintaxe**

Run: `npx -y @insforge/cli db query "SELECT id, monthly_price, monthly_price_usd FROM public.plans ORDER BY id" --json`
Expected: `ouro` com `4990/9990`; `gratuito` com `0/0`.

---

### Task 2: Webhook reconhece USD e grava billing_currency

**Files:**
- Create: `migrations/20261026121000_subscription-fulfillment-multimoeda.sql`

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `public.fulfill_professional_subscription()` atualizado.

- [ ] **Step 1: Recriar a função**

Copiar a função de `migrations/20260914142006_subscription-fulfillment.sql` e alterar:

```sql
-- checkout.session.completed
SET plan = COALESCE(..., plan),
    billing_currency = COALESCE(UPPER(NEW.payload -> 'data' -> 'object' ->> 'currency'), billing_currency),
    ...

-- customer.subscription.created / updated
WHEN v_price_id = (SELECT stripe_price_id FROM public.plans WHERE id = 'ouro')
  OR v_price_id = (SELECT stripe_price_id_usd FROM public.plans WHERE id = 'ouro') THEN 'ouro'
-- idem para prata e bronze
...
    billing_currency = COALESCE(UPPER(NEW.payload -> 'data' -> 'object' -> 'items' -> 'data' -> 0 -> 'price' ->> 'currency'), billing_currency),
```

- [ ] **Step 2: Aplicar e conferir**

Run: `npx -y @insforge/cli db query "SELECT proname FROM pg_proc WHERE proname = 'fulfill_professional_subscription'" --json`
Expected: uma linha.

---

### Task 3: Helpers puros de moeda (TDD)

**Files:**
- Create: `src/lib/pricing.ts`
- Create: `src/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `type PlanCurrency = 'BRL' | 'USD'`
  - `currencyForLang(lang: string, billingCurrency?: string | null): PlanCurrency`
  - `formatPlanPrice(cents: number, currency: PlanCurrency, lang: string): string`
  - `planPriceColumns(currency: PlanCurrency): { monthly: 'monthly_price' | 'monthly_price_usd'; stripe: 'stripe_price_id' | 'stripe_price_id_usd' }`

- [ ] **Step 1: Teste falho**

```ts
import { describe, expect, it } from 'vitest'
import { currencyForLang, formatPlanPrice, planPriceColumns } from './pricing'

describe('currencyForLang', () => {
  it('usa BRL em pt-BR e USD em en/es', () => {
    expect(currencyForLang('pt-BR')).toBe('BRL')
    expect(currencyForLang('en')).toBe('USD')
    expect(currencyForLang('es')).toBe('USD')
  })
  it('assinatura existente manda', () => {
    expect(currencyForLang('en', 'BRL')).toBe('BRL')
    expect(currencyForLang('pt-BR', 'USD')).toBe('USD')
  })
})

describe('formatPlanPrice', () => {
  it('formata reais e dólares', () => {
    expect(formatPlanPrice(4990, 'BRL', 'pt-BR').replace(/\u00a0/g, ' ')).toBe('R$ 49,90')
    expect(formatPlanPrice(9990, 'USD', 'en')).toBe('$99.90')
  })
})

describe('planPriceColumns', () => {
  it('mapeia as colunas por moeda', () => {
    expect(planPriceColumns('BRL')).toEqual({ monthly: 'monthly_price', stripe: 'stripe_price_id' })
    expect(planPriceColumns('USD')).toEqual({ monthly: 'monthly_price_usd', stripe: 'stripe_price_id_usd' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
export type PlanCurrency = 'BRL' | 'USD'

export function currencyForLang(lang: string, billingCurrency?: string | null): PlanCurrency {
  if (billingCurrency === 'BRL' || billingCurrency === 'USD') return billingCurrency
  return lang === 'pt-BR' ? 'BRL' : 'USD'
}

export function formatPlanPrice(cents: number, currency: PlanCurrency, lang: string): string {
  const locale = lang === 'pt-BR' ? 'pt-BR' : lang === 'es' ? 'es' : 'en'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

export function planPriceColumns(currency: PlanCurrency) {
  return currency === 'USD'
    ? { monthly: 'monthly_price_usd' as const, stripe: 'stripe_price_id_usd' as const }
    : { monthly: 'monthly_price' as const, stripe: 'stripe_price_id' as const }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/pricing.test.ts`
Expected: PASS.

---

### Task 4: Tipos e `usePlans` cientes da moeda

**Files:**
- Modify: `src/types.ts` (`Plan`, `Professional`)
- Modify: `src/composables/usePlans.ts`

**Interfaces:**
- Consumes: helpers da Task 3.
- Produces: `planCurrency`, `dbPlanPrice(id)` (sem fallback string), `subscribePlan` enviando moeda.

- [ ] **Step 1: Tipos**

`Plan` ganha `monthly_price_usd: number` e `stripe_price_id_usd: string | null`.
`Professional` ganha `billing_currency: 'BRL' | 'USD'`.

- [ ] **Step 2: `usePlans`**

- Importar `currencyForLang`, `formatPlanPrice`, `type PlanCurrency`.
- Criar `planCurrency` computed: usa `billing_currency` apenas se `stripe_subscription_id` e status `active`/`past_due`.
- Substituir `PLAN_FALLBACK_PRICES`/`formatBRL` por `PLAN_FALLBACK_CENTS` por moeda e `dbPlanPrice(id)`.
- `PLAN_PRICES`/`displayPlans.price` usam `dbPlanPrice`.
- `subscribePlan` envia `planCurrency` e bloqueia USD sem `stripe_price_id_usd` com `toasts.usdNotConfigured`.

- [ ] **Step 3: Rodar testes**

Run: `npm test`
Expected: PASS.

---

### Task 5: Checkout e troca de plano

**Files:**
- Modify: `src/api/insforgeService.ts:326-349`
- Modify: `functions/change-plan.ts:84-140`

**Interfaces:**
- Consumes: `PlanCurrency`, `planPriceColumns`.
- Produces: `createCheckoutSession(..., currency: PlanCurrency)`; `change-plan` mantém a moeda da assinatura.

- [ ] **Step 1: Checkout**

Selecionar `stripe_price_id, stripe_price_id_usd`; escolher pelo parâmetro `currency`; lançar `PRICE_NOT_CONFIGURED:<currency>` se ausente.

- [ ] **Step 2: change-plan**

Ler a assinatura atual, extrair `price.currency`, escolher o Price ID correspondente e gravar `billing_currency` na atualização.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 6: i18n e call sites

**Files:**
- Modify: `src/i18n/pt.ts`, `en.ts`, `es.ts` (`toasts.usdNotConfigured`)
- Modify: `src/views/landing/LandingView.vue` (remover argumentos de fallback)

**Interfaces:**
- Consumes: `dbPlanPrice(id)`.
- Produces: mensagem traduzida e preços formatados na landing/FAQ.

- [ ] **Step 1: i18n**

```
pt: 'Pagamento em dólar ainda não está disponível. Tente novamente em breve.'
en: 'USD payments are not available yet. Please try again soon.'
es: 'El pago en dólares aún no está disponible. Inténtalo de nuevo pronto.'
```

- [ ] **Step 2: Call sites**

Trocar `dbPlanPrice('gratuito', 'R$0')` por `dbPlanPrice('gratuito')` e `dbPlanPrice('ouro', 'R$79,90')` por `dbPlanPrice('ouro')`.

- [ ] **Step 3: Verificação completa**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: todos verdes.

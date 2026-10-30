# Assinaturas multi-moeda e ambientes Stripe

**Data:** 2026-10-30

## Objetivo

Cobrar a assinatura do profissional conforme o país do cadastro:

- Brasil (`country_code = 'BR'`): R$ 49,90/mês.
- Exterior (qualquer outro país): US$ 99,90/mês.

A assinatura é recorrente e feita no cartão de crédito ou débito. Pix não faz
parte do fluxo recorrente porque a Stripe não oferece Pix Automático para
empresas domiciliadas no Brasil.

## Regras

1. Assinatura existente manda: se `professionals.billing_currency` for `BRL`
   ou `USD`, essa é a moeda usada.
2. Sem assinatura, a moeda vem de `professionals.country_code`: `BR` → `BRL`,
   qualquer outro valor → `USD`.
3. O ambiente (`test` ou `live`) vem de `VITE_STRIPE_ENVIRONMENT`. O padrão é
   `test`.
4. Cada combinação `(plano, ambiente, moeda)` tem seu próprio Price ID na
   Stripe. Os IDs ficam em `public.plan_prices`.
5. Eventos de webhook só podem alterar assinaturas do mesmo ambiente. Um evento
   de teste não pode alterar uma assinatura live e vice-versa.
6. O país é autodeclarado. A proteção contra arbitragem fica para uma fase
   posterior.

## Modelo de dados

```sql
create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  environment text not null check (environment in ('test', 'live')),
  currency text not null check (currency in ('BRL', 'USD')),
  stripe_price_id text not null,
  unit_amount integer not null,
  created_at timestamptz not null default now(),
  unique (plan_id, environment, currency)
);

alter table public.professionals
  add column billing_environment text not null default 'test'
  check (billing_environment in ('test', 'live'));
```

As colunas antigas `plans.stripe_price_id` e `plans.stripe_price_id_usd`
permanecem por uma release como legado e não são mais lidas pelo código novo.

## Fluxo

1. O profissional se cadastra com `country_code` e `billing_environment`.
2. Ao assinar, o frontend resolve a moeda pelo país.
3. `createCheckoutSession` busca o Price em `plan_prices` pelo plano, ambiente
   e moeda.
4. A Stripe Checkout cria a assinatura no cartão.
5. O webhook grava plano, status, `billing_currency` e `billing_environment`.
6. Assinatura existente é gerenciada pelo Billing Portal.

## Fora de escopo

- Pix recorrente.
- Cobrança avulsa via Pix.
- Bloqueio automático de arbitragem de país.
- Remoção das colunas legadas de Price ID.

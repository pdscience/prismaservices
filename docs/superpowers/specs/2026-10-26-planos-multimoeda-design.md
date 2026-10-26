# Planos multi-moeda (BRL/USD) — Design

Aprovado pelo usuário em 2026-10-26 (modo plano; decisões registradas aqui como autoridade).

## Contexto

Hoje `public.plans` guarda apenas `monthly_price` (centavos de BRL) e um único
`stripe_price_id`. O checkout e o webhook usam esse mesmo preço para todos os
idiomas. O produto agora precisa cobrar:

- **pt-BR:** Premium R$ 49,90/mês
- **en / es:** Premium US$ 99,90/mês

Plano Free continua US$ 0 / R$ 0. Bronze e Prata continuam no banco, mas não
são exibidos na interface (só Free e Premium).

## Decisões

1. **Moeda da nova assinatura = idioma da interface no momento do checkout.**
   `pt-BR` → BRL; `en` e `es` → USD.
2. **Assinatura existente manda.** Quem já possui assinatura ativa vê e paga na
   moeda gravada em `professionals.billing_currency`, independentemente do
   idioma atual. A moeda da assinatura não muda no meio do contrato.
3. **Stripe ainda não tem Price ID USD.** O código fica preparado: enquanto
   `plans.stripe_price_id_usd` for nulo, o preço é exibido, mas o checkout em
   USD é bloqueado com mensagem clara. Nenhuma cobrança em moeda errada.
4. **Abordagem escolhida:** colunas por moeda em `plans` (não criar tabela
   `plan_prices`). Só existem duas moedas; simplicidade e compatibilidade com
   o schema atual vencem.

## Modelo de dados

Migration `migrations/<timestamp>_planos-multimoeda.sql`:

```sql
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS monthly_price_usd INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_price_id_usd TEXT;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NOT NULL DEFAULT 'BRL';

UPDATE public.plans SET monthly_price = 4990, monthly_price_usd = 9990 WHERE id = 'ouro';
UPDATE public.plans SET monthly_price = 0,    monthly_price_usd = 0    WHERE id = 'gratuito';
```

- `billing_currency` default `BRL` cobre os assinantes já existentes.
- `stripe_price_id_usd` fica nulo até o usuário criar o Price de US$ 99,90 no
  Stripe e preencher a coluna.

## Exibição

Criar helpers puros em `src/lib/pricing.ts`:

- `type PlanCurrency = 'BRL' | 'USD'`
- `currencyForLang(lang, billingCurrency?)`: se houver assinatura ativa com
  `billing_currency`, usa essa moeda; senão `lang === 'pt-BR' ? 'BRL' : 'USD'`.
  Trial e Free não têm cobrança, logo usam o idioma.
- `formatPlanPrice(cents, currency, lang)`: `Intl.NumberFormat(lang, { style:
  'currency', currency })`. Free mostra `R$ 0,00` / `$0.00`.
- `priceColumnForCurrency(currency)`: `'monthly_price_usd' | 'monthly_price'`
  e o equivalente para o Stripe Price ID.

`usePlans` passa a:

- Calcular `planCurrency` (reativo ao idioma e ao perfil).
- `dbPlanPrice(id)` devolve o valor já formatado na moeda vigente. Remove a
  assinatura antiga `(id, fallbackString)`; atualizar todos os call sites
  (`LandingView`, `displayPlans`, `PLAN_PRICES`).
- `PLAN_PRICES` e `displayPlans.price` usam a mesma função.
- `subscribePlan` bloqueia com toast `toasts.usdNotConfigured` quando a moeda é
  USD e `stripe_price_id_usd` está vazio.

## Checkout (`createCheckoutSession`)

Assinatura nova em `src/api/insforgeService.ts`:

```ts
createCheckoutSession(professionalId, plan, email, currency: PlanCurrency)
```

- Seleciona `stripe_price_id` e `stripe_price_id_usd`; escolhe conforme
  `currency`.
- Se o Price ID da moeda estiver vazio, lança erro com código reconhecível
  (`PRICE_NOT_CONFIGURED:<currency>`), que o `subscribePlan` traduz.
- Demais parâmetros inalterados.

## Troca de plano (`functions/change-plan.ts`)

- Lê a assinatura atual no Stripe e extrai a moeda do item
  (`items.data[0].price.currency`).
- Escolhe o Price ID do plano-alvo na **mesma moeda** — nunca troca a moeda da
  assinatura.
- Se o Price ID daquela moeda não existir, responde 500 com mensagem clara.
- Ao atualizar o plano, grava `billing_currency` conforme a moeda do Stripe.

## Webhook (`subscription-fulfillment`)

Nova migration que recria `public.fulfill_professional_subscription()`:

- O `CASE` que resolve o plano compara o Price ID com **os dois** campos
  (`stripe_price_id` e `stripe_price_id_usd`).
- Em `checkout.session.completed`, `customer.subscription.created` e
  `customer.subscription.updated`, grava `billing_currency` a partir de:
  - `payload.data.object.currency` (checkout), ou
  - `payload.data.object.items.data[0].price.currency` (subscription),
  - sempre em maiúsculas (`BRL` / `USD`).
- Restante da lógica de status/expiração permanece igual.

## Interface

- `src/types.ts`: `Plan` ganha `monthly_price_usd` e `stripe_price_id_usd`;
  `Professional` ganha `billing_currency`.
- `src/views/pro/PerfilProView.vue`, `OnboardingPlansModal`, `UpgradeModal` e
  `LandingView` continuam consumindo `displayPlans`/`dbPlanPrice`; nenhuma
  lógica de moeda duplicada nas views.
- Landing EN/ES exibe `$99.90`; PT exibe `R$ 49,90`. O FAQ que monta o texto
  dos planos também usa o valor formatado.
- i18n: nova chave `toasts.usdNotConfigured` nos três catálogos
  (paridade obrigatória pelo teste existente).

## Erros e bordas

- **USD não configurado:** preço visível, botão de assinar mostra toast
  "Pagamento em dólar ainda não disponível" e não abre checkout.
- **Usuário BRL muda para EN depois de assinar:** continua vendo BRL.
- **Usuário Free muda para EN:** vê USD e, ao assinar, é cobrado em USD.
- **Assinantes legados:** `billing_currency = 'BRL'`.
- **Preço do Stripe divergente do banco:** a cobrança segue o Price ID; após
  criar os produtos, o usuário deve alinhar os valores no Stripe. Documentar
  no resumo final.
- **Bronze/Prata:** não exibidos; valores USD podem ficar em 0 até decisão
  futura.

## Testes

- `src/lib/pricing.test.ts` (novo): moeda por idioma, override pela assinatura,
  formatação BRL/USD, Free, coluna correta.
- `src/i18n/i18n.test.ts` continua validando paridade das novas chaves.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Fora de escopo

- Criar os produtos/Price IDs no Stripe (ação manual do usuário).
- Migrar assinaturas existentes para o novo valor de R$ 49,90.
- Novas moedas além de BRL/USD.
- Conversão cambial dinâmica.

# AI Analysis Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing AI analysis reliable, safe, language-aware and linked to the user/request, without changing the main UX.

**Architecture:** Extend the canonical `AIAnalysis` contract with confidence/urgency/safety risk; send the app language and canonical categories to the functions; poll the analysis row until ready; add ownership, observability and rate limiting; correct `final_price` semantics.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest; InsForge functions (Deno) + Postgres migrations; NVIDIA vision model.

**Spec:** This plan is the spec (approved in conversation on 2026-11-17).

## Global Constraints

- Categories, complexity, urgency and recommendedAction stay canonical in Portuguese in the database; only display text is localized.
- App language (`pt-BR`, `en`, `es`) drives the AI response language.
- `final_price` is `null` when the request is created; the estimate stays in `ai_analysis`.
- AI category suggestions are never applied without user confirmation.
- Functions are deployed per single file; do not rely on relative imports between function files.
- Rate limit: 10 analyses per user per hour.
- Image payload cap: 800,000 base64 characters; notes cap: 2,000 characters.
- Polling: 4s interval, 90s timeout.

## Review Focus

- Slow or absent worker must not leave an infinite spinner or lose the result.
- Inverted or absurd prices, or a non-canonical category, must not break filters or display invalid values.
- `user_id` null on old rows must not block polling or the worker.
- `final_price = null` must not break receipts/history or render `undefined`.
- Rate limiting must not block the normal flow or leak internal details.

---

### Task 1: Migration, types and API contracts

**Files:**
- Create: `migrations/20261117000000_ai-analysis-foundation.sql`
- Modify: `src/types.ts`
- Modify: `src/lib/quoteFlow.ts`
- Test: `src/lib/quoteFlow.test.ts`

**Interfaces:**
- Produces: `AIAnalysis` with optional `confidence`, `urgency`, `safetyRisk`; `ServiceRequest.analysis_id: string | null`; `buildQuotePayload` returns `final_price: null` and `analysis_id`.

- [ ] **Step 1: Write the failing test**

In `src/lib/quoteFlow.test.ts`, update `buildQuotePayload` tests to expect `p.final_price` to be `null` even when `finalPrice: 150` is passed, and add a test that `analysisId: 'a1'` becomes `analysis_id: 'a1'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quoteFlow.test.ts`
Expected: FAIL because `final_price` is `150` and `analysis_id` is missing.

- [ ] **Step 3: Implement the migration and types**

Create the migration adding `user_id`, `language`, `category_options`, `provider`, `model`, `latency_ms`, `fallback`, `error`, `confidence` to `service_analyses`; add `service_requests.analysis_id`; replace the `service_analyses` SELECT/INSERT policies with owner/worker-aware policies; keep UPDATE open and document the residual worker risk.

Extend `AIAnalysis` in `src/types.ts`:

```ts
confidence?: number
urgency?: 'Baixa' | 'Média' | 'Alta'
safetyRisk?: string
```

Add `analysis_id: string | null` to `ServiceRequest`.

In `src/lib/quoteFlow.ts`, remove `finalPrice` from the args and set `final_price: null`; add `analysisId: string | null` to the args and set `analysis_id: args.analysisId`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quoteFlow.test.ts`
Expected: PASS.

---

### Task 2: Analysis normalization

**Files:**
- Create: `src/lib/aiAnalysis.ts`
- Test: `src/lib/aiAnalysis.test.ts`

**Interfaces:**
- Produces: `normalizeAnalysis(raw: unknown, opts: { fallbackCategory: string; categories: string[] }): AIAnalysis | null`.

- [ ] **Step 1: Write the failing tests**

Cover: `Media` becomes `Média`; unknown category falls back to `fallbackCategory`; inverted prices are swapped; negative prices become 0; materials are trimmed and limited to 4; `confidence` accepts `85`, `0.85` and `"85%"`; missing `summary`/`description` returns `null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/aiAnalysis.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `normalizeAnalysis`**

Rules: required `summary` and `description` strings; canonical category; canonical complexity/urgency; integer prices `0..1_000_000` with min/max swap; materials max 4; recommendedAction normalized to `Custo Direto`/`Visita Técnica`; `confidence` 0–1; `safetyRisk` max 200 chars.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/aiAnalysis.test.ts`
Expected: PASS.

---

### Task 3: Polling helper

**Files:**
- Create: `src/lib/analysisPolling.ts`
- Test: `src/lib/analysisPolling.test.ts`

**Interfaces:**
- Produces: `pollAnalysis<T>(fetchOnce: () => Promise<{ status: string; analysis: T | null; fallback?: boolean }>, opts?: { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number }): Promise<{ status: 'ready' | 'error' | 'timeout'; analysis: T | null; fallback: boolean }>`.

- [ ] **Step 1: Write the failing tests**

Cover: ready on first call; processing then ready; error stops immediately; timeout returns `status: 'timeout'`; no real timers (inject `sleep` and `now`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/analysisPolling.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `pollAnalysis`**

Loop until ready/error or timeout; default interval 4,000ms and timeout 90,000ms; never throw on a transient fetch error, return `error`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/analysisPolling.test.ts`
Expected: PASS.

---

### Task 4: Frontend API integration

**Files:**
- Modify: `src/api/insforgeService.ts`

**Interfaces:**
- Produces: `analyzeWithAI(imageBase64, category, notes, lang, categories)`; `getAnalysis(id): Promise<{ status: 'processing' | 'working' | 'ready' | 'error'; analysis: AIAnalysis | null; fallback: boolean }>`.

- [ ] **Step 1: Update `analyzeWithAI`**

Send `lang` and `categories` in the body. Keep the existing payload shrinking.

- [ ] **Step 2: Add `getAnalysis`**

Select `status,result,fallback` from `service_analyses` by id with `.single()`; map `result` to `analysis`.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors (callers will be updated in Task 5).

---

### Task 5: `useQuoteForm` polling, language and rate limit

**Files:**
- Modify: `src/composables/useQuoteForm.ts`

**Interfaces:**
- Consumes: `normalizeAnalysis`, `pollAnalysis`, `getAnalysis`, new `analyzeWithAI` signature.
- Produces: `isRefining`, `analysisTimedOut`, `cancelAnalysisPolling` in `useQuoteForm()`; `analysisId` passed to `buildQuotePayload`.

- [ ] **Step 1: Wire language/categories/normalization**

Import `CATEGORIES`; call `analyzeWithAI(..., lang.value, CATEGORIES.map(c => c.name))`; normalize the response; if `res.fallback`, replace text fields with the existing `ai.fallback*` translations.

- [ ] **Step 2: Add polling**

When `res.status === 'processing'` and `analysisId` exists, set `isRefining`, start `pollAnalysis(() => getAnalysis(id))`; on `ready` update the result; on `error`/`timeout` keep the preliminary and set `analysisTimedOut`. Use a generation counter so a new analysis or `resetForm` cancels the previous poll.

- [ ] **Step 3: Rate limit handling**

If the thrown error has `statusCode === 429`, push the `toasts.aiRateLimited` warning and set `aiFallback`.

- [ ] **Step 4: Pass `analysisId` on order creation**

Store the id in a ref and pass it to `buildQuotePayload`; remove `finalPrice`.

- [ ] **Step 5: Verify typecheck and tests**

Run: `npm run typecheck && npx vitest run src/lib/quoteFlow.test.ts`
Expected: PASS.

---

### Task 6: Functions

**Files:**
- Modify: `functions/analyze-service.ts`
- Modify: `functions/analyze-worker.ts`

**Interfaces:**
- Consumes: the request body now includes `lang` and `categories`.
- Produces: localized prompt, normalized analysis, persisted observability fields.

- [ ] **Step 1: Update `analyze-service`**

Validate input caps; rate limit by `user_id`; build a localized system prompt with canonical categories; insert `user_id`, `language`, `category_options`, `provider`, `model`; store `latency_ms`, `fallback`, `error`; clear `image_base64` on completion; return `analysisId` and `fallback`.

- [ ] **Step 2: Update `analyze-worker`**

Select `language` and `category_options`; use the same prompt/normalization; persist `latency_ms`, `model`, `fallback`, `error`; clear the image on success/error.

- [ ] **Step 3: Verify no TypeScript syntax errors**

Run: `npx tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --target es2022 functions/analyze-service.ts functions/analyze-worker.ts` if the Deno types are unavailable; otherwise rely on `npm run typecheck` (functions are excluded) and manual review.

Expected: no syntax errors.

---

### Task 7: UI, i18n and analytics

**Files:**
- Modify: `src/views/client/SolicitarView.vue`
- Modify: `src/views/client/MeusPedidosView.vue`
- Modify: `src/i18n/pt.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`
- Modify: `src/lib/analytics.ts`

**Interfaces:**
- Consumes: `isRefining`, `analysisTimedOut`, `cancelAnalysisPolling`, `latestAiResult`.

- [ ] **Step 1: Add i18n keys**

Add `client.aiSuggestedCategory`, `client.useSuggestedCategory`, `client.aiConfidence`, `client.aiUrgency`, `client.aiRecommendation`, `client.aiRefining`, `client.aiTimeout`, `ai.actionDirect`, `ai.actionVisit`, `toasts.aiRateLimited` in all three catalogs.

- [ ] **Step 2: Add the suggestion banner and badges**

Compute `suggestedCategory` from `latestAiResult.category` when it is in `CATEGORIES` and differs from `selectedCategory`; show a banner with an apply button. Show confidence, urgency and recommendedAction badges in the result card.

- [ ] **Step 3: Add refining/timeout feedback and cleanup**

Show `isRefining` in the result card; show the timeout message when `analysisTimedOut`; call `cancelAnalysisPolling` in `onUnmounted`.

- [ ] **Step 4: Fix `MeusPedidosView` price fallback**

Use `req.final_price ?? req.ai_analysis?.suggestedMinPrice ?? 0`.

- [ ] **Step 5: Analytics**

Extend `ConversionEvent` and track started/ready/fallback/error/rate-limited/category-applied events.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass, including i18n parity.

---

### Task 8: Final verification

- [ ] **Step 1: Run the full suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 2: Manual deploy checklist (outside the code change)**

Apply the migration and redeploy the two functions:

```bash
npx --no-install @insforge/cli db migrations up --project CasaOR
npx --no-install @insforge/cli functions deploy analyze-service --file functions/analyze-service.ts
npx --no-install @insforge/cli functions deploy analyze-worker --file functions/analyze-worker.ts
```

Expected: migration applied, both functions deployed, a real analysis row contains `user_id`, `language`, `fallback` and `analysis_id` is set on the request.

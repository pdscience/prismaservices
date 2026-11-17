import { createClient } from 'npm:@insforge/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Key',
}

const SUPPORTED_LANGS = ['pt-BR', 'en', 'es']
const MAX_PRICE = 1_000_000
const MAX_MATERIALS = 4
const MAX_SAFETY_RISK = 200

const REQUIRED_ANALYSIS_FIELDS = ['summary', 'description', 'category', 'complexity', 'estimatedTime', 'materialsNeeded', 'suggestedMinPrice', 'suggestedMaxPrice', 'technicalNotes', 'recommendedAction']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function toIntegerReais(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return Math.round(n)
  }
  return 0
}

function clampPrice(value: unknown): number {
  return Math.min(MAX_PRICE, Math.max(0, toIntegerReais(value)))
}

function normalizeComplexity(value: unknown): 'Baixa' | 'Média' | 'Alta' {
  const normalized = stripAccents(asString(value))
  if (normalized === 'baixa') return 'Baixa'
  if (normalized === 'alta') return 'Alta'
  return 'Média'
}

function normalizeUrgency(value: unknown): 'Baixa' | 'Média' | 'Alta' | undefined {
  const normalized = stripAccents(asString(value))
  if (normalized === 'baixa') return 'Baixa'
  if (normalized === 'media') return 'Média'
  if (normalized === 'alta') return 'Alta'
  return undefined
}

function normalizeRecommendedAction(value: unknown): string {
  return stripAccents(asString(value)).includes('visita') ? 'Visita Técnica' : 'Custo Direto'
}

function normalizeConfidence(value: unknown): number | undefined {
  let n: number
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string') {
    n = Number(value.replace('%', '').replace(',', '.').trim())
  } else {
    return undefined
  }
  if (!Number.isFinite(n)) return undefined
  if (n > 1 && n <= 100) n /= 100
  return Math.min(1, Math.max(0, n))
}

// Mantido em sincronia com src/lib/aiAnalysis.ts e functions/analyze-service.ts.
function normalizeAnalysis(raw: unknown, fallbackCategory: string, categories: string[]): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>

  const summary = asString(obj.summary)
  const description = asString(obj.description)
  if (!summary || !description) return null

  const rawCategory = asString(obj.category)
  const category = categories.includes(rawCategory) ? rawCategory : fallbackCategory

  const rawMaterials = Array.isArray(obj.materialsNeeded) ? obj.materialsNeeded : []
  const materialsNeeded = rawMaterials.map(asString).filter(Boolean).slice(0, MAX_MATERIALS)

  let suggestedMinPrice = clampPrice(obj.suggestedMinPrice)
  let suggestedMaxPrice = clampPrice(obj.suggestedMaxPrice)
  if (suggestedMinPrice > suggestedMaxPrice) {
    const swap = suggestedMinPrice
    suggestedMinPrice = suggestedMaxPrice
    suggestedMaxPrice = swap
  }

  const safetyRisk = asString(obj.safetyRisk).slice(0, MAX_SAFETY_RISK)
  const urgency = normalizeUrgency(obj.urgency)
  const confidence = normalizeConfidence(obj.confidence)

  return {
    summary,
    description,
    category,
    complexity: normalizeComplexity(obj.complexity),
    estimatedTime: asString(obj.estimatedTime),
    materialsNeeded,
    suggestedMinPrice,
    suggestedMaxPrice,
    technicalNotes: asString(obj.technicalNotes),
    recommendedAction: normalizeRecommendedAction(obj.recommendedAction),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(urgency !== undefined ? { urgency } : {}),
    ...(safetyRisk ? { safetyRisk } : {}),
  }
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // tenta próxima estratégia
  }
  return null
}

function extractAndValidateAnalysis(content: string | undefined): Record<string, unknown> | null {
  if (!content) return null
  const candidates: string[] = []
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.push(fenced[1].trim())
  candidates.push(content.trim())
  const first = content.indexOf('{')
  const last = content.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(content.slice(first, last + 1))
  for (const c of candidates) {
    const obj = tryParseObject(c.replace(/,\s*([}\]])/g, '$1'))
    if (!obj) continue
    let ok = true
    for (const f of REQUIRED_ANALYSIS_FIELDS) if (!(f in obj)) { ok = false; break }
    if (!ok) continue
    return obj
  }
  return null
}

function buildSystemPrompt(language: string, categories: string[]): string {
  const list = categories.length > 0 ? categories.join(', ') : 'the most appropriate trade'
  if (language === 'en') {
    return `You are an expert in residential service quotes. Respond in English, EXCLUSIVELY with a valid JSON object (no markdown) with EXACTLY these fields: summary (short string), description (string, max 2 sentences), category (string; must be exactly one of: ${list}), complexity ("Baixa", "Media" or "Alta"), estimatedTime (short string), materialsNeeded (array of at most 4 short strings), suggestedMinPrice (integer in BRL), suggestedMaxPrice (integer in BRL), technicalNotes (short string, may be empty), recommendedAction ("Custo Direto" or "Visita Tecnica"), urgency ("Baixa", "Media" or "Alta"), confidence (number from 0 to 1), safetyRisk (short string, may be empty). Be concise in every text.`
  }
  if (language === 'es') {
    return `Eres un experto en presupuestos de servicios residenciales. Responde en español, EXCLUSIVAMENTE con un objeto JSON válido (sin markdown) con EXACTAMENTE estos campos: summary (string corto), description (string, máximo 2 frases), category (string; debe ser exactamente una de: ${list}), complexity ("Baixa", "Media" o "Alta"), estimatedTime (string corto), materialsNeeded (array con máximo 4 strings cortos), suggestedMinPrice (entero en BRL), suggestedMaxPrice (entero en BRL), technicalNotes (string corto, puede estar vacío), recommendedAction ("Custo Direto" o "Visita Tecnica"), urgency ("Baixa", "Media" o "Alta"), confidence (número de 0 a 1), safetyRisk (string corto, puede estar vacío). Sé conciso en todos los textos.`
  }
  return `Voce e um perito em orcamentos de servicos residenciais no Brasil. Responda em portugues, EXCLUSIVAMENTE com um objeto JSON valido (sem markdown), com EXATAMENTE estes campos: summary (string curta), description (string, max 2 frases), category (string; deve ser exatamente uma de: ${list}), complexity ("Baixa", "Media" ou "Alta"), estimatedTime (string curta), materialsNeeded (array com no maximo 4 strings curtas), suggestedMinPrice (inteiro em R$, ex. 1200), suggestedMaxPrice (inteiro em R$), technicalNotes (string curta, pode ser vazia), recommendedAction ("Custo Direto" ou "Visita Tecnica"), urgency ("Baixa", "Media" ou "Alta"), confidence (numero de 0 a 1), safetyRisk (string curta, pode ser vazia). Seja conciso em todos os textos.`
}

function buildUserText(language: string, category: string, notes: string): string {
  if (language === 'en') {
    return `You are an expert in technical assessment of residential and commercial services. Examine the photo and the information provided for the service category: "${category || 'General'}". Client description/notes: "${notes || 'No additional description'}". Analyze the damage, required repairs, materials and cost estimate in Brazilian Reais (BRL).`
  }
  if (language === 'es') {
    return `Eres un experto en evaluación técnica de servicios residenciales y comerciales. Examina la foto y la información proporcionada para la categoría de servicio: "${category || 'General'}". Descripción/observación del cliente: "${notes || 'Sin descripción adicional'}". Analiza los daños, reparaciones necesarias, materiales y estimación de costos en Reales brasileños (BRL).`
  }
  return `Voce e um perito em avaliacao tecnica de prestacao de servicos residenciais e comerciais no Brasil. Examine a foto e as informacoes fornecidas para a categoria de servico: "${category || 'Geral'}". Descricao/Observacao do cliente: "${notes || 'Sem descricao adicional'}". Faca uma analise minuciosa dos danos, reparos necessarios, materiais e estimativa de custos em Reais (R$).`
}

interface AnalysisRow {
  id: string
  category: string
  notes: string
  image_base64: string | null
  attempts: number
  status?: string
  updated_at?: string
  language?: string | null
  category_options?: unknown
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const workerKey = Deno.env.get('WORKER_KEY')
  if (!workerKey || req.headers.get('X-Worker-Key') !== workerKey) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  })

  // Pega a pendente mais antiga ou claim travado há +4 min (worker morto pelo timeout).
  // O claim é condicional: só vira 'working' se ainda estiver elegível.
  const cutoff = new Date(Date.now() - 4 * 60 * 1000).toISOString()
  const { data: candidates } = await client.database
    .from('service_analyses')
    .select('id, category, notes, image_base64, status, attempts, created_at, updated_at, language, category_options')
    .in('status', ['processing', 'working'])
    // Linhas legadas (user_id null) não entram na fila: não podem atrasar as novas.
    .not('user_id', 'is.null')
    .order('created_at', { ascending: true })
    .limit(10)

  const list = (candidates as AnalysisRow[] | null) || []
  const eligible = list.find((r) => r.status === 'processing' || (r.updated_at ?? '') < cutoff)
  if (!eligible) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const claimed = await client.database
    .from('service_analyses')
    .update({ status: 'working' })
    .eq('id', eligible.id)
    .in('status', ['processing', 'working'])
    .select('id, category, notes, image_base64, attempts, language, category_options')

  const rows = (claimed.data as AnalysisRow[] | null) || []
  if (rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, reason: 'claimed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const row = rows[0]
  const attempts = (row.attempts || 0) + 1
  const startedAt = Date.now()
  await client.database.from('service_analyses').update({ attempts }).eq('id', row.id)

  const apiKey = Deno.env.get('NVIDIA_API_KEY')
  const baseUrl = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1'
  const model = Deno.env.get('NVIDIA_MODEL') || 'meta/llama-3.2-11b-vision-instruct'
  const language = typeof row.language === 'string' && SUPPORTED_LANGS.includes(row.language) ? row.language : 'pt-BR'
  const categoryOptions = Array.isArray(row.category_options)
    ? row.category_options.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 30)
    : []

  // Erro só após 3 tentativas; antes disso volta para a fila do próximo minuto.
  const fail = async (reason: string) => {
    const latencyMs = Date.now() - startedAt
    if (attempts >= 3) {
      await client.database.from('service_analyses')
        .update({ status: 'error', image_base64: null, fallback: true, error: reason.slice(0, 500), latency_ms: latencyMs, model })
        .eq('id', row.id)
    } else {
      await client.database.from('service_analyses')
        .update({ status: 'processing', error: reason.slice(0, 500), model })
        .eq('id', row.id)
    }
  }

  try {
    if (!apiKey) {
      await fail('missing_api_key')
      return new Response(JSON.stringify({ processed: 1, result: 'error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!row.image_base64) {
      await fail('missing_image')
      return new Response(JSON.stringify({ processed: 1, result: 'error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanBase64 = row.image_base64.replace(/^data:image\/\w+;base64,/, '')
    const controller = new AbortController()
    const requestCutoff = setTimeout(() => controller.abort(), 100000)
    let result: Record<string, unknown> | null = null
    try {
      const aiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt(language, categoryOptions) },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserText(language, row.category, row.notes) },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } },
              ],
            },
          ],
          temperature: 0.4,
          top_p: 1,
          max_tokens: 512,
          stream: false,
        }),
        signal: controller.signal,
      })
      if (aiRes.ok) {
        const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const raw = extractAndValidateAnalysis(aiJson.choices?.[0]?.message?.content)
        result = raw ? normalizeAnalysis(raw, row.category || 'Geral', categoryOptions) : null
      }
    } catch (e) {
      console.error('Worker NVIDIA error:', e instanceof Error ? e.message : e)
    } finally {
      clearTimeout(requestCutoff)
    }

    if (result) {
      await client.database.from('service_analyses')
        .update({
          status: 'ready',
          result,
          image_base64: null,
          latency_ms: Date.now() - startedAt,
          model,
          fallback: false,
          error: null,
        })
        .eq('id', row.id)
      return new Response(JSON.stringify({ processed: 1, result: 'ready' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    await fail('invalid_result')
    return new Response(JSON.stringify({ processed: 1, result: 'error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Worker failed:', e)
    await fail(e instanceof Error ? e.message : 'unknown')
    return new Response(JSON.stringify({ processed: 0, result: 'error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

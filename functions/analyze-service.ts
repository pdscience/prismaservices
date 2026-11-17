import { createClient } from 'npm:@insforge/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const SUPPORTED_LANGS = ['pt-BR', 'en', 'es']
const MAX_IMAGE_BASE64 = 800_000
const MAX_NOTES = 2_000
const RATE_LIMIT_PER_HOUR = 10
const MAX_PRICE = 1_000_000
const MAX_MATERIALS = 4
const MAX_SAFETY_RISK = 200

const REQUIRED_ANALYSIS_FIELDS = ['summary', 'description', 'category', 'complexity', 'estimatedTime', 'materialsNeeded', 'suggestedMinPrice', 'suggestedMaxPrice', 'technicalNotes', 'recommendedAction']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

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

// Mantido em sincronia com src/lib/aiAnalysis.ts e functions/analyze-worker.ts.
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

function getFallbackAnalysis(category?: string, notes?: string): Record<string, unknown> {
  const cat = category || 'Geral'
  const catLower = cat.toLowerCase()
  let items = ['Pecas e insumos basicos de reposicao', 'Vedacoes / Conectores', 'Consumiveis de limpeza e acabamento']
  let summary = `Manutencao e Reparo em ${cat}`
  const desc = notes ? `Analise previa baseada no relato: "${notes}". Servico requer inspecao local de conectores e estado estrutural.` : `Diagnostico visual indica reparo padrao de manutencao na categoria ${cat}. Necessita verificacao tecnica.`
  if (catLower.includes('eletric')) { summary = 'Manutencao Eletrica / Troca de Ponto ou Fiação'; items = ['Disjuntor de seguranca', 'Fios paralelos 2.5mm', 'Fita isolante 3M', 'Tomadas/Interruptores novos'] }
  else if (catLower.includes('encan') || catLower.includes('hidr')) { summary = 'Reparo Hidraulico / Eliminacao de Vazamento'; items = ['Veda rosca', 'Conexao PVC / Cobre', 'Cola para tubo de PVC', 'Sifao ajustavel'] }
  else if (catLower.includes('pinto')) { summary = 'Preparacao de Superficie e Pintura Geral'; items = ['Massa corrida / acrilica', "Lixa d'agua 150/220", 'Tinta acrilica fosca', 'Rolo de la antigota'] }
  else if (catLower.includes('ar') || catLower.includes('clima')) { summary = 'Higienizacao Profunda / Recarga de Gas do Ar'; items = ['Gas refrigerante R410A / R32', 'Detergente bactericida', 'Lona de protecao de fumaca'] }
  return { summary, description: desc, category: cat, complexity: 'Média', estimatedTime: '2 a 3 horas', materialsNeeded: items, suggestedMinPrice: 0, suggestedMaxPrice: 0, technicalNotes: '', recommendedAction: 'Custo Direto' }
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
  // modelo às vezes ignora a ordem e escreve texto antes/depois: extrai o maior bloco {...}
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

async function runNvidia(
  apiKey: string,
  baseUrl: string,
  model: string,
  userContent: Array<Record<string, unknown>>,
  systemPrompt: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController()
  const cutoff = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
        top_p: 1,
        max_tokens: 512,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!aiRes.ok) return null
    const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return extractAndValidateAnalysis(aiJson.choices?.[0]?.message?.content)
  } catch {
    return null
  } finally {
    clearTimeout(cutoff)
  }
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  const userToken = authHeader ? authHeader.replace('Bearer ', '') : null

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    accessToken: userToken,
  })

  const { data: userData } = await client.auth.getCurrentUser()
  const userId = userData?.user?.id
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: { imageBase64?: string; mimeType?: string; category?: string; notes?: string; lang?: string; categories?: unknown }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  if (imageBase64.length > MAX_IMAGE_BASE64) {
    return json({ error: 'image_too_large' }, 413)
  }
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg'
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 120) : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, MAX_NOTES) : ''
  const language = typeof body.lang === 'string' && SUPPORTED_LANGS.includes(body.lang) ? body.lang : 'pt-BR'
  const categoryOptions = Array.isArray(body.categories)
    ? body.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 30)
    : []

  const apiKey = Deno.env.get('NVIDIA_API_KEY')
  const baseUrl = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1'
  const model = Deno.env.get('NVIDIA_MODEL') || 'meta/llama-3.2-11b-vision-instruct'
  const startedAt = Date.now()

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  let recentCount = 0
  try {
    const { count } = await client.database
      .from('service_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)
    recentCount = count ?? 0
  } catch {
    // Rate limit é proteção, não pode bloquear o fluxo normal.
    recentCount = 0
  }

  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return json({ error: 'rate_limited' }, 429)
  }

  let analysisId: string | null = null
  const preliminary = getFallbackAnalysis(category, notes)

  try {
    analysisId = crypto.randomUUID()
    const { error: insertError } = await client.database.from('service_analyses').insert([{
      id: analysisId,
      user_id: userId,
      category,
      notes,
      status: 'processing',
      result: null,
      image_base64: imageBase64 || null,
      language,
      category_options: categoryOptions,
      provider: 'nvidia',
      model,
      fallback: false,
    }])
    if (insertError) throw insertError

    if (!apiKey) {
      const latencyMs = Date.now() - startedAt
      await client.database.from('service_analyses').update({
        status: 'ready',
        result: preliminary,
        image_base64: null,
        fallback: true,
        error: 'missing_api_key',
        latency_ms: latencyMs,
      }).eq('id', analysisId)
      return json({ status: 'ready', analysis: preliminary, analysisId, fallback: true })
    }

    const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: buildUserText(language, category, notes) }]
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
      })
    }

    // Tentativa rápida: se a IA responder depressa, devolve o real de uma vez.
    const fast = await runNvidia(apiKey, baseUrl, model, userContent, buildSystemPrompt(language, categoryOptions), 15000)
    const normalized = fast ? normalizeAnalysis(fast, category || 'Geral', categoryOptions) : null
    if (normalized) {
      const latencyMs = Date.now() - startedAt
      await client.database.from('service_analyses').update({
        status: 'ready',
        result: normalized,
        image_base64: null,
        fallback: false,
        error: null,
        latency_ms: latencyMs,
      }).eq('id', analysisId)
      return json({ status: 'ready', analysis: normalized, analysisId, fallback: false })
    }

    // Lenta: responde o preliminar agora; o worker (schedule a cada 1 min)
    // conclui em background e o front faz polling até status=ready.
    await client.database.from('service_analyses').update({
      fallback: true,
      error: 'slow_or_invalid',
      latency_ms: Date.now() - startedAt,
    }).eq('id', analysisId)
    return json({ status: 'processing', analysis: preliminary, analysisId, fallback: true })
  } catch (error: unknown) {
    console.error('Erro na analise tecnica:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    if (analysisId) {
      await client.database.from('service_analyses').update({
        status: 'error',
        image_base64: null,
        fallback: true,
        error: message.slice(0, 500),
        latency_ms: Date.now() - startedAt,
      }).eq('id', analysisId)
    }
    return json({ status: 'error', analysis: preliminary, analysisId, fallback: true })
  }
}

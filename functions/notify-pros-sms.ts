import { createClient } from 'npm:@insforge/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cron-Key',
}

// Janela de leitura e teto por execução (anti-spam em caso de atraso do schedule).
const WINDOW_MINUTES = 3
const MAX_SENDS_PER_RUN = 50

function onlyDigits(phone: string): string {
  const raw = (phone || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // E.164 gravado pelo app (ex.: +5511987654321)
  if (raw.startsWith('+')) return digits
  // legado: numero nacional brasileiro
  return digits.startsWith('55') ? digits : `55${digits}`
}

// Twilio exige E.164 COM o "+" (o app grava "+5511987654321").
function toTwilio(phone: string): string {
  const digits = onlyDigits(phone)
  return digits ? `+${digits}` : ''
}

// Casa `needle` como token inteiro (limites não alfanuméricos). Evita falso
// positivo de UF de 2 letras: "sp" dentro de "Espadas"/"pa" dentro de "Praça".
function hasWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)
}

// Heurística documentada: sem dados de área no pro OU sem endereço no pedido,
// não filtra (melhor notificar a mais do que perder lead); senão exige
// sobreposição cidade/UF/bairro nos dois sentidos.
function areaMatches(
  address: string,
  pro: { cidade?: string | null; uf?: string | null; coverage_bairros?: string[] | null },
): boolean {
  const addr = (address || '').trim().toLowerCase()
  if (!addr) return true
  const areas = [pro.cidade ?? '', pro.uf ?? '', ...((pro.coverage_bairros as string[] | null) ?? [])]
    .map((a) => (a || '').trim().toLowerCase())
    .filter(Boolean)
  if (areas.length === 0) return true
  return areas.some((a) => hasWord(addr, a) || a.includes(addr))
}

async function alreadyLogged(
  client: ReturnType<typeof createClient>,
  requestId: string,
  proId: string,
): Promise<boolean> {
  const { data } = await client.database
    .from('notification_log')
    .select('id')
    .eq('request_id', requestId)
    .eq('pro_id', proId)
    .eq('channel', 'sms')
    .limit(1)
  return (data ?? []).length > 0
}

async function sendSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    })
    return resp.ok
  } catch (err) {
    console.error('Erro ao enviar SMS:', err)
    return false
  }
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const cronKey = Deno.env.get('NOTIFY_CRON_KEY')
  if (!cronKey || req.headers.get('X-Cron-Key') !== cronKey) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!accountSid || !authToken || !fromNumber) {
    return new Response(JSON.stringify({ skipped: 'twilio_not_configured' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  })

  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data: reqs, error: reqError } = await client.database
    .from('service_requests')
    .select('id, category, client_address')
    .eq('broadcast', true)
    .is('professional_id', null)
    .eq('status', 'Pendente')
    .gt('created_at', since)
    .limit(20)
  if (reqError) {
    console.error('Erro ao ler broadcasts:', reqError)
    return new Response(JSON.stringify({ error: 'Erro ao ler pedidos' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: pros } = await client.database
    .from('professionals')
    .select('id, phone, category, categories, cidade, uf, coverage_bairros, plan, alerts_enabled, country_code')
  const { data: plans } = await client.database
    .from('plans')
    .select('id, receives_broadcasts')
  const okPlans = new Set((plans ?? []).filter((p) => p.receives_broadcasts).map((p) => p.id))

  let sent = 0
  let failed = 0
  for (const r of reqs ?? []) {
    for (const p of pros ?? []) {
      if (sent >= MAX_SENDS_PER_RUN) break
      if (p.alerts_enabled === false || !okPlans.has(p.plan) || !p.phone) continue
      // SMS só para pros fora do Brasil (country_code vazio/nulo = BR, base legada).
      const cc = String(p.country_code ?? '').trim().toUpperCase()
      if (!cc || cc === 'BR') continue
      const cats = [p.category, ...((p.categories as string[] | null) ?? [])]
      if (!cats.includes(r.category)) continue
      if (!areaMatches(String(r.client_address ?? ''), p)) continue
      if (await alreadyLogged(client, r.id, p.id)) continue
      const body = `CasaObraReparos: new ${r.category ?? 'service'} request at ${String(r.client_address ?? '').slice(0, 60)}. Open the app for details.`
      const ok = await sendSms(accountSid, authToken, fromNumber, toTwilio(p.phone), body)
      if (ok) {
        await client.database
          .from('notification_log')
          .insert([{ request_id: r.id, pro_id: p.id, channel: 'sms' }])
        sent++
      } else {
        failed++
      }
    }
  }

  return new Response(JSON.stringify({ sent, scanned: (reqs ?? []).length, failed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

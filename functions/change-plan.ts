import { createClient } from 'npm:@insforge/sdk'
import Stripe from 'npm:stripe'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const PAID_PLANS = ['bronze', 'prata', 'ouro']

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
  if (!userData?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { professionalId?: string; targetPlan?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { professionalId, targetPlan } = body
  if (!professionalId || !targetPlan) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!PAID_PLANS.includes(targetPlan)) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const secretKey = Deno.env.get('STRIPE_TEST_SECRET_KEY')
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const stripe = new Stripe(secretKey)

  const { data: proData, error: proError } = await client.database
    .from('professionals')
    .select('stripe_subscription_id,plan,auth_id')
    .eq('id', professionalId)
    .maybeSingle()
  if (proError || !proData) {
    return new Response(JSON.stringify({ error: 'Professional not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (proData.auth_id && proData.auth_id !== userData.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!proData.stripe_subscription_id) {
    return new Response(JSON.stringify({ error: 'No active subscription found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: planData, error: planError } = await client.database
    .from('plans')
    .select('stripe_price_id, stripe_price_id_usd')
    .eq('id', targetPlan)
    .maybeSingle()
  if (planError) {
    return new Response(JSON.stringify({ error: 'Plan not found' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Lê os itens atuais para TROCAR o preço (semântica de substituição).
  // Sem o `id` do item existente, o Stripe ADICIONA um segundo item (cobrança
  // dupla) ou recusa quando o preço-alvo já está na assinatura.
  let currentItems: Array<{ id: string; priceId: string; currency: string }>
  let currentStatus = 'active'
  try {
    const current = await stripe.subscriptions.retrieve(proData.stripe_subscription_id)
    currentStatus = current.status
    currentItems = (current.items?.data ?? []).map((item) => ({
      id: item.id,
      priceId: item.price.id,
      currency: item.price.currency.toUpperCase(),
    }))
  } catch (error) {
    console.error('Erro ao ler assinatura atual:', error)
    return new Response(JSON.stringify({ error: 'Subscription not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // A moeda da assinatura não muda no meio do contrato: usa o Price ID da
  // mesma moeda cobrada hoje, nunca a moeda do idioma atual.
  const billingCurrency = currentItems[0]?.currency === 'USD' ? 'USD' : 'BRL'
  const priceId = billingCurrency === 'USD' ? planData?.stripe_price_id_usd : planData?.stripe_price_id
  if (!priceId) {
    return new Response(JSON.stringify({ error: `Price ID ${billingCurrency} not configured` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Idempotente: preço-alvo já é o único item → só garante o banco sincronizado.
  if (currentItems.length === 1 && currentItems[0].priceId === priceId) {
    await client.database
      .from('professionals')
      .update({ plan: targetPlan, billing_currency: billingCurrency })
      .eq('id', professionalId)
    return new Response(JSON.stringify({ subscriptionId: proData.stripe_subscription_id, status: currentStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const [keep, ...extras] = currentItems
    const items: Array<{ id?: string; deleted?: boolean; price?: string }> = keep
      ? [{ id: keep.id, price: priceId }]
      : [{ price: priceId }]
    for (const extra of extras) items.push({ id: extra.id, deleted: true })
    const subscription = await stripe.subscriptions.update(proData.stripe_subscription_id, {
      items,
      proration_behavior: 'create_prorations',
    })
    await client.database
      .from('professionals')
      .update({ plan: targetPlan, billing_currency: billingCurrency })
      .eq('id', professionalId)
    return new Response(JSON.stringify({ subscriptionId: subscription.id, status: subscription.status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro ao alterar plano:', error)
    return new Response(JSON.stringify({ error: 'Erro ao alterar plano' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

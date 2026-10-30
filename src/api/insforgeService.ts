import { insforge } from '../lib/insforge'
import { portfolioStorageKey } from '../lib/portfolio'
import { clampStars, type ProfessionalReview } from '../lib/reviews'
import type { PlanCurrency, PlanPrice, StripeEnvironment } from '../lib/pricing'
import type { AIAnalysis, Plan, Professional, Referral, ServiceRequest, User } from '../types'

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  const { data, error } = await insforge.database
    .from('service_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as ServiceRequest[]) || []
}

export async function createServiceRequest(request: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceRequest> {
  const { data, error } = await insforge.database
    .from('service_requests')
    .insert([{ ...request, id: crypto.randomUUID() }])
    .select()
    .single()

  if (error) throw error
  return data as ServiceRequest
}

export async function updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest> {
  const { data, error } = await insforge.database
    .from('service_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServiceRequest
}

export async function getProfessionals(): Promise<Professional[]> {
  const { data, error } = await insforge.database
    .from('professionals')
    .select('*')

  if (error) throw error
  return (data as Professional[]) || []
}

export async function getReferrals(referrerProId: string): Promise<Referral[]> {
  const { data, error } = await insforge.database
    .from('referrals')
    .select('*')
    .eq('referrer_pro_id', referrerProId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Referral[]) || []
}

export async function getProfessional(id: string): Promise<Professional | null> {
  const { data, error } = await insforge.database
    .from('professionals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return (data as Professional) || null
}

export async function getProfessionalByAuthId(authId: string): Promise<Professional | null> {
  const { data, error } = await insforge.database
    .from('professionals')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle()

  if (error) throw error
  return (data as Professional) || null
}

export async function getProfessionalReviews(professionalId: string): Promise<ProfessionalReview[]> {
  const { data, error } = await insforge.database
    .rpc('get_professional_reviews', { p_id: professionalId })
  if (error) throw error
  return ((data as ProfessionalReview[]) || []).map((review) => ({
    ...review,
    stars: clampStars(review.stars),
  }))
}

type ProfessionalDbDefaults =
  | 'rating'
  | 'reviews_count'
  | 'plan'
  | 'plan_status'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'plan_expires_at'
  | 'requests_this_month'
  | 'requests_reset_at'

type CreateProfessionalInput = Omit<Professional, 'id' | ProfessionalDbDefaults | 'referral_code'> &
  Partial<Pick<Professional, ProfessionalDbDefaults>>

export async function createProfessional(professional: CreateProfessionalInput): Promise<Professional> {
  const { data, error } = await insforge.database
    .from('professionals')
    .insert([{ ...professional, id: crypto.randomUUID() }])
    .select()
    .single()

  if (error) throw error
  return data as Professional
}

export async function updateProfessional(id: string, updates: Partial<Professional>): Promise<Professional> {
  const { data, error } = await insforge.database
    .from('professionals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Professional
}

export async function uploadProfessionalAvatar(file: File, ownerId: string): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60) || 'avatar'
  const key = `${ownerId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
  const delays = [500, 1200, 2500]
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const { data, error } = await insforge.storage
        .from('professional-avatars')
        .upload(key, file)
      if (!error && data?.url) return data.url
      lastErr = error
      if (!isTransientUploadError(error) || attempt === delays.length) {
        throw error ?? new Error('Upload failed')
      }
    } catch (err) {
      lastErr = err
      if (!isTransientUploadError(err) || attempt === delays.length) throw err
    }
    await new Promise((r) => setTimeout(r, delays[attempt]))
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed')
}

// Envia foto do portfólio para o bucket service-photos (chave em portfolio/).
export async function uploadPortfolioPhoto(file: File, ownerId: string): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60) || 'foto'
  const key = `portfolio/${ownerId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
  const delays = [500, 1200, 2500]
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const { data, error } = await insforge.storage
        .from('service-photos')
        .upload(key, file)
      if (!error && data?.url) return data.url
      lastErr = error
      if (!isTransientUploadError(error) || attempt === delays.length) {
        throw error ?? new Error('Upload failed')
      }
    } catch (err) {
      lastErr = err
      if (!isTransientUploadError(err) || attempt === delays.length) throw err
    }
    await new Promise((r) => setTimeout(r, delays[attempt]))
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed')
}

function isTransientUploadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Slow Down|503|500|502|504|network|timeout|fetch failed/i.test(msg)
}

// Remove o arquivo do portfolio do storage. Best-effort: a remocao do item no
// banco e o que importa; um arquivo orfao nao quebra a galeria.
export async function removePortfolioFile(url: string): Promise<void> {
  const key = portfolioStorageKey(url)
  if (!key) return
  try {
    const { error } = await insforge.storage.from('service-photos').remove([key])
    if (error) console.warn('Falha ao remover arquivo do portfolio:', error)
  } catch (err) {
    console.warn('Falha ao remover arquivo do portfolio:', err)
  }
}

// Reduz a foto antes do upload (fotos de celular chegam com varios MB).
export async function compressPortfolioImage(file: File, maxDim = 1280, quality = 0.8): Promise<File> {
  if (typeof document === 'undefined') return file
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('read'))
      reader.readAsDataURL(file)
    })
    const reduced = await downscaleDataUrl(dataUrl, maxDim, quality)
    if (reduced === dataUrl) return file
    const blob = await (await fetch(reduced)).blob()
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export async function uploadServicePhoto(file: File, ownerId: string): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60) || 'photo'
  const key = `${ownerId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`
  const delays = [500, 1200, 2500]
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const { data, error } = await insforge.storage
        .from('service-photos')
        .upload(key, file)
      if (!error && data?.url) return data.url
      lastErr = error
      if (!isTransientUploadError(error) || attempt === delays.length) {
        throw error ?? new Error('Upload failed')
      }
    } catch (err) {
      lastErr = err
      if (!isTransientUploadError(err) || attempt === delays.length) throw err
    }
    await new Promise((r) => setTimeout(r, delays[attempt]))
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed')
}

// Reduz a foto para ~1280px JPEG antes de enviar: foto original do celular
// (MBs em base64) estourava o timeout de 30s no upload + inferência do modelo vision.
async function downscaleDataUrl(dataUrl: string, maxDim = 1024, quality = 0.75, force = false): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode'))
    el.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1 && !force) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

// Garante payload pequeno: reduz iterativamente até caber no teto.
// Sem isso, o POST com a foto original morre no transporte (timeout/fetch-failed)
// e nem chega a aparecer nos logs da function.
async function fitPayload(dataUrl: string, maxBytes = 500 * 1024): Promise<string> {
  let dim = 1024
  let quality = 0.75
  let out = dataUrl
  for (let i = 0; i < 4; i++) {
    out = await downscaleDataUrl(dataUrl, dim, quality, true)
    if (out.length <= maxBytes) return out
    dim = Math.round(dim * 0.7)
    quality = Math.max(0.5, quality - 0.1)
  }
  return out
}

export interface AnalyzeResponse {
  status: 'ready' | 'processing' | 'error'
  analysis: AIAnalysis
  analysisId: string | null
}

export async function analyzeWithAI(imageBase64: string | undefined, category: string, notes: string): Promise<AnalyzeResponse> {
  let payload = imageBase64
  if (payload?.startsWith('data:')) {
    try {
      payload = await fitPayload(payload)
      console.debug('[analyze] payload KB:', Math.round((payload.length / 1024)))
    } catch {
      // mantém o original se o downscale falhar
    }
  }
  const { data, error } = await insforge.functions.invoke('analyze-service', {
    body: { imageBase64: payload, category, notes },
  })

  if (error) throw error
  return data as AnalyzeResponse
}

export async function createPortalSession(
  professionalId: string,
  environment: StripeEnvironment,
): Promise<{ url: string }> {
  const returnUrl = `${window.location.origin}/perfil_pro`
  const { data, error } = await insforge.payments.stripe.createCustomerPortalSession(environment, {
    subject: { type: 'professional', id: professionalId },
    returnUrl,
  })
  if (error) throw error
  if (!data?.customerPortalSession?.url) throw new Error('Erro ao criar sessao do portal')
  return { url: data.customerPortalSession.url }
}

export async function changePlan(professionalId: string, targetPlan: string): Promise<{ subscriptionId: string; status: string }> {
  const { data, error } = await insforge.functions.invoke('change-plan', {
    body: { professionalId, targetPlan },
  })
  if (error) throw error
  return data as { subscriptionId: string; status: string }
}

export async function activateTrial(professionalId: string): Promise<{ plan: string; expires_at: string }> {
  const { data, error } = await insforge.functions.invoke('activate-trial', {
    body: { professionalId },
  })
  if (error) throw error
  return data as { plan: string; expires_at: string }
}

export async function createCheckoutSession(
  professionalId: string,
  plan: string,
  email: string,
  currency: PlanCurrency = 'BRL',
  environment: StripeEnvironment = 'test',
): Promise<{ url: string }> {
  const { data: planPrice, error: priceError } = await insforge.database
    .from('plan_prices')
    .select('plan_id, environment, currency, stripe_price_id, unit_amount')
    .eq('plan_id', plan)
    .eq('environment', environment)
    .eq('currency', currency)
    .maybeSingle()
  if (priceError) throw priceError
  const priceId = (planPrice as PlanPrice | null)?.stripe_price_id
  if (!priceId) throw new Error(`PRICE_NOT_CONFIGURED:${currency}:${environment}`)

  const successUrl = `${window.location.origin}/?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${window.location.origin}/?canceled=true`
  const { data, error } = await insforge.payments.stripe.createCheckoutSession(environment, {
    mode: 'subscription',
    lineItems: [{ priceId, quantity: 1 }],
    successUrl,
    cancelUrl,
    subject: { type: 'professional', id: professionalId },
    customerEmail: email,
    metadata: { professional_id: professionalId, plan },
  })
  if (error) throw error
  if (!data?.checkoutSession?.url) throw new Error('Erro ao criar sessao de checkout')
  return { url: data.checkoutSession.url }
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await insforge.database
    .from('plans')
    .select('*')
    .order('rank', { ascending: true })
  if (error) throw error
  return (data as Plan[]) || []
}

export interface AuthUser {
  id: string
  email: string
  name?: string | null
}

export async function signUpAuth(
  email: string,
  password: string,
  name: string
): Promise<{ user: AuthUser | null; requireEmailVerification: boolean }> {
  const { data, error } = await insforge.auth.signUp({
    email,
    password,
    name,
  })
  if (error) throw error
  const user = data?.user
  const profileName = (user?.profile as { name?: string } | null | undefined)?.name
  return {
    user: user
      ? { id: user.id, email: user.email ?? email, name: profileName ?? name }
      : null,
    requireEmailVerification: Boolean(data?.requireEmailVerification),
  }
}

export async function signInAuth(
  email: string,
  password: string
): Promise<AuthUser> {
  const { data, error } = await insforge.auth.signInWithPassword({ email, password })
  if (error || !data) throw error ?? new Error('Falha no login')
  const profileName = (data.user.profile as { name?: string } | null | undefined)?.name
  return { id: data.user.id, email: data.user.email ?? email, name: profileName ?? null }
}

export async function signOutAuth(): Promise<void> {
  const { error } = await insforge.auth.signOut()
  if (error) throw error
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const hasSessionCookie =
    typeof document !== 'undefined' &&
    document.cookie.split(';').some((c) => c.trim().startsWith('insforge_csrf_token='))
  if (!hasSessionCookie) return null
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error) return null
  if (!data?.user) return null
  const profileName = (data.user.profile as { name?: string } | null | undefined)?.name
  return { id: data.user.id, email: data.user.email ?? '', name: profileName ?? null }
}

export async function getUserByAuthId(authId: string): Promise<User | null> {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle()
  if (error) throw error
  return (data as User) || null
}

export async function createUserRecord(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
  const { data, error } = await insforge.database
    .from('users')
    .insert([{ ...user, id: crypto.randomUUID() }])
    .select()
    .single()
  if (error) throw error
  return data as User
}

export async function updateUserRecord(authId: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await insforge.database
    .from('users')
    .update(updates)
    .eq('auth_id', authId)
    .select()
    .single()
  if (error) throw error
  return data as User
}
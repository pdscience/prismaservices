export interface AIAnalysis {
  summary: string
  description: string
  category: string
  complexity: "Baixa" | "Média" | "Alta"
  estimatedTime: string
  materialsNeeded: string[]
  suggestedMinPrice: number
  suggestedMaxPrice: number
  technicalNotes: string
  recommendedAction: string
}

export interface PortfolioItem {
  url: string
  caption: string
}

export interface Professional {
  id: string
  auth_id?: string | null
  referral_code: string | null
  referred_by: string | null
  name: string
  category: string
  email: string
  phone: string
  rating: number
  reviews_count: number
  avatar: string
  pix_key: string
  bio: string
  coverage_bairros: string[]
  categories: string[]
  portfolio_items: PortfolioItem[]
  /** @deprecated usar portfolio_items (mantido apenas para leitura de dados antigos). */
  portfolio_photos?: string[]
  cidade: string
  uf: string
  country_code: string
  state: string
  municipality: string
  phone_country_code: string
  plan: 'gratuito' | 'bronze' | 'prata' | 'ouro'
  plan_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  billing_currency: 'BRL' | 'USD'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan_expires_at: string | null
  trial_used: boolean
  alerts_enabled?: boolean
  requests_this_month: number
  requests_reset_at: string | null
}

export interface Referral {
  id: string
  referrer_pro_id: string
  referred_pro_id: string
  status: 'cadastrado' | 'premiado'
  created_at?: string
}

export interface ServiceRequest {
  id: string
  created_at: string
  client_id?: string | null
  client_name: string
  client_phone: string
  client_address: string
  category: string
  photo_url: string
  notes: string
  ai_analysis: AIAnalysis | null
  status: "Pendente" | "Visita Agendada" | "Em Execução" | "Concluído" | "Cancelado"
  professional_id: string | null
  broadcast: boolean
  agendamento: {
    data: string
    hora: string
    observacao?: string
  } | null
  final_price: number | null
  receipt_issued: boolean
  rating: {
    stars: number
    comment: string
    date: string
  } | null
}

export interface Plan {
  id: string
  display_name: string
  rank: number
  monthly_price: number
  monthly_price_usd: number
  stripe_price_id_usd: string | null
  request_limit: number | null
  max_photos: number
  max_categories: number | null
  receives_broadcasts: boolean
  show_whatsapp_to_client: boolean
  client_visible: boolean
  badge_label: string | null
  badge_bg: string | null
  badge_text: string | null
  badge_border: string | null
}

export interface User {
  id: string
  auth_id: string
  role: 'client' | 'pro'
  name: string
  email: string
  birth_date: string
  address: string
  bairro: string
  cidade: string
  uf: string
  country_code: string
  state: string
  municipality: string
  phone: string
  phone_country_code: string
  category: string
  created_at?: string
  updated_at?: string
}
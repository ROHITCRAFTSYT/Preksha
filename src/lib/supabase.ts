import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser / client-side client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (uses service role key, bypasses RLS) — only import in API routes
export function createServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// ─── Service DB types ──────────────────────────────────────────────────────────

export type DbServiceStatus = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface DbService {
  id: string;
  name: string;
  category: string;
  status: DbServiceStatus;
  latency_ms: number;
  uptime_percent: number;
  region: string;
  description: string;
  fallbacks: { label: string; url: string; description: string }[];
  chaos_active: boolean;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbIncident {
  id: string;
  service_id: string;
  service_name: string;
  type: 'outage' | 'degraded' | 'restored' | 'chaos';
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface DbHealthCheck {
  id: string;
  service_id: string;
  status: DbServiceStatus;
  latency_ms: number;
  checked_at: string;
  error: string | null;
}

// ─── Auth / User DB types ──────────────────────────────────────────────────────

export interface DbPlan {
  id: string;           // 'free' | 'pro' | 'enterprise'
  label: string;
  price_monthly: number;
  description: string;
  features: string[];
  cta: string;
  is_popular: boolean;
  created_at: string;
}

export interface DbUser {
  id: string;           // uuid — matches auth.users.id
  email: string;
  full_name: string;
  plan_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  ends_at: string | null;
  created_at: string;
}

// ─── Auth helpers (client-side) ───────────────────────────────────────────────

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// Google OAuth — redirects browser to Google, then to /api/auth/callback
export async function signInWithGoogle() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

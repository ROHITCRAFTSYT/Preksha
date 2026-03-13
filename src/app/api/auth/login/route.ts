import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Simple in-process rate limiter (resets on cold start) ─────────────────────
// For production, replace with Redis / Upstash to survive multiple instances.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT    = 10;          // max attempts per window
const RATE_WINDOW   = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// POST /api/auth/login
// Body: { email, password }
export async function POST(req: NextRequest) {
  // Rate-limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json() as { email?: unknown; password?: unknown };

    // Server-side input validation (defence-in-depth on top of client validation)
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const email    = body.email.trim().toLowerCase().slice(0, 254);
    const password = body.password.slice(0, 128);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      // Generic message — don't reveal whether the email exists (user enumeration)
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Fetch public profile (non-sensitive data only)
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, full_name, plan_id')
      .eq('id', data.user.id)
      .single();

    const isProd = process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      message: 'Logged in successfully',
      user: profile ?? { id: data.user.id, email, full_name: '', plan_id: 'free' },
    });

    // Access token — 7 days. Middleware silently refreshes via refresh token.
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,   // 7 days
      path:     '/',
    });

    // Refresh token — 30 days.
    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30,  // 30 days
      path:     '/',
    });

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

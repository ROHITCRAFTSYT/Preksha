import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/auth/callback
// Supabase redirects here after Google OAuth with ?code=...
// We exchange the code for a session, set httpOnly cookies, upsert the user
// profile in our public.users table, then redirect to the dashboard.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const next  = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  // Surface OAuth errors back to the login page
  if (error) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', errorDesc ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'Missing authorisation code from provider.');
    return NextResponse.redirect(loginUrl);
  }

  // Exchange the one-time code for a Supabase session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);

  if (exchErr || !data.session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'Google sign-in failed. Please try again.');
    return NextResponse.redirect(loginUrl);
  }

  const { session, user } = data;

  // ── Upsert the user profile into public.users (service role bypasses RLS) ──
  // Supabase Auth stores credentials (bcrypt-hashed for passwords, encrypted
  // provider tokens for OAuth) in the internal auth.users table.
  // We keep only non-sensitive profile data in public.users.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name    as string | undefined) ??
    '';

  await db.from('users').upsert(
    {
      id:         user.id,
      email:      user.email ?? '',
      full_name:  fullName,
      plan_id:    'free',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  // ── Set httpOnly session cookies (same shape as email/password login) ───────
  const isProd = process.env.NODE_ENV === 'production';

  // Validate redirect target to prevent open-redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const response = NextResponse.redirect(new URL(safeNext, req.url));

  response.cookies.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,   // 7 days
    path:     '/',
  });

  response.cookies.set('sb-refresh-token', session.refresh_token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,  // 30 days
    path:     '/',
  });

  return response;
}

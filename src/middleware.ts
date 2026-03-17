import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PROTECTED: string[] = []; // dashboard is public for demo

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  
  // ── 1. ACTIVE THREAT MITIGATION (DDoS & IP Blocking) ──────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // ── 1b. INLINE ANOMALY DETECTION (SQLi / XSS basic) ────────────────────────
  const suspiciousPattern = /(union\s+select|script>|<svg|eval\()/i;
  
  try {
    if (suspiciousPattern.test(decodeURIComponent(request.url))) {
      // Log event asynchronously
      event.waitUntil(
        fetch(new URL('/api/security-events', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'api_abuse',
            ip_address: ip,
            user_id: 'anonymous',
            details: { reason: 'suspicious_payload', url: request.url, mitigated: true }
          })
        }).catch(err => console.error('[Middleware Anomaly] Failed to log:', err))
      );
      
      return new NextResponse(
        JSON.stringify({ error: 'Access Denied: Malicious payload detected.' }), 
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (e) {
    // decodeURIComponent might throw if URI is malformed, block it as well
    return new NextResponse(
      JSON.stringify({ error: 'Bad Request: Malformed URI.' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Create an edge-compatible client. We use anon key if service role is missing.
  const supabaseEdge = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Check if this IP is actively blocked
  // (In production, this would use Redis/Upstash for sub-ms latency. Direct DB query for demo)
  const { data: activeBlocks } = await supabaseEdge
    .from('active_defenses')
    .select('target_value')
    .eq('target_type', 'ip')
    .eq('action', 'block')
    .eq('status', 'active');

  const isBlocked = activeBlocks?.some((defense) => defense.target_value === ip);
  
  if (isBlocked) {
    return new NextResponse(
      JSON.stringify({ error: 'Access Denied: Malicious activity detected. Connection dropped.' }), 
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  const accessToken  = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;

  // ── Not a protected route — still try to refresh silently ─────────────────
  if (!isProtected) return NextResponse.next();

  // ── No tokens at all → redirect to login ──────────────────────────────────
  if (!accessToken && !refreshToken) {
    return redirectToLogin(request, pathname);
  }

  // ── Try to validate / refresh via Supabase ────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // If we have both tokens, restore the session so Supabase can refresh it
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  // Validate the current user (this also auto-refreshes if token is expired)
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    // Access token invalid — try refreshing with refresh token
    if (refreshToken) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshErr || !refreshed.session) {
        // Refresh token is also dead → kick to login
        return redirectToLogin(request, pathname);
      }

      // Refresh succeeded — update cookies and continue
      const response = NextResponse.next();
      setCookies(response, refreshed.session.access_token, refreshed.session.refresh_token);
      return response;
    }

    return redirectToLogin(request, pathname);
  }

  // ── Valid user — pass through. Also refresh cookies to extend lifetime ─────
  const response = NextResponse.next();

  // Get fresh session to check if tokens were silently refreshed
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    setCookies(
      response,
      sessionData.session.access_token,
      sessionData.session.refresh_token
    );
  }

  return response;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  const response = NextResponse.redirect(loginUrl);
  // Clear stale cookies
  response.cookies.set('sb-access-token',  '', { maxAge: 0, path: '/' });
  response.cookies.set('sb-refresh-token', '', { maxAge: 0, path: '/' });
  return response;
}

function setCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set('sb-access-token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,  // 7 days (Supabase refreshes keep extending this)
    path: '/',
  });
  response.cookies.set('sb-refresh-token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

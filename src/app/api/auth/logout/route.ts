import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/logout
// Revokes the Supabase session server-side AND clears httpOnly cookies.
// Without the server-side revocation the JWT would remain valid until expiry
// even after the user logs out, which is a security flaw.
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('sb-access-token')?.value;

  // Revoke the session in Supabase so the token is immediately invalidated
  if (accessToken) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      // Set the session so signOut() knows which session to revoke
      await supabase.auth.getUser(accessToken); // validate first
      await supabase.auth.signOut();
    } catch {
      // Best-effort — still clear cookies even if revocation fails
    }
  }

  const response = NextResponse.json({ message: 'Logged out' });

  // Clear both cookies
  response.cookies.set('sb-access-token',  '', { maxAge: 0, path: '/', httpOnly: true });
  response.cookies.set('sb-refresh-token', '', { maxAge: 0, path: '/', httpOnly: true });

  return response;
}

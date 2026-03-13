import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Validates the sb-access-token cookie from an API route request.
 * Returns the user ID if valid, or null if unauthorized.
 */
export async function requireAuth(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.cookies.get('sb-access-token')?.value;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return { userId: user.id };
}

/** Returns a 401 JSON response. */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Validates that the request is either from an authenticated user
 * or from Vercel's cron scheduler (via CRON_SECRET header).
 *
 * Security fix: CRON_SECRET is REQUIRED when present. If the env var is
 * missing (undefined), cron access is denied rather than accidentally allowed.
 */
export async function requireAuthOrCron(req: NextRequest): Promise<boolean> {
  const user = await requireAuth(req);
  if (user) return true;

  const cronSecret = process.env.CRON_SECRET;
  // Only allow cron access when CRON_SECRET is explicitly configured AND matches
  if (cronSecret && cronSecret.length > 0) {
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

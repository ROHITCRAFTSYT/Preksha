import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Download burst tracker (in-memory, per IP) ────────────────────────────────
const downloadTracker: Record<string, { count: number; windowStart: number }> = {};

function calcRiskScore(
  eventType: string,
  ipAddress: string,
  details: Record<string, unknown>,
): number {
  let score = 0;

  if (eventType === 'document_download') {
    const now = Date.now();
    const tracker = downloadTracker[ipAddress] ?? { count: 0, windowStart: now };
    if (now - tracker.windowStart > 60_000) {
      tracker.count = 1;
      tracker.windowStart = now;
    } else {
      tracker.count += 1;
    }
    downloadTracker[ipAddress] = tracker;
    // >10 downloads in 60 seconds → HIGH risk
    if (tracker.count > 10) score = 90;
    else if (tracker.count > 5) score = 55;
    else score = 10;
  }

  if (eventType === 'brute_force_login') score = 85;
  if (eventType === 'token_hijack_attempt') score = 95;
  if (eventType === 'api_abuse') score = 70;
  if (eventType === 'suspicious_login') {
    score = 50;
    if (details?.new_device) score += 20;
    if (details?.unusual_location) score += 15;
  }

  return Math.min(score, 100);
}

// ── POST — log a security event ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, event_type, ip_address, device_id, details } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    const ip = ip_address ?? req.headers.get('x-forwarded-for') ?? '0.0.0.0';
    const risk_score = calcRiskScore(event_type, ip, details ?? {});

    const { data, error } = await supabase
      .from('security_events')
      .insert({
        user_id: user_id ?? 'anonymous',
        event_type,
        ip_address: ip,
        device_id: device_id ?? null,
        risk_score,
        details: details ?? {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ event: data, risk_score });
  } catch (err) {
    console.error('[security-events POST]', err);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}

// ── GET — return latest 50 security events ────────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    console.error('[security-events GET]', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// ── DELETE — clear all security events ────────────────────────────────────────
export async function DELETE() {
  try {
    const { error } = await supabase
      .from('security_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

    if (error) throw error;

    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error('[security-events DELETE]', err);
    return NextResponse.json({ error: 'Failed to clear events' }, { status: 500 });
  }
}

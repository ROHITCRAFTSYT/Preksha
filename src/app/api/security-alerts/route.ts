import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// MITRE mapping for auto-enrichment
const MITRE_MAP: Record<string, { tactic: string; technique: string; severity: string }> = {
  brute_force_login:    { tactic: 'TA0006 Credential Access', technique: 'T1110 Brute Force',           severity: 'high' },
  document_download:    { tactic: 'TA0009 Collection',        technique: 'T1005 Data from Local System', severity: 'medium' },
  token_hijack_attempt: { tactic: 'TA0006 Credential Access', technique: 'T1528 Steal App Access Token', severity: 'critical' },
  api_abuse:            { tactic: 'TA0040 Impact',            technique: 'T1499 Endpoint DoS',           severity: 'medium' },
  suspicious_login:     { tactic: 'TA0001 Initial Access',    technique: 'T1078 Valid Accounts',         severity: 'medium' },
};

function severityFromRisk(score: number, base: string): string {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return base;
  return 'low';
}

// GET — list alerts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    let query = supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ alerts: data ?? [] });
  } catch (err) {
    console.error('[security-alerts GET]', err);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// POST — create alert from event (auto-enriches with MITRE)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, event_type, risk_score, ip_address, details } = body;

    const mitre = MITRE_MAP[event_type] ?? { tactic: 'Unknown', technique: 'Unknown', severity: 'medium' };
    const severity = severityFromRisk(risk_score ?? 50, mitre.severity);

    const title = `${EVENT_TITLES[event_type] ?? event_type} — ${ip_address ?? 'unknown IP'}`;
    const description = buildDescription(event_type, details, risk_score);

    // ── Phase 3: Automated Remediation & Audit Logging ───────────────────
    let autoBlocked = false;
    let autoBlockDescription = '';
    
    // Automatically block the IP for critical severity alerts
    if (severity === 'critical' && ip_address) {
      const { error: blockErr } = await supabase
        .from('active_defenses')
        .insert({
          target_type: 'ip',
          target_value: ip_address,
          action: 'block',
          status: 'active',
        });
        
      if (!blockErr) {
        autoBlocked = true;
        autoBlockDescription = '[AUTO-REMEDIATED] IP address blocked by active defense mechanism.';
      }
    }

    const finalDescription = autoBlockDescription ? `${description} ${autoBlockDescription}` : description;

    const { data: alert, error } = await supabase
      .from('security_alerts')
      .insert({
        event_id: event_id ?? null,
        alert_type: event_type,
        severity,
        title,
        description: finalDescription,
        mitre_tactic: mitre.tactic,
        mitre_technique: mitre.technique,
        status: autoBlocked ? 'acknowledged' : 'new',
      })
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json({ alert });
  } catch (err) {
    console.error('[security-alerts POST]', err);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

// PATCH — update alert status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, assigned_to } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    const { data, error } = await supabase
      .from('security_alerts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ alert: data });
  } catch (err) {
    console.error('[security-alerts PATCH]', err);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

// DELETE — clear all alerts
export async function DELETE() {
  try {
    const { error } = await supabase
      .from('security_alerts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error('[security-alerts DELETE]', err);
    return NextResponse.json({ error: 'Failed to clear alerts' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_TITLES: Record<string, string> = {
  brute_force_login: 'Brute Force Login Detected',
  document_download: 'Abnormal Document Download',
  token_hijack_attempt: 'Token Hijack Attempt',
  api_abuse: 'API Abuse Detected',
  suspicious_login: 'Suspicious Login Activity',
};

function buildDescription(eventType: string, details: Record<string, unknown>, riskScore: number): string {
  const parts: string[] = [`Risk score: ${riskScore}/100.`];
  if (eventType === 'brute_force_login' && details?.attempts) {
    parts.push(`${details.attempts} login attempts detected.`);
    if (details.target_email) parts.push(`Target: ${details.target_email}`);
  }
  if (eventType === 'document_download' && details?.count_in_window) {
    parts.push(`${details.count_in_window} documents downloaded in ${details.window_seconds ?? 60}s.`);
  }
  if (eventType === 'token_hijack_attempt') {
    parts.push('Forged OAuth token detected.');
    if (details?.origin) parts.push(`Origin: ${details.origin}`);
  }
  if (eventType === 'api_abuse' && details?.requests_per_min) {
    parts.push(`${details.requests_per_min} requests/min on ${details.endpoint ?? 'unknown endpoint'}.`);
  }
  if (eventType === 'suspicious_login') {
    if (details?.country) parts.push(`Login from ${details.country}.`);
    if (details?.new_device) parts.push('New device detected.');
  }
  return parts.join(' ');
}

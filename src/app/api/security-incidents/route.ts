import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET — list incidents
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('security_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ incidents: data ?? [] });
  } catch (err) {
    console.error('[security-incidents GET]', err);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

// POST — create incident from alert IDs
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, severity, alert_ids, owner, playbook_id } = body;

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const timeline = [{
      status: 'open',
      timestamp: new Date().toISOString(),
      note: 'Incident created',
    }];

    const { data, error } = await supabase
      .from('security_incidents')
      .insert({
        title,
        description: description ?? '',
        severity: severity ?? 'medium',
        status: 'open',
        alert_ids: alert_ids ?? [],
        owner: owner ?? null,
        timeline,
        playbook_id: playbook_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Mark linked alerts as investigating
    if (Array.isArray(alert_ids) && alert_ids.length > 0) {
      await supabase
        .from('security_alerts')
        .update({ status: 'investigating' })
        .in('id', alert_ids);
    }

    return NextResponse.json({ incident: data });
  } catch (err) {
    console.error('[security-incidents POST]', err);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}

// PATCH — transition status, add timeline entries
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, note, owner } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Fetch current incident for timeline append
    const { data: current, error: fetchErr } = await supabase
      .from('security_incidents')
      .select('timeline, alert_ids')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    const timeline = [...((current?.timeline as unknown[]) ?? [])];
    if (status) {
      timeline.push({
        status,
        timestamp: new Date().toISOString(),
        note: note ?? `Status changed to ${status}`,
      });
    }

    const updates: Record<string, unknown> = { timeline };
    if (status) updates.status = status;
    if (owner !== undefined) updates.owner = owner;
    if (status === 'closed') updates.closed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('security_incidents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // When closed or mitigated, resolve linked alerts
    if (status === 'closed' || status === 'mitigated') {
      const alertIds = (current?.alert_ids as string[]) ?? [];
      if (alertIds.length > 0) {
        await supabase
          .from('security_alerts')
          .update({ status: 'resolved' })
          .in('id', alertIds);
      }
    }

    return NextResponse.json({ incident: data });
  } catch (err) {
    console.error('[security-incidents PATCH]', err);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const incident_id = searchParams.get('incident_id');

    let query = supabase
      .from('security_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (incident_id) {
      query = query.eq('incident_id', incident_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ reports: data ?? [] });
  } catch (err) {
    console.error('[security-reports GET]', err);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { incident_id, title, content } = body;

    if (!incident_id || !title || !content) {
      return NextResponse.json({ error: 'incident_id, title, and content are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_reports')
      .insert({
        incident_id,
        title,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (err) {
    console.error('[security-reports POST]', err);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('active_defenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ defenses: data ?? [] });
  } catch (err) {
    console.error('[security-defenses GET]', err);
    return NextResponse.json({ error: 'Failed to fetch active defenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target_type, target_value, action } = body;

    if (!target_type || !target_value || !action) {
      return NextResponse.json({ error: 'target_type, target_value, and action are required' }, { status: 400 });
    }

    // Check if defense already exists and is active
    const { data: existing } = await supabase
      .from('active_defenses')
      .select('id')
      .eq('target_type', target_type)
      .eq('target_value', target_value)
      .eq('action', action)
      .eq('status', 'active')
      .single();

    if (existing) {
      return NextResponse.json({ defense: existing, isNew: false });
    }

    const { data, error } = await supabase
      .from('active_defenses')
      .insert({
        target_type,
        target_value,
        action,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ defense: data, isNew: true });
  } catch (err) {
    console.error('[security-defenses POST]', err);
    return NextResponse.json({ error: 'Failed to create active defense' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('active_defenses')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ defense: data });
  } catch (err) {
    console.error('[security-defenses PATCH]', err);
    return NextResponse.json({ error: 'Failed to update active defense' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('active_defenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error('[security-defenses DELETE]', err);
    return NextResponse.json({ error: 'Failed to clear active defense' }, { status: 500 });
  }
}

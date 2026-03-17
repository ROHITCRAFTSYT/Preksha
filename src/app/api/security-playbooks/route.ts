import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FALLBACK_PLAYBOOKS } from '@/lib/playbooks';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET — return playbook templates
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('remediation_playbooks')
      .select('*')
      .order('attack_type');

    if (error) throw error;

    // If DB has no playbooks yet, return hardcoded defaults
    const playbooks = (data && data.length > 0) ? data : FALLBACK_PLAYBOOKS;

    return NextResponse.json({ playbooks });
  } catch {
    // If table doesn't exist yet, return hardcoded defaults
    return NextResponse.json({ playbooks: FALLBACK_PLAYBOOKS });
  }
}

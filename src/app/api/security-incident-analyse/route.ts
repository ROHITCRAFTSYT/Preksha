import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { incident_id } = await req.json();
    if (!incident_id) {
      return NextResponse.json({ error: 'incident_id is required' }, { status: 400 });
    }

    // 1. Fetch the incident
    const { data: incident, error: incErr } = await supabase
      .from('security_incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incErr || !incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // 2. Fetch associated alerts
    const alertIds = incident.alert_ids as string[];
    let alerts: any[] = [];
    if (alertIds && alertIds.length > 0) {
      const { data: alertsData } = await supabase
        .from('security_alerts')
        .select('*')
        .in('id', alertIds);
      alerts = alertsData ?? [];
    }

    // 3. Format context for Groq
    const prompt = `
You are an expert Security Operations Center (SOC) Analyst.
Analyze the following security incident and its associated alerts to generate a concise, executive-level Post-Incident Summary.

INCIDENT DETAILS:
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Status: ${incident.status}
Timeline: ${JSON.stringify(incident.timeline)}

ASSOCIATED ALERTS:
${alerts.map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description} (MITRE: ${a.mitre_tactic} / ${a.mitre_technique})`).join('\n')}

Based on the above, provide:
1. Attack Chain Summary: What happened from start to finish?
2. Attacker Motivation/Objective: What were they trying to achieve based on the MITRE tactics?
3. Recommended Next Steps: What immediate actions should be taken to secure the system?

Keep the response professional, concise, and structured with markdown headings. Do not include introductory conversational text.
`;

    // 4. Call Groq API
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!groqRes.ok) throw new Error('Groq API error');

    const groqData = await groqRes.json();
    const analysis = groqData.choices[0]?.message?.content || 'Analysis failed to generate.';

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('[security-incident-analyse POST]', error);
    return NextResponse.json(
      { error: 'Failed to analyze incident', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}

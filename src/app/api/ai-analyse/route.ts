import { NextRequest, NextResponse } from 'next/server';

export interface AIAnalysis {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  rootCause: string;
  impact: string;
  recommendations: string[];
  estimatedResolution: string;
  citizenMessage: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your-groq-api-key-here') {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 });
  }

  try {
    const { service, incidents, latencyHistory } = await req.json();

    const latencyTrend = (latencyHistory as number[]).slice(-20).join(', ');
    const incidentList = (incidents as { message: string; created_at: string }[])
      .slice(0, 5)
      .map((i) => `• ${i.message} (${new Date(i.created_at).toLocaleString('en-IN')})`)
      .join('\n') || 'No recent incidents';

    const fallbackList = (service.fallbacks as { label: string; description: string }[])
      .map((f) => `• ${f.label}: ${f.description}`)
      .join('\n') || 'No fallbacks configured';

    const prompt = `You are an SRE (Site Reliability Engineer) analysing an incident for ResilienceOS — India's government digital services resilience platform.

Analyse this service incident and return ONLY a JSON object. No explanation, no markdown, just raw JSON.

SERVICE: ${service.name} (${service.category} · ${service.region})
STATUS: ${(service.status as string).toUpperCase()}
LATENCY: ${service.latency === 0 ? 'UNREACHABLE (0ms / timeout)' : `${Math.round(service.latency)}ms`}
UPTIME (24h): ${Number(service.uptime).toFixed(1)}%

LATENCY TREND — last 20 readings in ms (oldest → newest):
${latencyTrend}

RECENT INCIDENTS (last 5):
${incidentList}

AVAILABLE FALLBACK ROUTES:
${fallbackList}

Respond with exactly this JSON structure:
{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM",
  "rootCause": "one sentence hypothesis based on the data",
  "impact": "who is affected and estimated citizen impact scale",
  "recommendations": ["action 1", "action 2", "action 3"],
  "estimatedResolution": "e.g. 15-30 minutes or 2-4 hours",
  "citizenMessage": "plain-language message for affected citizens (1-2 sentences, no jargon)"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Groq API error: ${errText}` }, { status: 500 });
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 });
    }

    const analysis: AIAnalysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { event_type, risk_score, ip_address, details } = await req.json();

    const prompt = `You are a cybersecurity analyst for DigiLocker — India's national digital document vault used by 200M+ citizens.

A security event was detected:
- Event Type: ${event_type}
- Risk Score: ${risk_score}/100
- IP Address: ${ip_address}
- Details: ${JSON.stringify(details, null, 2)}

Respond in this EXACT format (no markdown headers, just the sections):

ATTACK TYPE:
[One-line classification of the attack]

SEVERITY:
[CRITICAL / HIGH / MEDIUM / LOW] — [one sentence why]

WHAT'S HAPPENING:
[2-3 sentences explaining what the attacker is likely doing and why]

IMMEDIATE MITIGATION:
1. [Action]
2. [Action]
3. [Action]

LONG-TERM HARDENING:
[2-3 sentences on structural fixes to prevent recurrence]`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
    });

    const report = completion.choices[0]?.message?.content ?? 'Analysis unavailable.';
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[security-analyse POST]', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}

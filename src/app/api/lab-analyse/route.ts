import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    const prompt = `You are an elite AI cybersecurity module for ResilienceOS. 
Analyze the following security event and return a JSON object with exactly these three keys:
- "attack_type": a brief classification (e.g., "SQL Injection", "DDoS Spike")
- "severity": "CRITICAL", "HIGH", "MEDIUM", or "LOW"
- "recommended_action": A short, actionable step to mitigate the threat.

Event Details: 
${JSON.stringify(event, null, 2)}

Provide ONLY the raw JSON output. No markdown formatting, no backticks, no explanatory text.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
    });

    let rawOutput = completion.choices[0]?.message?.content?.trim() || '{}';
    // Clean up if the LLM still returns markdown somehow
    if (rawOutput.startsWith('\`\`\`json')) {
      rawOutput = rawOutput.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
    } else if (rawOutput.startsWith('\`\`\`')) {
      rawOutput = rawOutput.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
    }

    const report = JSON.parse(rawOutput);

    return NextResponse.json(report);
  } catch (err) {
    console.error('[lab-analyse POST]', err);
    return NextResponse.json(
      { error: 'AI analysis failed', attack_type: 'Unknown', severity: 'MEDIUM', recommended_action: 'Investigate manually' },
      { status: 500 }
    );
  }
}

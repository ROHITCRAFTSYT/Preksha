import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { FALLBACK_PLAYBOOKS } from '@/lib/playbooks';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    const matchingPlaybook = FALLBACK_PLAYBOOKS.find(pb => pb.attack_type === event.event_type);
    const playbookInjection = matchingPlaybook ? `
    We have an internal security playbook for this event type: "${matchingPlaybook.title}".
    Playbook Steps:
    ${matchingPlaybook.steps.map(s => `- ${s.title}: ${s.description}`).join('\n')}
    
    Incorporate these specific playbook steps into your response.
    ` : 'Formulate a custom step-by-step response plan as we do not have a predefined playbook for this event type.';

    const prompt = `You are an elite AI cybersecurity module for ResilienceOS. 
Analyze the following security event and return a JSON object with exactly these three keys:
- "attack_type": a brief classification (e.g., "SQL Injection", "DDoS Spike")
- "severity": "CRITICAL", "HIGH", "MEDIUM", or "LOW"
- "playbook_steps": An array of objects, each containing a {"title": "string", "description": "string"}. Provide 3 to 5 clear, actionable steps to stop the attack or mitigate the threat.

${playbookInjection}

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
      { 
        error: 'AI analysis failed', 
        attack_type: 'Unknown', 
        severity: 'MEDIUM', 
        playbook_steps: [{ title: 'Manual Investigation', description: 'Automated analysis failed. Investigate the event manually in the logs.' }]
      },
      { status: 500 }
    );
  }
}

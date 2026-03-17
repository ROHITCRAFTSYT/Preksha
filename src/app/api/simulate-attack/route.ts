import { NextResponse } from 'next/server';

const ATTACK_SCENARIOS = [
  {
    event_type: 'sql_injection',
    endpoint: '/api/users/login',
    payload: "' OR 1=1 --",
    ip_address: '192.168.1.100',
  },
  {
    event_type: 'sql_injection',
    endpoint: '/api/documents/search',
    payload: "union select * from users",
    ip_address: '10.0.0.50',
  },
  {
    event_type: 'ddos',
    endpoint: '/api/public/status',
    payload: "{ burst: 150 }",
    ip_address: '203.0.113.45',
  },
  {
    event_type: 'brute_force_login',
    endpoint: '/api/auth/verify',
    payload: "{ attempts: 12 }",
    ip_address: '198.51.100.12',
  },
  {
    event_type: 'token_hijack_attempt',
    endpoint: '/api/vault/access',
    payload: "{ invalid_signature: true }",
    ip_address: '45.33.22.11',
  }
];

export async function POST() {
  try {
    const scenario = ATTACK_SCENARIOS[Math.floor(Math.random() * ATTACK_SCENARIOS.length)];

    // For DDoS and Brute Force, we normally rely on the tracker firing multiple times. 
    // To simulate it instantly hitting the threshold for the dashboard UI, 
    // we can either fire it 50 times, or rely on the endpoints to pick up a burst.
    // For simplicity of simulation, we'll blast the endpoint a random number of times based on the attack type.
    
    const count = scenario.event_type === 'ddos' ? 55 : scenario.event_type === 'brute_force_login' ? 6 : 1;

    const promises = Array.from({ length: count }).map(() =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/security-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: scenario.event_type,
          ip_address: scenario.ip_address,
          details: {
            endpoint: scenario.endpoint,
            payload: scenario.payload,
            simulated: true,
          },
        }),
      })
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true, simulated: scenario.event_type, count });
  } catch (error) {
    console.error('[simulate-attack POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to simulate attack' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FAKE_IPS = [
  '185.220.101.47', '45.142.212.100', '103.21.244.0',
  '162.158.62.14',  '198.51.100.42',  '91.108.4.0',
];

const FAKE_DEVICES = ['dev_mobile_IN', 'dev_unknown_CN', 'dev_tablet_RU', 'dev_pc_US', 'dev_bot_XX'];
const FAKE_USERS   = ['uid_anon_1', 'uid_anon_2', 'digilocker_user_8821', 'uid_unknown'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Simulated attack scenario definitions
const ATTACK_SCENARIOS = [
  {
    event_type: 'document_download',
    weight: 30,
    detailsFn: () => ({
      document_type: randomItem(['aadhaar', 'pan_card', 'driving_license', 'degree_cert']),
      count_in_window: Math.floor(Math.random() * 18) + 8,
      window_seconds: 60,
    }),
  },
  {
    event_type: 'brute_force_login',
    weight: 25,
    detailsFn: () => ({
      attempts: Math.floor(Math.random() * 40) + 10,
      target_email: `user${Math.floor(Math.random() * 9000) + 1000}@gov.in`,
      last_attempt: new Date().toISOString(),
    }),
  },
  {
    event_type: 'token_hijack_attempt',
    weight: 20,
    detailsFn: () => ({
      token_type: 'DigiLocker OAuth Bearer',
      origin: randomItem(['185.220.101.47', '91.108.4.0', 'unknown']),
      forged_signature: true,
    }),
  },
  {
    event_type: 'api_abuse',
    weight: 15,
    detailsFn: () => ({
      endpoint: randomItem(['/api/documents', '/api/user/profile', '/api/share']),
      requests_per_min: Math.floor(Math.random() * 200) + 80,
      user_agent: 'python-requests/2.28.0',
    }),
  },
  {
    event_type: 'suspicious_login',
    weight: 10,
    detailsFn: () => ({
      new_device: Math.random() > 0.4,
      unusual_location: Math.random() > 0.5,
      country: randomItem(['CN', 'RU', 'IR', 'KP', 'US']),
      login_time: 'off-hours',
    }),
  },
];

function pickScenario() {
  const total = ATTACK_SCENARIOS.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const s of ATTACK_SCENARIOS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return ATTACK_SCENARIOS[0];
}

function riskFor(eventType: string, details: Record<string, unknown>): number {
  if (eventType === 'token_hijack_attempt') return 90 + Math.floor(Math.random() * 10);
  if (eventType === 'brute_force_login') return 80 + Math.floor(Math.random() * 15);
  if (eventType === 'api_abuse') return 65 + Math.floor(Math.random() * 20);
  if (eventType === 'document_download') {
    const count = (details.count_in_window as number) ?? 8;
    return count > 12 ? 85 + Math.floor(Math.random() * 10) : 55 + Math.floor(Math.random() * 20);
  }
  if (eventType === 'suspicious_login') {
    let score = 45;
    if (details.new_device) score += 20;
    if (details.unusual_location) score += 15;
    return score;
  }
  return 30;
}

export async function POST() {
  try {
    // Generate a burst of 3–6 events for dramatic demo effect
    const count = Math.floor(Math.random() * 4) + 3;
    const events = Array.from({ length: count }, () => {
      const scenario = pickScenario();
      const details  = scenario.detailsFn();
      return {
        user_id:    randomItem(FAKE_USERS),
        event_type: scenario.event_type,
        ip_address: randomItem(FAKE_IPS),
        device_id:  randomItem(FAKE_DEVICES),
        risk_score: riskFor(scenario.event_type, details as Record<string, unknown>),
        details,
      };
    });

    const { data, error } = await supabase
      .from('security_events')
      .insert(events)
      .select();

    if (error) throw error;

    return NextResponse.json({ inserted: data?.length ?? 0, events: data });
  } catch (err) {
    console.error('[security-simulate POST]', err);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}

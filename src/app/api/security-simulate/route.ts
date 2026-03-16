import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FAKE_IPS = [
  '185.220.101.47', '45.142.212.100', '103.21.244.0',
  '162.158.62.14',  '198.51.100.42',  '91.108.4.0',
  '77.88.55.60',    '5.188.210.227',  '171.25.193.9',
];

const FAKE_DEVICES = ['dev_mobile_IN', 'dev_unknown_CN', 'dev_tablet_RU', 'dev_pc_US', 'dev_bot_XX', 'dev_iot_KR'];
const FAKE_USERS   = ['uid_anon_1', 'uid_anon_2', 'digilocker_user_8821', 'uid_unknown', 'uid_scraper_bot'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Simulated attack scenario definitions
const ATTACK_SCENARIOS = [
  {
    event_type: 'document_download',
    weight: 30,
    detailsFn: () => ({
      document_type: randomItem(['aadhaar', 'pan_card', 'driving_license', 'degree_cert', 'voter_id']),
      count_in_window: Math.floor(Math.random() * 18) + 8,
      window_seconds: 60,
      exfiltration_method: randomItem(['bulk_api', 'scraping', 'automated_download']),
    }),
  },
  {
    event_type: 'brute_force_login',
    weight: 25,
    detailsFn: () => ({
      attempts: Math.floor(Math.random() * 40) + 10,
      target_email: `user${Math.floor(Math.random() * 9000) + 1000}@gov.in`,
      last_attempt: new Date().toISOString(),
      proxy_chain: Math.random() > 0.5 ? randomItem(['TOR', 'residential_proxy', 'datacenter_vpn']) : null,
    }),
  },
  {
    event_type: 'token_hijack_attempt',
    weight: 20,
    detailsFn: () => ({
      token_type: 'DigiLocker OAuth Bearer',
      origin: randomItem(['185.220.101.47', '91.108.4.0', 'unknown', '5.188.210.227']),
      forged_signature: true,
      session_age_minutes: Math.floor(Math.random() * 120),
    }),
  },
  {
    event_type: 'api_abuse',
    weight: 15,
    detailsFn: () => ({
      endpoint: randomItem(['/api/documents', '/api/user/profile', '/api/share', '/api/certificates/verify']),
      requests_per_min: Math.floor(Math.random() * 200) + 80,
      user_agent: randomItem(['python-requests/2.28.0', 'curl/7.80.0', 'Go-http-client/1.1', 'Scrapy/2.7']),
      payload_size_kb: Math.floor(Math.random() * 500) + 10,
    }),
  },
  {
    event_type: 'suspicious_login',
    weight: 10,
    detailsFn: () => ({
      new_device: Math.random() > 0.4,
      unusual_location: Math.random() > 0.5,
      country: randomItem(['CN', 'RU', 'IR', 'KP', 'US', 'BR']),
      login_time: 'off-hours',
      geo_velocity_anomaly: Math.random() > 0.6,
    }),
  },
];

function pickScenario(allowedTypes?: string[]) {
  const pool = allowedTypes?.length
    ? ATTACK_SCENARIOS.filter((s) => allowedTypes.includes(s.event_type))
    : ATTACK_SCENARIOS;
  if (pool.length === 0) return ATTACK_SCENARIOS[0];

  const total = pool.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const s of pool) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return pool[0];
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
    if (details.geo_velocity_anomaly) score += 10;
    return Math.min(score, 100);
  }
  return 30;
}

export async function POST(req: NextRequest) {
  try {
    let attackTypes: string[] | undefined;
    let count = Math.floor(Math.random() * 4) + 3; // default 3-6

    // Parse optional body parameters
    try {
      const body = await req.json();
      if (Array.isArray(body.attack_types) && body.attack_types.length > 0) {
        attackTypes = body.attack_types;
      }
      if (typeof body.count === 'number' && body.count >= 1) {
        count = Math.min(body.count, 20); // cap at 20
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Fetch active defenses
    const { data: defenses } = await supabase
      .from('active_defenses')
      .select('*')
      .eq('status', 'active');

    const activeDefenses = defenses ?? [];

    const events = Array.from({ length: count }, () => {
      const scenario = pickScenario(attackTypes);
      const details  = scenario.detailsFn() as Record<string, unknown>;
      
      const userId = randomItem(FAKE_USERS);
      const ipAddress = randomItem(FAKE_IPS);
      const eventType = scenario.event_type;
      
      let riskScore = riskFor(eventType, details);
      
      // Check active defenses
      const matchingDefense = activeDefenses.find(d => 
        (d.target_type === 'ip' && d.target_value === ipAddress) ||
        (d.target_type === 'user' && d.target_value === userId) ||
        (d.target_type === 'attack_type' && d.target_value === eventType)
      );

      if (matchingDefense) {
        riskScore = 0;
        details.mitigated = true;
        details.mitigated_by = matchingDefense.action;
        details.mitigation_target = matchingDefense.target_value;
      }

      return {
        user_id:    userId,
        event_type: eventType,
        ip_address: ipAddress,
        device_id:  randomItem(FAKE_DEVICES),
        risk_score: riskScore,
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

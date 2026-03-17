-- ══════════════════════════════════════════════════════════════════════════════
-- ResilienceOS — Supabase Schema  (safe to re-run multiple times)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 ─ Drop everything so re-runs are safe
-- (reverse dependency order)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.subscriptions  cascade;
drop table if exists public.users          cascade;
drop table if exists public.plans          cascade;
drop table if exists public.incidents      cascade;
drop table if exists public.health_checks  cascade;
drop table if exists public.services       cascade;

drop function if exists update_updated_at() cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 ─ services
-- ─────────────────────────────────────────────────────────────────────────────
create table public.services (
  id               text        primary key,
  name             text        not null,
  category         text        not null,
  status           text        not null default 'unknown'
                               check (status in ('operational','degraded','outage','unknown')),
  latency_ms       numeric     not null default 0,
  uptime_percent   numeric     not null default 100,
  region           text        not null default 'IN-CENTRAL',
  description      text        not null default '',
  fallbacks        jsonb       not null default '[]',
  chaos_active     boolean     not null default false,
  last_checked_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 ─ health_checks
-- ─────────────────────────────────────────────────────────────────────────────
create table public.health_checks (
  id          uuid        primary key default gen_random_uuid(),
  service_id  text        not null references public.services(id) on delete cascade,
  status      text        not null
              check (status in ('operational','degraded','outage','unknown')),
  latency_ms  numeric     not null default 0,
  error       text,
  checked_at  timestamptz not null default now()
);

create index health_checks_service_checked
  on public.health_checks (service_id, checked_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 ─ incidents
-- ─────────────────────────────────────────────────────────────────────────────
create table public.incidents (
  id           uuid        primary key default gen_random_uuid(),
  service_id   text        not null references public.services(id) on delete cascade,
  service_name text        not null,
  type         text        not null
               check (type in ('outage','degraded','restored','chaos')),
  message      text        not null,
  resolved     boolean     not null default false,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index incidents_created_at on public.incidents (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 ─ plans
-- ─────────────────────────────────────────────────────────────────────────────
create table public.plans (
  id             text        primary key,
  label          text        not null,
  price_monthly  numeric     not null default 0,
  description    text        not null default '',
  features       jsonb       not null default '[]',
  cta            text        not null default 'Sign up',
  is_popular     boolean     not null default false,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 ─ users  (extends auth.users — must exist before subscriptions)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.users (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null unique,
  full_name   text        not null default '',
  plan_id     text        not null default 'free' references public.plans(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6 ─ subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
create table public.subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  plan_id     text        not null references public.plans(id),
  status      text        not null default 'active'
              check (status in ('active','cancelled','expired')),
  started_at  timestamptz not null default now(),
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index subscriptions_user on public.subscriptions (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6b ─ security_events  (cyber threat monitor)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.security_events cascade;

create table public.security_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text,
  event_type  text        not null,
  ip_address  text,
  device_id   text,
  risk_score  integer     not null default 0,
  details     jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.security_events replica identity full;
create index security_events_created on public.security_events (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6c ─ security_alerts  (correlated alerts from events)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.security_alerts cascade;

create table public.security_alerts (
  id               uuid        primary key default gen_random_uuid(),
  event_id         uuid        references public.security_events(id) on delete set null,
  alert_type       text        not null,
  severity         text        not null default 'medium'
                   check (severity in ('critical','high','medium','low','info')),
  title            text        not null,
  description      text        not null default '',
  mitre_tactic     text,
  mitre_technique  text,
  status           text        not null default 'new'
                   check (status in ('new','acknowledged','investigating','resolved','false_positive')),
  assigned_to      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.security_alerts replica identity full;
create index security_alerts_status on public.security_alerts (status, created_at desc);

create trigger security_alerts_updated_at
  before update on public.security_alerts
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6d ─ remediation_playbooks
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.remediation_playbooks cascade;

create table public.remediation_playbooks (
  id                     uuid        primary key default gen_random_uuid(),
  title                  text        not null,
  attack_type            text        not null,
  severity_range         text        not null default 'medium-critical',
  description            text        not null default '',
  steps                  jsonb       not null default '[]',
  mitre_tactics          jsonb       not null default '[]',
  estimated_time_minutes integer     not null default 30,
  created_at             timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6e ─ security_incidents  (groups alerts)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.security_incidents cascade;

create table public.security_incidents (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null default '',
  severity    text        not null default 'medium'
              check (severity in ('critical','high','medium','low')),
  status      text        not null default 'open'
              check (status in ('open','investigating','mitigated','closed')),
  alert_ids   jsonb       not null default '[]',
  owner       text,
  timeline    jsonb       not null default '[]',
  playbook_id uuid        references public.remediation_playbooks(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);

alter table public.security_incidents replica identity full;
create index security_incidents_status on public.security_incidents (status, created_at desc);

create trigger security_incidents_updated_at
  before update on public.security_incidents
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6f ─ active_defenses  (active mitigations)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.active_defenses cascade;

create table public.active_defenses (
  id           uuid        primary key default gen_random_uuid(),
  target_type  text        not null, -- e.g., 'ip', 'user_id', 'endpoint'
  target_value text        not null, -- e.g., '192.168.1.5', '/api/login'
  action       text        not null, -- e.g., 'block', 'rate_limit', 'require_mfa'
  status       text        not null default 'active', -- 'active' or 'inactive'
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6g ─ security_reports  (post-incident reports)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.security_reports cascade;

create table public.security_reports (
  id           uuid        primary key default gen_random_uuid(),
  incident_id  uuid        references public.security_incidents(id) on delete cascade,
  title        text        not null,
  content      text        not null, -- markdown report
  created_at   timestamptz not null default now()
);

alter table public.security_incidents replica identity full;
create index security_incidents_status on public.security_incidents (status, created_at desc);

create trigger security_incidents_updated_at
  before update on public.security_incidents
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7 ─ auto-update updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger services_updated_at
  before update on public.services
  for each row execute function update_updated_at();

create trigger users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8 ─ Realtime  (safe — ignore if already added)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.services;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.incidents;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.health_checks;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.security_events;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.security_alerts;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.security_incidents;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.active_defenses;
  exception when others then null; end;

  begin
    alter publication supabase_realtime add table public.security_reports;
  exception when others then null; end;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9 ─ Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.services       enable row level security;
alter table public.health_checks  enable row level security;
alter table public.incidents      enable row level security;
alter table public.plans          enable row level security;
alter table public.users          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.security_events enable row level security;
alter table public.security_alerts enable row level security;
alter table public.security_incidents enable row level security;
alter table public.remediation_playbooks enable row level security;
alter table public.active_defenses enable row level security;
alter table public.security_reports enable row level security;

-- Public: anyone can read services, incidents, health_checks, plans
create policy "Public read services"
  on public.services for select using (true);

create policy "Public read incidents"
  on public.incidents for select using (true);

create policy "Public read health_checks"
  on public.health_checks for select using (true);

create policy "Public read plans"
  on public.plans for select using (true);

create policy "Public read security_events"
  on public.security_events for select using (true);

create policy "Public read security_alerts"
  on public.security_alerts for select using (true);

create policy "Public read security_incidents"
  on public.security_incidents for select using (true);

create policy "Public read remediation_playbooks"
  on public.remediation_playbooks for select using (true);

create policy "Public read active_defenses"
  on public.active_defenses for select using (true);

create policy "Public read security_reports"
  on public.security_reports for select using (true);

-- Users: read/update only their own profile
create policy "Users read own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users update own profile"
  on public.users for update using (auth.uid() = id);

-- Users: read only their own subscriptions
create policy "Users read own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);

-- All writes are done via the service-role key in API routes (bypasses RLS)

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10 ─ Seed: plans
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.plans (id, label, price_monthly, description, features, cta, is_popular)
values
  (
    'free',
    'Individual',
    0,
    'For individuals who want to monitor and understand government service outages',
    '["Monitor up to 3 services","Real-time status dashboard","Incident feed (last 24h)","Email alerts (5/month)","Community support"]',
    'Get started free',
    false
  ),
  (
    'pro',
    'Company',
    999,
    'For mid-sized teams serious about digital service resilience and uptime',
    '["Monitor unlimited services","Full real-time dashboard","Incident history (90 days)","Chaos Mode testing","Priority email & chat support","API access","Custom fallback routes"]',
    'Sign up',
    true
  ),
  (
    'enterprise',
    'Enterprise',
    4999,
    'For large organisations requiring maximum resilience and dedicated support',
    '["Everything in Company","Dedicated SRE support","SLA guarantee 99.99%","Custom integrations","On-prem deployment option","Unlimited chaos testing","24/7 phone support"]',
    'Book a call',
    false
  )
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11 ─ Seed: services
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.services
  (id, name, category, status, latency_ms, uptime_percent, region, description, fallbacks)
values
  (
    'passport', 'Passport Portal', 'Identity', 'operational', 142, 99.9, 'IN-CENTRAL',
    'Online passport application and renewal services',
    '[{"label":"Offline Centre Locator","url":"https://www.passportindia.gov.in","description":"Find nearest Passport Seva Kendra"},{"label":"IVR Helpline","url":"tel:18002581800","description":"Call 1800-258-1800 for manual assistance"}]'
  ),
  (
    'income-tax', 'Income Tax Portal', 'Finance', 'operational', 218, 99.1, 'IN-NORTH',
    'ITR filing, tax payment, and refund tracking',
    '[{"label":"e-Filing Offline Tool","url":"https://efilingapp.incometax.gov.in","description":"Download and use offline ITR utility"},{"label":"CPC Helpline","url":"tel:18001030025","description":"1800-103-0025 for filing support"}]'
  ),
  (
    'digilocker', 'DigiLocker', 'Identity', 'degraded', 890, 96.4, 'IN-EAST',
    'Digital document wallet for citizens',
    '[{"label":"UMANG App","url":"https://web.umang.gov.in","description":"Access documents via UMANG mobile app"},{"label":"Physical Document","url":"#","description":"Carry original documents as backup"}]'
  ),
  (
    'umang', 'UMANG App Services', 'Citizen', 'operational', 165, 99.5, 'IN-WEST',
    'Unified mobile application for government services',
    '[{"label":"Individual Portals","url":"#","description":"Access department-specific portals directly"}]'
  ),
  (
    'cowin', 'CoWIN / Health Portal', 'Health', 'operational', 198, 98.7, 'IN-SOUTH',
    'Health records, vaccination, and appointment booking',
    '[{"label":"ABHA Helpline","url":"tel:18001144477","description":"1800-11-4477 for health ID support"},{"label":"Hospital Direct","url":"#","description":"Walk-in to nearest government hospital"}]'
  ),
  (
    'gst', 'GST Portal', 'Finance', 'outage', 0, 71.2, 'IN-CENTRAL',
    'GST filing, returns, and compliance management',
    '[{"label":"Offline Return Utility","url":"https://www.gst.gov.in","description":"Download GST offline tool for filing"},{"label":"GST Helpdesk","url":"tel:18001034786","description":"1800-103-4786 for compliance support"},{"label":"GSTN Backup Portal","url":"#","description":"Access mirror portal during downtime"}]'
  ),
  (
    'epf', 'EPFO Services', 'Finance', 'operational', 312, 98.2, 'IN-CENTRAL',
    'Employee Provident Fund withdrawals, transfers, and balance',
    '[{"label":"EPFO Helpline","url":"tel:1800118005","description":"1800-118-005 for PF assistance"},{"label":"UMANG PF Access","url":"https://web.umang.gov.in","description":"Check PF via UMANG app"}]'
  ),
  (
    'ration', 'Ration Card Portal', 'Welfare', 'degraded', 1240, 94.1, 'IN-EAST',
    'PDS ration card management and food grain tracking',
    '[{"label":"State NIC Portal","url":"#","description":"Access state-level food department portal"},{"label":"FPS Locator","url":"#","description":"Find Fair Price Shops in your area"}]'
  )
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 12 ─ Secure Vault (Client-Side E2EE)
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.vault_documents cascade;

create table public.vault_documents (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users(id) on delete cascade,
  filename_encrypted  text        not null,
  iv                  text        not null,
  salt                text        not null,
  storage_path        text        not null,
  mime_type           text        not null,
  created_at          timestamptz not null default now()
);

alter table public.vault_documents enable row level security;

-- For this demo, allow public access so the vault UI works without signing in
create policy "Public full access to vault_documents"
  on public.vault_documents for all using (true) with check (true);

-- NOTE FOR STORAGE:
-- You must manually create a new storage bucket in Supabase named: secure_vault
-- 1. Go to "Storage" in Supabase
-- 2. Click "New Bucket", name it "secure_vault"
-- 3. Make sure to set bucket policies to allow public read/write for this demo.

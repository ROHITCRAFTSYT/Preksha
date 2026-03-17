-- 1. Create a table specifically for Honeypot Credentials
CREATE TABLE IF NOT EXISTS public.honeypot_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT,
    password_payload TEXT,
    ip_address TEXT,
    attack_vector TEXT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ensure security_events exists (if not already)
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    user_id TEXT,
    ip_address TEXT,
    device_id TEXT,
    risk_score INTEGER,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ensure active_defenses exists (if not already)
CREATE TABLE IF NOT EXISTS public.active_defenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT,
    target_value TEXT,
    action TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Supabase Realtime for these tables
-- This is critical for the Live Attack Feed to work!
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'security_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'honeypot_credentials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE honeypot_credentials;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'active_defenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_defenses;
  END IF;
END $$;

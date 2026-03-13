'use client';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ServiceCard from '@/components/ServiceCard';
import StatusOverview from '@/components/StatusOverview';
import IncidentFeed from '@/components/IncidentFeed';
import ChaosPanel from '@/components/ChaosPanel';
import { dbToGovService, simulateChaos, INITIAL_SERVICES, type GovService } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import type { DbService, DbIncident, DbHealthCheck } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface LiveStats {
  pingsToday: number;
  avgLatency: number;
}

interface RecentCheck {
  id: string;
  service_id: string;
  service_name: string;
  status: string;
  latency_ms: number;
  checked_at: string;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const searchParams = useSearchParams();

  // Use INITIAL_SERVICES as the offline fallback until DB loads
  const [services, setServices] = useState<GovService[]>(INITIAL_SERVICES);
  const [dbIncidents, setDbIncidents] = useState<DbIncident[]>([]);
  const [chaosMode, setChaosMode] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [stats, setStats] = useState<LiveStats>({ pingsToday: 0, avgLatency: 0 });
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [countdown, setCountdown] = useState(60);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const nextPingAtRef = useRef(Date.now() + 60_000);
  const latencyHistoryRef = useRef<Record<string, number[]>>({});
  // Keep a service name lookup so recent pings can display names
  const serviceNamesRef = useRef<Record<string, string>>({});

  // Track previous service statuses for change detection
  const prevStatusRef = useRef<Record<string, string>>({});

  // Initialize chaos from URL param
  useEffect(() => {
    if (searchParams.get('chaos') === 'true') setChaosMode(true);
  }, [searchParams]);

  // Request notification permission on mount + sync state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // ── Fire browser notifications on status changes ───────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    for (const svc of services) {
      const prev = prevStatusRef.current[svc.id];
      const curr = svc.status;
      if (prev && prev !== curr) {
        const icon = curr === 'operational' ? '✅' : curr === 'degraded' ? '⚠️' : '🔴';
        const title = `${icon} ${svc.name}`;
        const body =
          curr === 'outage'      ? `Service is DOWN — ${svc.name} is unreachable` :
          curr === 'degraded'    ? `Degraded — ${svc.name} responding slowly (${Math.round(svc.latency)}ms)` :
          curr === 'operational' ? `Restored — ${svc.name} is back online` :
                                   `Status changed to ${curr}`;
        try {
          new Notification(title, { body, icon: '/favicon.ico', tag: svc.id });
        } catch {
          // Notification API unavailable in this context
        }
      }
      prevStatusRef.current[svc.id] = curr;
    }
  }, [services]);

  // ── Countdown ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((nextPingAtRef.current - Date.now()) / 1000));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load health history (seeds latencyHistoryRef + recentChecks + stats) ──
  const loadHealthHistory = useCallback(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('health_checks')
      .select('*')
      .gte('checked_at', since24h)
      .order('checked_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    const rows = data as DbHealthCheck[];

    // Group by service_id and seed latencyHistoryRef
    const byService: Record<string, number[]> = {};
    for (const row of rows) {
      if (!byService[row.service_id]) byService[row.service_id] = [];
      byService[row.service_id].push(row.latency_ms);
    }
    for (const [serviceId, latencies] of Object.entries(byService)) {
      latencyHistoryRef.current[serviceId] = latencies.slice(-30);
    }

    // Compute aggregate stats
    const pingsToday = rows.length;
    const avgLatency = Math.round(rows.reduce((acc, r) => acc + r.latency_ms, 0) / rows.length);
    setStats({ pingsToday, avgLatency });

    // Recent pings (last 8, newest first)
    const recent = [...rows]
      .reverse()
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        service_id: c.service_id,
        service_name: serviceNamesRef.current[c.service_id] ?? c.service_id,
        status: c.status,
        latency_ms: c.latency_ms,
        checked_at: c.checked_at,
      }));
    setRecentChecks(recent);
  }, []);

  // ── Load services from DB (direct Supabase, public RLS — no auth needed) ──
  const loadServices = useCallback(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');

    if (error || !data) return;

    const rows = data as DbService[];

    // Build name lookup for recent pings panel
    for (const row of rows) {
      serviceNamesRef.current[row.id] = row.name;
    }

    setServices((prev) => {
      const prevMap = Object.fromEntries(prev.map((s) => [s.id, s]));
      return rows.map((row) => {
        // Seed latency history from real health_checks if available, otherwise use current latency
        if (!latencyHistoryRef.current[row.id]) {
          latencyHistoryRef.current[row.id] = [row.latency_ms];
        }
        const history = latencyHistoryRef.current[row.id];
        // Preserve client-side chaos state when chaos is active
        const existing = prevMap[row.id];
        if (existing?.chaosActive && row.chaos_active) {
          return { ...existing, lastChecked: Date.now() };
        }
        return dbToGovService(row, [...history]);
      });
    });

    setIsLive(true);
    setLastRefresh(Date.now());
  }, []);

  // ── Load incidents (direct Supabase, public RLS) ───────────────────────────
  const loadIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return;
    setDbIncidents(data as DbIncident[]);
  }, []);

  // ── Trigger a health check ─────────────────────────────────────────────────
  const triggerHealthCheck = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    nextPingAtRef.current = Date.now() + 60_000;
    try {
      await fetch('/api/health-check', { method: 'POST' });
      await Promise.all([loadServices(), loadIncidents(), loadHealthHistory()]);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, loadServices, loadIncidents, loadHealthHistory]);

  // ── Initial load: history first (seeds latencyHistoryRef), then data ───────
  useEffect(() => {
    async function init() {
      await loadHealthHistory();
      await Promise.all([loadServices(), loadIncidents()]);
    }
    init();
  }, [loadHealthHistory, loadServices, loadIncidents]);

  // ── Supabase Realtime subscriptions ───────────────────────────────────────
  useEffect(() => {
    const servicesSub = supabase
      .channel('realtime-services')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as DbService;
            // Update name lookup
            serviceNamesRef.current[row.id] = row.name;
            setServices((prev) =>
              prev.map((s) => {
                if (s.id !== row.id) return s;
                const hist = latencyHistoryRef.current[row.id] ?? [];
                hist.push(row.latency_ms);
                if (hist.length > 30) hist.shift();
                latencyHistoryRef.current[row.id] = hist;
                return dbToGovService(row, [...hist]);
              })
            );
            setLastRefresh(Date.now());
            setTick((t) => t + 1);
          }
        }
      )
      .subscribe();

    const incidentsSub = supabase
      .channel('realtime-incidents')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          setDbIncidents((prev) => [payload.new as DbIncident, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    const healthSub = supabase
      .channel('realtime-health-checks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'health_checks' },
        (payload) => {
          const check = payload.new as DbHealthCheck;

          // Accumulate latency history for sparklines
          const hist = latencyHistoryRef.current[check.service_id] ?? [];
          hist.push(check.latency_ms);
          if (hist.length > 30) hist.shift();
          latencyHistoryRef.current[check.service_id] = hist;

          // Update recent pings panel
          setRecentChecks((prev) => {
            const newEntry: RecentCheck = {
              id: check.id,
              service_id: check.service_id,
              service_name: serviceNamesRef.current[check.service_id] ?? check.service_id,
              status: check.status,
              latency_ms: check.latency_ms,
              checked_at: check.checked_at,
            };
            return [newEntry, ...prev].slice(0, 8);
          });

          // Update running stats
          setStats((prev) => {
            const newCount = prev.pingsToday + 1;
            const newAvg = Math.round(
              (prev.avgLatency * prev.pingsToday + check.latency_ms) / newCount
            );
            return { pingsToday: newCount, avgLatency: newAvg };
          });

          // Reset countdown to 60s
          nextPingAtRef.current = Date.now() + 60_000;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(servicesSub);
      supabase.removeChannel(incidentsSub);
      supabase.removeChannel(healthSub);
    };
  }, []);

  // ── Local 5s ticker — small latency jitter for non-chaos services ──────────
  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          latency: s.chaosActive
            ? s.latency
            : Math.max(50, s.latency + (Math.random() - 0.5) * 30),
          lastChecked: Date.now(),
        }))
      );
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Health check every 60s ─────────────────────────────────────────────────
  useEffect(() => {
    const hcInterval = setInterval(triggerHealthCheck, 60_000);
    return () => clearInterval(hcInterval);
  }, [triggerHealthCheck]);

  // ── Chaos handlers (persist to DB) ────────────────────────────────────────
  const handleSimulateOutage = useCallback(async (id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? simulateChaos(s) : s)));
    try {
      await fetch('/api/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: id, action: 'inject' }),
      });
      await loadIncidents();
    } catch {
      // optimistic state stays
    }
  }, [loadIncidents]);

  const handleRestoreService = useCallback(async (id: string) => {
    const original = INITIAL_SERVICES.find((s) => s.id === id);
    if (!original) return;
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...original, lastChecked: Date.now() } : s))
    );
    try {
      await fetch('/api/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: id, action: 'restore' }),
      });
      await loadIncidents();
    } catch {
      // optimistic state stays
    }
  }, [loadIncidents]);

  const handleChaosAll = useCallback(async () => {
    setServices((prev) => prev.map((s) => simulateChaos(s)));
    try {
      await Promise.all(
        services.map((s) =>
          fetch('/api/chaos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service_id: s.id, action: 'inject' }),
          })
        )
      );
      await loadIncidents();
    } catch {
      // ignore
    }
  }, [services, loadIncidents]);

  const handleRestoreAll = useCallback(async () => {
    setServices(INITIAL_SERVICES.map((s) => ({ ...s, lastChecked: Date.now() })));
    try {
      await Promise.all(
        INITIAL_SERVICES.map((s) =>
          fetch('/api/chaos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service_id: s.id, action: 'restore' }),
          })
        )
      );
      await loadIncidents();
    } catch {
      // ignore
    }
  }, [loadIncidents]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const categories = ['ALL', ...Array.from(new Set(INITIAL_SERVICES.map((s) => s.category)))];

  const filteredServices = services.filter((s) => {
    const matchCat = filter === 'ALL' || s.category === filter;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Build incident list from DB rows ───────────────────────────────────────
  const liveIncidents = dbIncidents.map((inc) => ({
    id: inc.id,
    serviceId: inc.service_id,
    serviceName: inc.service_name,
    type: inc.type,
    message: inc.message,
    timestamp: new Date(inc.created_at).getTime(),
    resolved: inc.resolved,
    timeAgo: timeAgo(inc.created_at),
  }));

  // ── Countdown colour ───────────────────────────────────────────────────────
  const countdownColour =
    isChecking ? 'text-green-400 animate-pulse' :
    countdown <= 10 ? 'text-yellow-400' :
    'text-white/30';

  return (
    <div className="min-h-screen bg-black text-white font-mono">

      {/* ── Chaos war-room overlays ──────────────────────────────────────── */}
      {/* 1. Radial red ambient glow emanating from centre */}
      <div
        className="fixed inset-0 pointer-events-none z-[5] transition-opacity duration-1000"
        style={{
          opacity: chaosMode ? 1 : 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.07) 0%, rgba(239,68,68,0.02) 35%, transparent 70%)',
        }}
      />

      {/* 2. Page-wide scan line sweeping top → bottom */}
      {chaosMode && (
        <div
          className="fixed left-0 right-0 z-[6] pointer-events-none"
          style={{
            height: '120px',
            background: 'linear-gradient(transparent 0%, rgba(239,68,68,0.04) 50%, transparent 100%)',
            animation: 'pageScanDown 5s linear infinite',
          }}
        />
      )}

      {/* 3. Vignette: red corner bleeds */}
      <div
        className="fixed inset-0 pointer-events-none z-[5] transition-opacity duration-1000"
        style={{
          opacity: chaosMode ? 1 : 0,
          background: `
            radial-gradient(ellipse at 0% 0%,   rgba(239,68,68,0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 0%,  rgba(239,68,68,0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 0% 100%,  rgba(239,68,68,0.06) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%,rgba(239,68,68,0.06) 0%, transparent 40%)
          `,
        }}
      />

      {/* Top nav */}
      <div
        className="border-b sticky top-0 z-30 bg-black/90 backdrop-blur-sm transition-colors duration-700"
        style={{ borderColor: chaosMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/50 hover:text-white text-[10px] tracking-widest transition-colors">
              ← BACK
            </Link>
            <div className="w-px h-4 bg-white/20" />
            <div
              className="font-bold text-base tracking-widest italic -skew-x-6 transition-colors duration-500"
              style={{ color: chaosMode ? '#fca5a5' : 'white' }}
            >
              RESILIENCE<span style={{ color: chaosMode ? '#ef4444' : '#4ade80' }}>OS</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-[9px] text-white/30">·</span>
              <span className="text-[9px] text-white/40 tracking-widest">DASHBOARD</span>
            </div>

            {/* Chaos mode active badge — only shown when chaos is on */}
            {chaosMode && (
              <div className="hidden lg:flex items-center gap-1.5 border border-red-500/50 bg-red-500/10 px-2.5 py-1 animate-pulse">
                <span className="text-red-400 text-[8px]">⚡</span>
                <span className="text-red-400 text-[8px] font-bold tracking-[0.25em]">CHAOS MODE ACTIVE</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Public status page link */}
            <Link
              href="/status"
              className="hidden lg:flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 tracking-widest transition-colors border border-white/10 hover:border-white/20 px-2 py-1"
            >
              ↗ STATUS
            </Link>

            {/* Search */}
            <input
              type="text"
              placeholder="SEARCH SERVICES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hidden lg:block bg-transparent border border-white/10 px-3 py-1 text-[10px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-44 tracking-wider"
            />

            {/* Countdown */}
            <div className={`hidden lg:flex items-center gap-1 text-[9px] tracking-widest ${countdownColour}`}>
              {isChecking ? '⟳ CHECKING...' : `PING IN ${countdown}s`}
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-1.5 text-[9px] text-white/40">
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="hidden lg:inline">{isLive ? 'LIVE' : 'LOCAL'}</span>
            </div>

            {/* Manual health check */}
            <button
              onClick={triggerHealthCheck}
              disabled={isChecking}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[9px] border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 transition-all disabled:opacity-30"
            >
              ⟳ PING
            </button>

            {/* Notification bell */}
            <button
              onClick={async () => {
                if (!('Notification' in window)) return;
                if (Notification.permission === 'granted') {
                  // Show a test notification
                  new Notification('🔔 ResilienceOS', { body: 'Alerts are active. You\'ll be notified of status changes.', icon: '/favicon.ico' });
                } else {
                  const perm = await Notification.requestPermission();
                  setNotifPermission(perm);
                }
              }}
              title={
                notifPermission === 'granted' ? 'Notifications active — click to test' :
                notifPermission === 'denied'  ? 'Notifications blocked — enable in browser settings' :
                'Enable status change alerts'
              }
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[9px] border transition-all ${
                notifPermission === 'granted'
                  ? 'border-green-500/30 text-green-400/70 hover:text-green-400 hover:border-green-500/50'
                  : notifPermission === 'denied'
                  ? 'border-white/10 text-white/20 cursor-not-allowed'
                  : 'border-white/20 text-white/40 hover:border-white/40 hover:text-white/70'
              }`}
            >
              {notifPermission === 'granted' ? '🔔' : notifPermission === 'denied' ? '🔕' : '🔔'}
              <span className="tracking-widest">
                {notifPermission === 'granted' ? 'ALERTS ON' : notifPermission === 'denied' ? 'BLOCKED' : 'ALERTS'}
              </span>
            </button>

            {/* Chaos toggle */}
            <button
              onClick={() => setChaosMode(!chaosMode)}
              className={`px-3 py-1.5 text-[9px] font-bold tracking-widest transition-all duration-300 border ${
                chaosMode
                  ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30'
                  : 'border-red-500/40 text-red-400 hover:bg-red-500/10'
              }`}
              style={chaosMode ? { animation: 'chaosPulseEdge 2s ease-in-out infinite' } : {}}
            >
              ⚡ {chaosMode ? 'EXIT CHAOS' : 'CHAOS'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Status Overview */}
        <StatusOverview services={services} />

        {/* Live stats bar */}
        {isLive && (
          <div className="border border-white/10 bg-white/[0.02] px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/30 tracking-widest">PINGS TODAY</span>
              <span className="text-[11px] text-green-400 font-bold">{stats.pingsToday.toLocaleString()}</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/30 tracking-widest">AVG LATENCY</span>
              <span className="text-[11px] text-blue-400 font-bold">{stats.avgLatency}ms</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/30 tracking-widest">LAST REFRESH</span>
              <span className="text-[11px] text-white/50">{new Date(lastRefresh).toLocaleTimeString()}</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/30 tracking-widest">SOURCE</span>
              <span className="text-[11px] text-green-400/70">● SUPABASE REALTIME</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[8px] text-white/20 tracking-widest">NEXT PING</span>
              <span className={`text-[11px] font-bold tabular-nums ${countdown <= 10 ? 'text-yellow-400' : 'text-white/40'}`}>
                {countdown}s
              </span>
            </div>
          </div>
        )}

        {/* Chaos mode warning banner */}
        {chaosMode && (
          <div
            className="border border-red-500/50 p-4 flex items-center justify-between gap-4 overflow-hidden relative"
            style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 40%, transparent 100%)' }}
          >
            {/* Left glow bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" style={{ animation: 'chaosPulseEdge 1.4s ease-in-out infinite' }} />

            <div className="flex items-center gap-4 pl-3">
              <span className="text-red-400 text-xl leading-none">⚡</span>
              <div>
                <div className="text-red-400 text-[11px] font-bold tracking-[0.3em]">CHAOS MODE ACTIVE — RESILIENCE TEST IN PROGRESS</div>
                <div className="text-red-400/50 text-[9px] mt-0.5 tracking-wider">
                  Inject failures via the Chaos Panel or individual service cards. All injections persist to the database.
                </div>
              </div>
            </div>

            {/* Right: live counter of injected services */}
            <div className="flex-shrink-0 text-right">
              <div className="text-3xl font-bold tabular-nums text-red-400 leading-none" style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
                {services.filter(s => s.chaosActive).length}
              </div>
              <div className="text-[7px] text-red-400/40 tracking-[0.25em] mt-0.5">INJECTED</div>
            </div>
          </div>
        )}

        {/* Not-live banner */}
        {!isLive && (
          <div className="border border-yellow-500/30 bg-yellow-950/20 p-2 flex items-center gap-2">
            <span className="text-yellow-400/80 text-[10px]">⚠</span>
            <span className="text-yellow-400/60 text-[9px] tracking-wider">
              RUNNING ON LOCAL DATA — Connect Supabase in .env.local to enable live monitoring
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main services panel */}
          <div className="xl:col-span-3 space-y-4">
            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-2.5 py-1 text-[9px] tracking-widest border transition-all ${
                    filter === cat
                      ? 'bg-white text-black border-white'
                      : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <span className="ml-auto text-[8px] text-white/20 self-center">
                {filteredServices.length} SERVICE{filteredServices.length !== 1 ? 'S' : ''}
              </span>
            </div>

            {/* Services grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onSimulateOutage={handleSimulateOutage}
                  onRestoreService={handleRestoreService}
                  chaosMode={chaosMode}
                  incidents={dbIncidents
                    .filter((i) => i.service_id === service.id)
                    .slice(0, 10)
                    .map((i) => ({ message: i.message, created_at: i.created_at }))}
                />
              ))}
            </div>

            {filteredServices.length === 0 && (
              <div className="border border-white/10 p-8 text-center">
                <div className="text-white/20 text-xs tracking-widest">NO SERVICES MATCH YOUR FILTER</div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Chaos panel */}
            <ChaosPanel
              chaosMode={chaosMode}
              onToggleChaos={() => setChaosMode(!chaosMode)}
              onChaosAll={handleChaosAll}
              onRestoreAll={handleRestoreAll}
              services={services}
              onSimulateOutage={handleSimulateOutage}
              onRestoreService={handleRestoreService}
            />

            {/* Recent pings panel */}
            {recentChecks.length > 0 && (
              <div className="border border-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] text-white/40 tracking-widest">RECENT PINGS</div>
                  <span className="text-[8px] text-green-400/50">● LIVE</span>
                </div>
                <div className="space-y-1.5">
                  {recentChecks.map((check) => (
                    <div key={check.id} className="flex items-center gap-2">
                      <div className={`w-1 h-1 rounded-full flex-shrink-0 ${
                        check.status === 'operational' ? 'bg-green-400' :
                        check.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-500'
                      }`} />
                      <span className="text-[9px] text-white/60 flex-1 truncate">
                        {check.service_name}
                      </span>
                      <span className={`text-[9px] tabular-nums ${
                        check.latency_ms === 0 ? 'text-red-400' :
                        check.latency_ms > 800 ? 'text-yellow-400' : 'text-green-400/80'
                      }`}>
                        {check.latency_ms === 0 ? 'ERR' : `${check.latency_ms}ms`}
                      </span>
                      <span className="text-[8px] text-white/20 flex-shrink-0">
                        {timeAgo(check.checked_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incident feed */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[9px] text-white/40 tracking-widest">INCIDENT FEED</div>
                {liveIncidents.filter((i) => !i.resolved).length > 0 && (
                  <span className="text-[8px] bg-red-500 text-white px-1 font-bold">
                    {liveIncidents.filter((i) => !i.resolved).length}
                  </span>
                )}
                {isLive && (
                  <span className="text-[8px] text-green-400/60 ml-auto">● DB</span>
                )}
              </div>
              <IncidentFeed services={services} incidents={liveIncidents} />
            </div>

            {/* Regional health */}
            <div className="border border-white/10 p-3">
              <div className="text-[9px] text-white/40 tracking-widest mb-2">REGIONAL HEALTH</div>
              <div className="space-y-1.5">
                {['IN-CENTRAL', 'IN-NORTH', 'IN-SOUTH', 'IN-EAST', 'IN-WEST'].map((region) => {
                  const regionServices = services.filter((s) => s.region === region);
                  const hasOutage = regionServices.some((s) => s.status === 'outage');
                  const hasDegraded = regionServices.some((s) => s.status === 'degraded');
                  return (
                    <div key={region} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        hasOutage ? 'bg-red-500 animate-pulse' :
                        hasDegraded ? 'bg-yellow-400' : 'bg-green-400'
                      }`} />
                      <span className="text-[9px] text-white/50 flex-1">{region}</span>
                      <span className="text-[8px] text-white/30">{regionServices.length} SVC</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-green-400 text-xs tracking-widest animate-pulse">LOADING DASHBOARD...</div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}

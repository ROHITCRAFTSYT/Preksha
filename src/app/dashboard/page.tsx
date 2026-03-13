'use client';
import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ServiceCard from '@/components/ServiceCard';
import IncidentFeed from '@/components/IncidentFeed';
import ChaosPanel from '@/components/ChaosPanel';
import GlassCategoryButton, { GlassDistortionFilter } from '@/components/GlassCategoryButton';
import GlowCard from '@/components/GlowCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/Tooltip';
import { dbToGovService, simulateChaos, INITIAL_SERVICES, type GovService } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import type { DbService, DbIncident, DbHealthCheck } from '@/lib/supabase';

type Tab = 'services' | 'events' | 'chaos';

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

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  label, icon, active, badge, badgeDanger, onClick,
}: {
  label: string; icon: string; active: boolean;
  badge?: number | null; badgeDanger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs rounded-sm transition-all text-left ${
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`text-[11px] ${active ? 'opacity-100' : 'opacity-40'}`}>{icon}</span>
        <span className="tracking-wide font-medium">{label}</span>
      </div>
      {badge !== null && badge !== undefined && badge > 0 && (
        <span className={`text-[9px] px-1.5 py-0.5 font-bold rounded-[2px] ${
          badgeDanger ? 'bg-red-500/90 text-white' : 'bg-white/[0.08] text-white/40'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, pulse, glowColor = 'white' }: {
  label: string; value: string | number; sub?: string; color: string; pulse?: boolean;
  glowColor?: 'white' | 'red' | 'orange' | 'green' | 'blue';
}) {
  return (
    <GlowCard glowColor={glowColor} className="p-5 flex flex-col gap-1.5">
      <div className="text-[9px] text-white/25 tracking-[0.2em] uppercase">{label}</div>
      <div className={`text-[32px] font-bold tabular-nums leading-none mt-0.5 ${color} ${pulse ? 'animate-pulse' : ''}`}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-white/20 mt-0.5">{sub}</div>}
    </GlowCard>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>('services');
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
  const [countdown, setCountdown] = useState(15);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const nextPingAtRef = useRef(Date.now() + 60_000);
  const nextRefreshAtRef = useRef(Date.now() + 15_000);
  const latencyHistoryRef = useRef<Record<string, number[]>>({});
  const serviceNamesRef = useRef<Record<string, string>>({});
  const prevStatusRef = useRef<Record<string, string>>({});

  // ── Derived values ─────────────────────────────────────────────────────────
  const avgUptime = useMemo(
    () => services.length > 0 ? services.reduce((sum, s) => sum + s.uptime, 0) / services.length : 100,
    [services],
  );

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(INITIAL_SERVICES.map((s) => s.category)))],
    [],
  );

  const filteredServices = useMemo(
    () => services.filter((s) => {
      const matchCat = filter === 'ALL' || s.category === filter;
      const matchSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    }),
    [services, filter, searchQuery],
  );

  const liveIncidents = useMemo(
    () => dbIncidents.map((inc) => ({
      id: inc.id,
      serviceId: inc.service_id,
      serviceName: inc.service_name,
      type: inc.type,
      message: inc.message,
      timestamp: new Date(inc.created_at).getTime(),
      resolved: inc.resolved,
      timeAgo: timeAgo(inc.created_at),
    })),
    [dbIncidents],
  );

  const activeIncidentCount = useMemo(
    () => liveIncidents.filter((i) => !i.resolved).length,
    [liveIncidents],
  );

  const uptimeColor =
    avgUptime >= 99.5 ? 'text-green-400' : avgUptime >= 95 ? 'text-yellow-400' : 'text-red-400';

  const latencyColor =
    stats.avgLatency === 0 ? 'text-white/30' :
    stats.avgLatency > 800 ? 'text-red-400' :
    stats.avgLatency > 400 ? 'text-yellow-400' : 'text-blue-400';

  // ── Init chaos from URL ────────────────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('chaos') === 'true') setChaosMode(true);
  }, [searchParams]);

  // ── Notification permission ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // ── Status-change notifications ───────────────────────────────────────────
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
        try { new Notification(title, { body, icon: '/favicon.ico', tag: svc.id }); }
        catch { /* unavailable */ }
      }
      prevStatusRef.current[svc.id] = curr;
    }
  }, [services]);

  // ── Countdown ticker (tracks 15s data refresh) ────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((nextRefreshAtRef.current - Date.now()) / 1000));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load health history ────────────────────────────────────────────────────
  const loadHealthHistory = useCallback(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('health_checks')
      .select('*')
      .gte('checked_at', since24h)
      .order('checked_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    const rows = data as DbHealthCheck[];
    const byService: Record<string, number[]> = {};
    for (const row of rows) {
      if (!byService[row.service_id]) byService[row.service_id] = [];
      byService[row.service_id].push(row.latency_ms);
    }
    for (const [serviceId, latencies] of Object.entries(byService)) {
      latencyHistoryRef.current[serviceId] = latencies.slice(-30);
    }
    const pingsToday = rows.length;
    const avgLatency = Math.round(rows.reduce((acc, r) => acc + r.latency_ms, 0) / rows.length);
    setStats({ pingsToday, avgLatency });

    const recent = [...rows].reverse().slice(0, 8).map((c) => ({
      id: c.id,
      service_id: c.service_id,
      service_name: serviceNamesRef.current[c.service_id] ?? c.service_id,
      status: c.status,
      latency_ms: c.latency_ms,
      checked_at: c.checked_at,
    }));
    setRecentChecks(recent);
  }, []);

  // ── Load services ──────────────────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    const { data, error } = await supabase.from('services').select('*').order('name');
    if (error || !data) return;

    const rows = data as DbService[];
    for (const row of rows) serviceNamesRef.current[row.id] = row.name;

    setServices((prev) => {
      const prevMap = Object.fromEntries(prev.map((s) => [s.id, s]));
      return rows.map((row) => {
        if (!latencyHistoryRef.current[row.id]) latencyHistoryRef.current[row.id] = [row.latency_ms];
        const history = latencyHistoryRef.current[row.id];
        const existing = prevMap[row.id];
        if (existing?.chaosActive && row.chaos_active) return { ...existing, lastChecked: Date.now() };
        return dbToGovService(row, [...history]);
      });
    });
    setIsLive(true);
    setLastRefresh(Date.now());
  }, []);

  // ── Load incidents ─────────────────────────────────────────────────────────
  const loadIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from('incidents').select('*').order('created_at', { ascending: false }).limit(50);
    if (error || !data) return;
    setDbIncidents(data as DbIncident[]);
  }, []);

  // ── Refresh data from DB (lightweight, no API ping) ───────────────────────
  const refreshData = useCallback(async () => {
    nextRefreshAtRef.current = Date.now() + 15_000;
    setCountdown(15);
    await Promise.all([loadServices(), loadIncidents(), loadHealthHistory()]);
  }, [loadServices, loadIncidents, loadHealthHistory]);

  // ── Trigger health check (API ping + data refresh) ─────────────────────────
  const triggerHealthCheck = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    nextPingAtRef.current = Date.now() + 60_000;
    nextRefreshAtRef.current = Date.now() + 15_000;
    try {
      await fetch('/api/health-check', { method: 'POST' });
      await Promise.all([loadServices(), loadIncidents(), loadHealthHistory()]);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, loadServices, loadIncidents, loadHealthHistory]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      await loadHealthHistory();
      await Promise.all([loadServices(), loadIncidents()]);
    }
    init();
  }, [loadHealthHistory, loadServices, loadIncidents]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const servicesSub = supabase
      .channel('realtime-services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const row = payload.new as DbService;
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
      })
      .subscribe();

    const incidentsSub = supabase
      .channel('realtime-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        setDbIncidents((prev) => [payload.new as DbIncident, ...prev].slice(0, 50));
      })
      .subscribe();

    const healthSub = supabase
      .channel('realtime-health-checks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'health_checks' }, (payload) => {
        const check = payload.new as DbHealthCheck;
        const hist = latencyHistoryRef.current[check.service_id] ?? [];
        hist.push(check.latency_ms);
        if (hist.length > 30) hist.shift();
        latencyHistoryRef.current[check.service_id] = hist;

        setRecentChecks((prev) => {
          const newEntry: RecentCheck = {
            id: check.id, service_id: check.service_id,
            service_name: serviceNamesRef.current[check.service_id] ?? check.service_id,
            status: check.status, latency_ms: check.latency_ms, checked_at: check.checked_at,
          };
          return [newEntry, ...prev].slice(0, 8);
        });

        setStats((prev) => {
          const newCount = prev.pingsToday + 1;
          const newAvg = Math.round((prev.avgLatency * prev.pingsToday + check.latency_ms) / newCount);
          return { pingsToday: newCount, avgLatency: newAvg };
        });
        nextPingAtRef.current = Date.now() + 60_000;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(servicesSub);
      supabase.removeChannel(incidentsSub);
      supabase.removeChannel(healthSub);
    };
  }, []);

  // ── Local 5s latency jitter ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          latency: s.chaosActive ? s.latency : Math.max(50, s.latency + (Math.random() - 0.5) * 30),
          lastChecked: Date.now(),
        }))
      );
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto data refresh every 15s ───────────────────────────────────────────
  useEffect(() => {
    const refreshInterval = setInterval(refreshData, 15_000);
    return () => clearInterval(refreshInterval);
  }, [refreshData]);

  // ── Auto health check (API ping) every 60s ─────────────────────────────────
  useEffect(() => {
    const hcInterval = setInterval(triggerHealthCheck, 60_000);
    return () => clearInterval(hcInterval);
  }, [triggerHealthCheck]);

  // ── Chaos handlers ─────────────────────────────────────────────────────────
  const handleSimulateOutage = useCallback(async (id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? simulateChaos(s) : s)));
    try {
      await fetch('/api/chaos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: id, action: 'inject' }),
      });
      await loadIncidents();
    } catch { /* optimistic */ }
  }, [loadIncidents]);

  const handleRestoreService = useCallback(async (id: string) => {
    const original = INITIAL_SERVICES.find((s) => s.id === id);
    if (!original) return;
    setServices((prev) => prev.map((s) => (s.id === id ? { ...original, lastChecked: Date.now() } : s)));
    try {
      await fetch('/api/chaos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: id, action: 'restore' }),
      });
      await loadIncidents();
    } catch { /* optimistic */ }
  }, [loadIncidents]);

  const handleChaosAll = useCallback(async () => {
    setServices((prev) => prev.map((s) => simulateChaos(s)));
    try {
      await Promise.all(services.map((s) =>
        fetch('/api/chaos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_id: s.id, action: 'inject' }),
        })
      ));
      await loadIncidents();
    } catch { /* ignore */ }
  }, [services, loadIncidents]);

  const handleRestoreAll = useCallback(async () => {
    setServices(INITIAL_SERVICES.map((s) => ({ ...s, lastChecked: Date.now() })));
    try {
      await Promise.all(INITIAL_SERVICES.map((s) =>
        fetch('/api/chaos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_id: s.id, action: 'restore' }),
        })
      ));
      await loadIncidents();
    } catch { /* ignore */ }
  }, [loadIncidents]);

  // ── Chaos glow overlay opacity ─────────────────────────────────────────────
  const _ = tick; // keep tick in scope to prevent lint warning

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-mono flex flex-col overflow-hidden">

      {/* ── Glass distortion filter (rendered once, hidden) ─────────────── */}
      <GlassDistortionFilter />

      {/* ── Chaos war-room overlays ──────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-[5] transition-opacity duration-1000"
        style={{
          opacity: chaosMode ? 1 : 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 35%, transparent 70%)',
        }}
      />
      {chaosMode && (
        <div
          className="fixed left-0 right-0 z-[6] pointer-events-none"
          style={{
            height: '120px',
            background: 'linear-gradient(transparent 0%, rgba(239,68,68,0.03) 50%, transparent 100%)',
            animation: 'pageScanDown 5s linear infinite',
          }}
        />
      )}

      {/* ── Top header ───────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 border-b z-30 bg-[#0a0a0a]/95 backdrop-blur-sm transition-colors duration-700"
        style={{ borderColor: chaosMode ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between h-[52px] px-5 gap-4">
          {/* Left: brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/30 hover:text-white/60 text-[10px] tracking-widest transition-colors hidden sm:inline">
              ← BACK
            </Link>
            <div className="hidden sm:block w-px h-3.5 bg-white/10" />
            <div
              className="font-bold text-sm tracking-widest italic -skew-x-6 transition-colors duration-500"
              style={{ color: chaosMode ? '#fca5a5' : 'white' }}
            >
              RESILIENCE<span style={{ color: chaosMode ? '#ef4444' : '#4ade80' }}>OS</span>
            </div>
            <span className="text-white/[0.15] text-xs hidden sm:inline">/</span>
            <span className="text-white/25 text-[10px] tracking-widest hidden sm:inline">DASHBOARD</span>
            {chaosMode && (
              <div className="hidden md:flex items-center gap-1.5 border border-red-500/40 bg-red-500/[0.06] px-2 py-1 animate-pulse">
                <span className="text-red-400 text-[9px] font-bold tracking-[0.2em]">⚡ CHAOS MODE</span>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Live dot */}
            <div className="flex items-center gap-1.5 mr-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-[10px] text-white/35 hidden sm:inline">{isLive ? 'LIVE' : 'LOCAL'}</span>
            </div>

            <Link
              href="/status"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-white/35 border border-white/[0.07] hover:border-white/20 hover:text-white/60 transition-all"
            >
              ↗ STATUS
            </Link>

            <button
              onClick={triggerHealthCheck}
              disabled={isChecking}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-white/35 border border-white/[0.07] hover:border-white/20 hover:text-white/60 transition-all disabled:opacity-30"
            >
              ⟳ {isChecking ? 'PINGING...' : 'PING'}
            </button>

            <button
              onClick={async () => {
                if (!('Notification' in window)) return;
                if (Notification.permission === 'granted') {
                  new Notification('🔔 ResilienceOS', { body: 'Alerts are active.', icon: '/favicon.ico' });
                } else {
                  const perm = await Notification.requestPermission();
                  setNotifPermission(perm);
                }
              }}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] border transition-all ${
                notifPermission === 'granted'
                  ? 'border-green-500/25 text-green-400/60 hover:text-green-400 hover:border-green-500/40'
                  : 'border-white/[0.07] text-white/30 hover:text-white/50 hover:border-white/20'
              }`}
              title={notifPermission === 'granted' ? 'Alerts active — click to test' : 'Enable alerts'}
            >
              🔔 <span className="tracking-widest">{notifPermission === 'granted' ? 'ALERTS ON' : 'ALERTS'}</span>
            </button>

            <button
              onClick={() => setChaosMode(!chaosMode)}
              className={`px-3 py-1.5 text-[10px] font-bold border transition-all duration-300 ${
                chaosMode
                  ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                  : 'border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60'
              }`}
            >
              ⚡ {chaosMode ? 'EXIT CHAOS' : 'CHAOS'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex w-[210px] flex-shrink-0 flex-col border-r overflow-y-auto transition-colors duration-700"
          style={{
            borderColor: chaosMode ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)',
            background: '#0d0d0d',
          }}
        >
          {/* Navigation */}
          <div className="p-3 space-y-0.5">
            <div className="px-3 pt-2 pb-1.5 text-[9px] text-white/20 tracking-[0.2em]">MONITOR</div>
            <NavItem
              label="Services"
              icon="◈"
              active={activeTab === 'services'}
              badge={filteredServices.length}
              onClick={() => setActiveTab('services')}
            />
            <NavItem
              label="Events"
              icon="◉"
              active={activeTab === 'events'}
              badge={activeIncidentCount}
              badgeDanger={activeIncidentCount > 0}
              onClick={() => setActiveTab('events')}
            />
            <div className="px-3 pt-3 pb-1.5 text-[9px] text-white/20 tracking-[0.2em]">TOOLS</div>
            <NavItem
              label="Chaos Lab"
              icon="⚡"
              active={activeTab === 'chaos'}
              onClick={() => setActiveTab('chaos')}
            />
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div className="mx-4 h-px bg-white/[0.06]" />

          {/* Regional health */}
          <div className="p-3 flex-1">
            <div className="px-3 pt-3 pb-2 text-[9px] text-white/20 tracking-[0.2em]">REGIONAL HEALTH</div>
            <TooltipProvider delayDuration={200}>
            <div className="space-y-px">
              {['IN-CENTRAL', 'IN-NORTH', 'IN-SOUTH', 'IN-EAST', 'IN-WEST'].map((region) => {
                const regionServices = services.filter((s) => s.region === region);
                const hasOutage = regionServices.some((s) => s.status === 'outage');
                const hasDegraded = regionServices.some((s) => s.status === 'degraded');
                const anomalies = regionServices.filter((s) => s.status !== 'operational');
                const outageCount = regionServices.filter((s) => s.status === 'outage').length;
                const degradedCount = regionServices.filter((s) => s.status === 'degraded').length;
                return (
                  <Tooltip key={region}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-default">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          hasOutage ? 'bg-red-500 animate-pulse' : hasDegraded ? 'bg-yellow-400' : 'bg-green-400'
                        }`} />
                        <span className="text-[10px] text-white/45 flex-1 tracking-wide">{region}</span>
                        <span className="text-[9px] text-white/20">{regionServices.length}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="space-y-1.5 min-w-[140px]">
                        <div className="text-[9px] text-white/30 tracking-[0.2em] mb-2">{region}</div>
                        {anomalies.length === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            <span className="text-green-400/80">All systems operational</span>
                          </div>
                        ) : (
                          <>
                            {outageCount > 0 && (
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                  <span className="text-red-400/90">Outages</span>
                                </div>
                                <span className="text-red-400 font-bold">{outageCount}</span>
                              </div>
                            )}
                            {degradedCount > 0 && (
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                                  <span className="text-yellow-400/90">Degraded</span>
                                </div>
                                <span className="text-yellow-400 font-bold">{degradedCount}</span>
                              </div>
                            )}
                            <div className="border-t border-white/[0.07] pt-1.5 mt-1 space-y-1">
                              {anomalies.map((s) => (
                                <div key={s.id} className="flex items-center gap-2">
                                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${s.status === 'outage' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                                  <span className="text-white/50 text-[9px] truncate">{s.name}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="border-t border-white/[0.07] pt-1.5 mt-1 text-white/25 text-[9px]">
                          {regionServices.length} service{regionServices.length !== 1 ? 's' : ''} monitored
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            </TooltipProvider>
          </div>

          <div className="mx-4 h-px bg-white/[0.06]" />

          {/* Footer: countdown + pings */}
          <div className="p-4 space-y-4">
            <div className="px-1">
              <div className="text-[9px] text-white/20 tracking-[0.2em] mb-1">NEXT REFRESH</div>
              <div className={`text-2xl font-bold tabular-nums ${
                isChecking ? 'text-blue-400 animate-pulse' :
                countdown <= 5 ? 'text-yellow-400' : 'text-white/35'
              }`}>
                {isChecking ? '↻' : `${countdown}s`}
              </div>
            </div>
            {isLive && stats.pingsToday > 0 && (
              <div className="px-1">
                <div className="text-[9px] text-white/20 tracking-[0.2em] mb-1">PINGS TODAY</div>
                <div className="text-sm font-bold text-white/35 tabular-nums">
                  {stats.pingsToday.toLocaleString()}
                </div>
              </div>
            )}
            {isLive && (
              <div className="px-1">
                <div className="text-[9px] text-white/20 tracking-[0.2em] mb-1">LAST REFRESH</div>
                <div className="text-[10px] text-white/25 tabular-nums" suppressHydrationWarning>
                  {new Date(lastRefresh).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">

          {/* Mobile tab bar */}
          <div
            className="md:hidden flex border-b"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0d0d0d' }}
          >
            {(['services', 'events', 'chaos'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[10px] tracking-widest transition-all relative ${
                  activeTab === tab ? 'text-white' : 'text-white/30 hover:text-white/50'
                }`}
              >
                {tab.toUpperCase()}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-white" />
                )}
                {tab === 'events' && activeIncidentCount > 0 && (
                  <span className="ml-1 text-[8px] bg-red-500 text-white px-1 font-bold rounded-[2px]">
                    {activeIncidentCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 md:p-6 space-y-5">

            {/* ── Alert banners ────────────────────────────────────────── */}
            {chaosMode && (
              <div
                className="border border-red-500/35 px-5 py-3.5 flex items-center justify-between gap-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 50%, transparent 100%)' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" style={{ animation: 'chaosPulseEdge 1.4s ease-in-out infinite' }} />
                <div className="flex items-center gap-4 pl-2">
                  <span className="text-red-400 text-base">⚡</span>
                  <div>
                    <div className="text-red-400 text-[11px] font-bold tracking-[0.25em]">CHAOS MODE ACTIVE — RESILIENCE TEST IN PROGRESS</div>
                    <div className="text-red-400/45 text-[10px] mt-0.5">
                      Inject failures via Chaos Lab or individual service cards. All injections persist to the database.
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-3xl font-bold tabular-nums text-red-400" style={{ textShadow: '0 0 20px rgba(239,68,68,0.4)' }}>
                    {services.filter((s) => s.chaosActive).length}
                  </div>
                  <div className="text-[8px] text-red-400/35 tracking-[0.2em] mt-0.5">INJECTED</div>
                </div>
              </div>
            )}

            {!isLive && (
              <div className="border border-yellow-500/20 bg-yellow-500/[0.04] px-4 py-3 flex items-center gap-2.5">
                <span className="text-yellow-400/60 text-sm">⚠</span>
                <span className="text-yellow-400/50 text-[10px] tracking-wide">
                  Running on local data — add Supabase credentials to .env.local to enable live monitoring
                </span>
              </div>
            )}

            {/* ── Stat cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Services"
                value={services.length}
                sub={filter !== 'ALL' ? `${filteredServices.length} shown` : 'monitored'}
                color="text-white"
                glowColor="white"
              />
              <StatCard
                label="Avg Uptime"
                value={`${avgUptime.toFixed(1)}%`}
                color={uptimeColor}
                glowColor={avgUptime >= 99.5 ? 'green' : avgUptime >= 95 ? 'orange' : 'red'}
              />
              <StatCard
                label="Avg Latency"
                value={stats.avgLatency > 0 ? `${stats.avgLatency}ms` : '—'}
                sub="last 24h"
                color={latencyColor}
                glowColor={stats.avgLatency === 0 ? 'white' : stats.avgLatency > 800 ? 'red' : stats.avgLatency > 400 ? 'orange' : 'blue'}
              />
              <StatCard
                label="Active Incidents"
                value={activeIncidentCount}
                color={activeIncidentCount > 0 ? 'text-red-400' : 'text-green-400'}
                pulse={activeIncidentCount > 0}
                glowColor={activeIncidentCount > 0 ? 'red' : 'green'}
              />
            </div>

            {/* ── Tab: Services ─────────────────────────────────────────── */}
            {activeTab === 'services' && (
              <div className="space-y-4">
                {/* Category filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {categories.map((cat) => (
                    <GlassCategoryButton
                      key={cat}
                      label={cat}
                      active={filter === cat}
                      onClick={() => setFilter(cat)}
                    />
                  ))}
                  <span className="ml-auto text-[9px] text-white/20 tracking-wider">
                    {filteredServices.length} / {services.length} services
                  </span>
                </div>

                {/* Service cards grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
                  {filteredServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onSimulateOutage={handleSimulateOutage}
                      onRestoreService={handleRestoreService}
                      chaosMode={chaosMode}
                      expanded={expandedCardId === service.id}
                      onToggleExpand={() => setExpandedCardId(prev => prev === service.id ? null : service.id)}
                      incidents={dbIncidents
                        .filter((i) => i.service_id === service.id)
                        .slice(0, 10)
                        .map((i) => ({ message: i.message, created_at: i.created_at }))}
                    />
                  ))}
                </div>

                {filteredServices.length === 0 && (
                  <div className="border border-white/[0.07] p-12 text-center">
                    <div className="text-white/15 text-xs tracking-widest">NO SERVICES MATCH YOUR FILTER</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Events ───────────────────────────────────────────── */}
            {activeTab === 'events' && (
              <div className="max-w-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/30 tracking-[0.2em]">INCIDENT FEED</span>
                  {activeIncidentCount > 0 && (
                    <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 font-bold">
                      {activeIncidentCount} ACTIVE
                    </span>
                  )}
                  {isLive && (
                    <span className="text-[9px] text-green-400/40 ml-auto">● SUPABASE REALTIME</span>
                  )}
                </div>

                <IncidentFeed services={services} incidents={liveIncidents} />

                {/* Recent pings */}
                {recentChecks.length > 0 && (
                  <div className="border border-white/[0.08] p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/25 tracking-[0.2em]">RECENT PINGS</span>
                      <span className="text-[8px] text-green-400/35">● LIVE</span>
                    </div>
                    <div className="space-y-2.5">
                      {recentChecks.map((check) => (
                        <div key={check.id} className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            check.status === 'operational' ? 'bg-green-400' :
                            check.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-500'
                          }`} />
                          <span className="text-[11px] text-white/55 flex-1 truncate">{check.service_name}</span>
                          <span className={`text-[11px] tabular-nums font-medium ${
                            check.latency_ms === 0 ? 'text-red-400' :
                            check.latency_ms > 800 ? 'text-yellow-400' : 'text-green-400/80'
                          }`}>
                            {check.latency_ms === 0 ? 'ERR' : `${check.latency_ms}ms`}
                          </span>
                          <span className="text-[9px] text-white/20 flex-shrink-0">
                            {timeAgo(check.checked_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Chaos ────────────────────────────────────────────── */}
            {activeTab === 'chaos' && (
              <div className="max-w-xl">
                <ChaosPanel
                  chaosMode={chaosMode}
                  onToggleChaos={() => setChaosMode(!chaosMode)}
                  onChaosAll={handleChaosAll}
                  onRestoreAll={handleRestoreAll}
                  services={services}
                  onSimulateOutage={handleSimulateOutage}
                  onRestoreService={handleRestoreService}
                />
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="font-mono text-green-400 text-xs tracking-widest animate-pulse">
          LOADING DASHBOARD...
        </div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}

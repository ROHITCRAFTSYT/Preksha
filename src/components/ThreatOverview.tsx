'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface OverviewStats {
  totalEvents: number;
  eventsLastHour: number;
  meanRisk: number;
  openAlerts: number;
  openIncidents: number;
  criticalCount: number;
  topAttackType: string;
  topIP: string;
}

const DEFCON_LEVELS = [
  { level: 5, label: 'NORMAL',   color: '#4ade80', bg: 'bg-green-500/10  border-green-500/30' },
  { level: 4, label: 'ELEVATED', color: '#60a5fa', bg: 'bg-blue-500/10   border-blue-500/30' },
  { level: 3, label: 'HIGH',     color: '#eab308', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { level: 2, label: 'SEVERE',   color: '#f97316', bg: 'bg-orange-500/10 border-orange-500/30' },
  { level: 1, label: 'CRITICAL', color: '#ef4444', bg: 'bg-red-500/10    border-red-500/30' },
];

function getDefcon(stats: OverviewStats) {
  if (stats.criticalCount >= 5 || stats.meanRisk >= 80) return DEFCON_LEVELS[4];
  if (stats.criticalCount >= 2 || stats.meanRisk >= 65) return DEFCON_LEVELS[3];
  if (stats.openAlerts >= 10 || stats.meanRisk >= 50) return DEFCON_LEVELS[2];
  if (stats.totalEvents >= 5 || stats.openAlerts >= 3) return DEFCON_LEVELS[1];
  return DEFCON_LEVELS[0];
}

const ATTACK_LABELS: Record<string, string> = {
  brute_force_login: 'BRUTE FORCE',
  document_download: 'DATA EXFIL',
  token_hijack_attempt: 'TOKEN HIJACK',
  api_abuse: 'API ABUSE',
  suspicious_login: 'SUS LOGIN',
};

export default function ThreatOverview() {
  const [stats, setStats] = useState<OverviewStats>({
    totalEvents: 0, eventsLastHour: 0, meanRisk: 0, openAlerts: 0,
    openIncidents: 0, criticalCount: 0, topAttackType: '-', topIP: '-',
  });
  const [riskTimeline, setRiskTimeline] = useState<number[]>([]);
  const [attackBreakdown, setAttackBreakdown] = useState<Record<string, number>>({});
  const [topIPs, setTopIPs] = useState<{ ip: string; count: number }[]>([]);

  const loadStats = useCallback(async () => {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

    const [eventsRes, alertsRes, incidentsRes] = await Promise.all([
      supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('security_alerts').select('id, status, severity').in('status', ['new', 'acknowledged', 'investigating']),
      supabase.from('security_incidents').select('id, status').in('status', ['open', 'investigating']),
    ]);

    const events = (eventsRes.data ?? []) as { risk_score: number; created_at: string; event_type: string; ip_address: string }[];
    const alerts = alertsRes.data ?? [];
    const incidents = incidentsRes.data ?? [];

    const recentEvents = events.filter(e => new Date(e.created_at).toISOString() >= oneHourAgo);
    const meanRisk = events.length > 0 ? Math.round(events.reduce((s, e) => s + e.risk_score, 0) / events.length) : 0;
    const criticalCount = events.filter(e => e.risk_score >= 85).length;

    // Attack type breakdown
    const breakdown: Record<string, number> = {};
    events.forEach(e => { breakdown[e.event_type] = (breakdown[e.event_type] ?? 0) + 1; });
    setAttackBreakdown(breakdown);

    // Top IPs
    const ipCount: Record<string, number> = {};
    events.forEach(e => { if (e.ip_address) ipCount[e.ip_address] = (ipCount[e.ip_address] ?? 0) + 1; });
    const sorted = Object.entries(ipCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ip, count]) => ({ ip, count }));
    setTopIPs(sorted);

    // Risk timeline (last 12 buckets)
    const buckets: number[] = [];
    const chunk = Math.ceil(events.length / 12);
    for (let i = 0; i < 12; i++) {
      const slice = events.slice(i * chunk, (i + 1) * chunk);
      buckets.push(slice.length > 0 ? Math.round(slice.reduce((s, e) => s + e.risk_score, 0) / slice.length) : 0);
    }
    setRiskTimeline(buckets.reverse());

    const topType = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

    setStats({
      totalEvents: events.length,
      eventsLastHour: recentEvents.length,
      meanRisk,
      openAlerts: alerts.length,
      openIncidents: incidents.length,
      criticalCount,
      topAttackType: ATTACK_LABELS[topType] ?? topType,
      topIP: sorted[0]?.ip ?? '-',
    });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setInterval(loadStats, 15000); return () => clearInterval(t); }, [loadStats]);

  const defcon = getDefcon(stats);

  return (
    <div className="space-y-4 pb-8">
      {/* DEFCON Gauge */}
      <div className={`border p-5 flex items-center justify-between ${defcon.bg}`}>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl font-black tabular-nums"
            style={{ borderColor: defcon.color, color: defcon.color, boxShadow: `0 0 20px ${defcon.color}40` }}
          >
            {defcon.level}
          </div>
          <div>
            <div className="text-[9px] text-white/25 tracking-[0.3em]">THREAT LEVEL</div>
            <div className="text-lg font-bold tracking-widest" style={{ color: defcon.color }}>{defcon.label}</div>
            <div className="text-[9px] text-white/30 mt-0.5">DEFCON {defcon.level} — {stats.totalEvents} total events</div>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[9px] text-white/20 tracking-widest">TOP THREAT</div>
          <div className="text-sm font-bold text-white/60 mt-1">{stats.topAttackType}</div>
          <div className="text-[9px] text-white/20 mt-0.5">from {stats.topIP}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'EVENTS / HOUR', value: stats.eventsLastHour, color: stats.eventsLastHour > 10 ? 'text-red-400' : 'text-white/60', pulse: stats.eventsLastHour > 10 },
          { label: 'MEAN RISK SCORE', value: stats.meanRisk, color: stats.meanRisk >= 65 ? 'text-red-400' : stats.meanRisk >= 40 ? 'text-yellow-400' : 'text-green-400', pulse: false },
          { label: 'OPEN ALERTS', value: stats.openAlerts, color: stats.openAlerts > 0 ? 'text-orange-400' : 'text-white/30', pulse: stats.openAlerts > 5 },
          { label: 'OPEN INCIDENTS', value: stats.openIncidents, color: stats.openIncidents > 0 ? 'text-red-400' : 'text-white/30', pulse: stats.openIncidents > 0 },
        ].map(({ label, value, color, pulse }) => (
          <div key={label} className="border border-white/[0.07] bg-white/[0.02] p-3 flex flex-col gap-1">
            <div className="text-[8px] text-white/20 tracking-[0.2em]">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Risk timeline */}
      {riskTimeline.some(v => v > 0) && (
        <div className="border border-white/[0.07] bg-white/[0.01] p-4">
          <div className="text-[9px] text-white/20 tracking-[0.2em] mb-3">RISK SCORE TIMELINE</div>
          <div className="flex items-end gap-1 h-16">
            {riskTimeline.map((score, i) => {
              const h = score > 0 ? Math.max(4, (score / 100) * 64) : 2;
              const color = score >= 85 ? '#ef4444' : score >= 65 ? '#f97316' : score >= 40 ? '#eab308' : '#4ade80';
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all duration-500"
                  style={{ height: `${h}px`, background: score > 0 ? color : 'rgba(255,255,255,0.05)', opacity: 0.4 + (i / 12) * 0.6 }}
                  title={`Risk: ${score}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-white/15">OLDEST</span>
            <span className="text-[8px] text-white/15">NOW</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Attack breakdown */}
        {Object.keys(attackBreakdown).length > 0 && (
          <div className="border border-white/[0.07] bg-white/[0.01] p-4">
            <div className="text-[9px] text-white/20 tracking-[0.2em] mb-3">ATTACK VECTOR DISTRIBUTION</div>
            <div className="space-y-2">
              {Object.entries(attackBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const total = Object.values(attackBreakdown).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    brute_force_login: '#ef4444', document_download: '#f97316',
                    token_hijack_attempt: '#a855f7', api_abuse: '#eab308', suspicious_login: '#60a5fa',
                  };
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-[9px] text-white/30 w-24 truncate">{ATTACK_LABELS[type] ?? type}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[type] ?? '#666' }} />
                      </div>
                      <span className="text-[9px] tabular-nums text-white/30 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Top IPs */}
        {topIPs.length > 0 && (
          <div className="border border-white/[0.07] bg-white/[0.01] p-4">
            <div className="text-[9px] text-white/20 tracking-[0.2em] mb-3">TOP SOURCE IPs</div>
            <div className="space-y-2">
              {topIPs.map(({ ip, count }, i) => (
                <div key={ip} className="flex items-center gap-3">
                  <span className="text-[9px] text-white/20 w-4 text-right">{i + 1}.</span>
                  <span className="text-[10px] text-white/50 font-mono flex-1">{ip}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400/60 transition-all" style={{ width: `${(count / (topIPs[0]?.count ?? 1)) * 100}%` }} />
                    </div>
                    <span className="text-[9px] tabular-nums text-white/30">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {stats.totalEvents === 0 && (
        <div className="border border-white/[0.07] p-12 text-center">
          <div className="text-2xl opacity-15 mb-2">🛡</div>
          <div className="text-[10px] text-white/20 tracking-widest">NO SECURITY DATA YET</div>
          <div className="text-[9px] text-white/10 mt-1">Go to the Monitor tab and simulate an attack to populate this dashboard</div>
        </div>
      )}
    </div>
  );
}

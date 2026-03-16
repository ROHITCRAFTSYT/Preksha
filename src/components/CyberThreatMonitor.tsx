'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: string;
  ip_address: string;
  device_id: string | null;
  risk_score: number;
  details: Record<string, unknown>;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const EVENT_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  document_download:   { label: 'ABNORMAL DOWNLOAD',  icon: '📥', color: 'text-orange-400', bg: 'border-orange-500/20 bg-orange-500/[0.04]' },
  brute_force_login:   { label: 'BRUTE FORCE',        icon: '🔨', color: 'text-red-400',    bg: 'border-red-500/20 bg-red-500/[0.04]' },
  token_hijack_attempt:{ label: 'TOKEN HIJACK',       icon: '🔑', color: 'text-purple-400', bg: 'border-purple-500/20 bg-purple-500/[0.04]' },
  api_abuse:           { label: 'API ABUSE',           icon: '⚡', color: 'text-yellow-400', bg: 'border-yellow-500/20 bg-yellow-500/[0.04]' },
  suspicious_login:    { label: 'SUSPICIOUS LOGIN',   icon: '👤', color: 'text-blue-400',   bg: 'border-blue-500/20 bg-blue-500/[0.04]' },
};

function riskLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'CRITICAL', color: 'text-red-400' };
  if (score >= 65) return { label: 'HIGH',     color: 'text-orange-400' };
  if (score >= 40) return { label: 'MEDIUM',   color: 'text-yellow-400' };
  return                  { label: 'LOW',      color: 'text-green-400' };
}

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 85 ? '#ef4444' :
    score >= 65 ? '#f97316' :
    score >= 40 ? '#eab308' : '#4ade80';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[9px] tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

// ── AI Analysis Modal ─────────────────────────────────────────────────────────

function AIModal({ event, onClose }: { event: SecurityEvent; onClose: () => void }) {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function analyse() {
      try {
        const res = await fetch('/api/security-analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: event.event_type,
            risk_score: event.risk_score,
            ip_address: event.ip_address,
            details: event.details,
          }),
        });
        const data = await res.json();
        setReport(data.report ?? 'Analysis unavailable.');
      } catch {
        setReport('AI analysis service unavailable. Check GROQ_API_KEY.');
      } finally {
        setLoading(false);
      }
    }
    analyse();
  }, [event]);

  const meta = EVENT_META[event.event_type] ?? { label: event.event_type, icon: '⚠', color: 'text-white/60', bg: '' };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#0d0d0d] border border-purple-500/25 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <span className="text-[18px]">{meta.icon}</span>
            <div>
              <div className="text-[10px] text-purple-400 tracking-[0.2em] font-bold">⚡ AI SECURITY ANALYST</div>
              <div className="text-[9px] text-white/30 tracking-widest mt-0.5">{meta.label} · {event.ip_address}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
              <div className="text-[10px] text-purple-400/60 tracking-widest animate-pulse">ANALYSING THREAT...</div>
            </div>
          ) : (
            <pre className="text-[11px] text-white/70 font-mono leading-relaxed whitespace-pre-wrap">{report}</pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[9px] text-white/20 tracking-widest">GROQ · LLAMA-3.3-70B</span>
          <RiskBar score={event.risk_score} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CyberThreatMonitor() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [analysisEvent, setAnalysisEvent] = useState<SecurityEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const prevEventCount = useRef(0);

  // ── Load events ─────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setEvents(data as SecurityEvent[]);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('realtime-security-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, (payload) => {
        const ev = payload.new as SecurityEvent;
        setEvents((prev) => [ev, ...prev].slice(0, 50));
        setNewEventIds((prev) => new Set(prev).add(ev.id));
        setTimeout(() => setNewEventIds((prev) => { const n = new Set(prev); n.delete(ev.id); return n; }), 3000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Flash new events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length > prevEventCount.current && prevEventCount.current > 0) {
      const newIds = events.slice(0, events.length - prevEventCount.current).map(e => e.id);
      setNewEventIds(new Set(newIds));
      setTimeout(() => setNewEventIds(new Set()), 3000);
    }
    prevEventCount.current = events.length;
  }, [events]);

  // ── Simulate attack ─────────────────────────────────────────────────────────
  const simulateAttack = useCallback(async () => {
    setSimulating(true);
    try {
      await fetch('/api/security-simulate', { method: 'POST' });
      await loadEvents();
    } finally {
      setSimulating(false);
    }
  }, [loadEvents]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const activeThreats      = events.filter(e => e.risk_score >= 65).length;
  const criticalCount      = events.filter(e => e.risk_score >= 85).length;
  const bruteForceCount    = events.filter(e => e.event_type === 'brute_force_login').length;
  const abnormalDownloads  = events.filter(e => e.event_type === 'document_download').length;
  const tokenHijacks       = events.filter(e => e.event_type === 'token_hijack_attempt').length;

  const filters = ['ALL', 'document_download', 'brute_force_login', 'token_hijack_attempt', 'api_abuse', 'suspicious_login'];
  const filteredEvents = activeFilter === 'ALL' ? events : events.filter(e => e.event_type === activeFilter);

  return (
    <>
      {analysisEvent && <AIModal event={analysisEvent} onClose={() => setAnalysisEvent(null)} />}

      <div className="space-y-4 pb-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">DIGILOCKER · SECURITY LAYER</div>
            <h2 className="text-sm font-bold text-white/80 tracking-wide">Cyber Threat Monitor</h2>
          </div>
          <button
            onClick={simulateAttack}
            disabled={simulating}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold border transition-all ${
              simulating
                ? 'border-purple-500/60 text-purple-400 bg-purple-500/10 animate-pulse'
                : 'border-purple-500/40 text-purple-400/70 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/60'
            }`}
          >
            <span>{simulating ? '⟳' : '⚡'}</span>
            {simulating ? 'SIMULATING...' : 'SIMULATE ATTACK'}
          </button>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { label: 'ACTIVE THREATS',       value: activeThreats,     color: activeThreats > 0 ? 'text-red-400' : 'text-white/30',    pulse: activeThreats > 0 },
            { label: 'CRITICAL ALERTS',       value: criticalCount,     color: criticalCount > 0 ? 'text-red-400' : 'text-white/30',    pulse: criticalCount > 0 },
            { label: 'BRUTE FORCE',           value: bruteForceCount,   color: bruteForceCount > 0 ? 'text-orange-400' : 'text-white/30', pulse: false },
            { label: 'ABNORMAL DOWNLOADS',    value: abnormalDownloads, color: abnormalDownloads > 0 ? 'text-orange-400' : 'text-white/30', pulse: false },
            { label: 'TOKEN HIJACK ATTEMPTS', value: tokenHijacks,      color: tokenHijacks > 0 ? 'text-purple-400' : 'text-white/30',  pulse: tokenHijacks > 0 },
          ].map(({ label, value, color, pulse }) => (
            <div key={label} className="border border-white/[0.07] bg-white/[0.02] p-3 flex flex-col gap-1">
              <div className="text-[8px] text-white/20 tracking-[0.2em]">{label}</div>
              <div className={`text-2xl font-bold tabular-nums ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Event type filter ──────────────────────────────────────────── */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => {
            const meta = f !== 'ALL' ? EVENT_META[f] : null;
            const count = f === 'ALL' ? events.length : events.filter(e => e.event_type === f).length;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 text-[9px] tracking-widest border transition-all rounded-[2px] ${
                  activeFilter === f
                    ? 'bg-white/[0.08] text-white border-white/25'
                    : 'text-white/30 border-white/[0.07] hover:border-white/20 hover:text-white/50'
                }`}
              >
                {meta ? `${meta.icon} ` : ''}{f === 'ALL' ? 'ALL' : meta?.label ?? f}
                {count > 0 && <span className="ml-1 opacity-50">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Attack timeline / feed ─────────────────────────────────────── */}
        <div className="border border-white/[0.07] bg-white/[0.01]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${events.length > 0 ? 'bg-red-400 animate-pulse' : 'bg-white/20'}`} />
              <span className="text-[9px] text-white/30 tracking-[0.2em]">ATTACK TIMELINE</span>
            </div>
            <span className="text-[9px] text-white/20">{filteredEvents.length} EVENTS</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="text-2xl opacity-20">🛡</div>
              <div className="text-[10px] text-white/20 tracking-widest">NO THREATS DETECTED</div>
              <div className="text-[9px] text-white/10 tracking-wider mt-1">Click "SIMULATE ATTACK" to generate test events</div>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
              {filteredEvents.map((ev) => {
                const meta = EVENT_META[ev.event_type] ?? { label: ev.event_type.replace(/_/g, ' ').toUpperCase(), icon: '⚠', color: 'text-white/60', bg: '' };
                const risk = riskLabel(ev.risk_score);
                const isNew = newEventIds.has(ev.id);

                return (
                  <div
                    key={ev.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-all duration-500 ${
                      isNew ? 'bg-purple-500/[0.08]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Icon */}
                    <div className="text-[18px] flex-shrink-0 mt-0.5">{meta.icon}</div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold tracking-wide ${meta.color}`}>{meta.label}</span>
                        <span className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 border ${
                          risk.label === 'CRITICAL' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                          risk.label === 'HIGH'     ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' :
                          risk.label === 'MEDIUM'   ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' :
                                                      'border-green-500/40 bg-green-500/10 text-green-400'
                        }`}>{risk.label}</span>
                        {isNew && (
                          <span className="text-[8px] text-purple-400 tracking-widest animate-pulse">● LIVE</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[9px] text-white/30 font-mono">IP: {ev.ip_address}</span>
                        <span className="text-[9px] text-white/20">·</span>
                        <span className="text-[9px] text-white/25 font-mono truncate max-w-[160px]">
                          {ev.user_id}
                        </span>
                        <span className="text-[9px] text-white/20">·</span>
                        <span className="text-[9px] text-white/20">{timeAgo(ev.created_at)}</span>
                      </div>

                      {/* Details preview */}
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <div className="mt-1 text-[9px] text-white/20 font-mono truncate">
                          {Object.entries(ev.details).slice(0, 2).map(([k, v]) => (
                            <span key={k} className="mr-3">{k}: <span className="text-white/35">{String(v)}</span></span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <RiskBar score={ev.risk_score} />
                      <button
                        onClick={() => setAnalysisEvent(ev)}
                        className="px-2 py-1 text-[9px] text-purple-400/60 border border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/40 transition-all tracking-widest"
                      >
                        ⚡ ANALYSE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Risk distribution ──────────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="border border-white/[0.07] bg-white/[0.01] p-4">
            <div className="text-[9px] text-white/20 tracking-[0.2em] mb-3">RISK DISTRIBUTION</div>
            <div className="space-y-2">
              {[
                { label: 'CRITICAL (85–100)', count: events.filter(e => e.risk_score >= 85).length, color: '#ef4444', max: events.length },
                { label: 'HIGH (65–84)',       count: events.filter(e => e.risk_score >= 65 && e.risk_score < 85).length, color: '#f97316', max: events.length },
                { label: 'MEDIUM (40–64)',     count: events.filter(e => e.risk_score >= 40 && e.risk_score < 65).length, color: '#eab308', max: events.length },
                { label: 'LOW (0–39)',         count: events.filter(e => e.risk_score < 40).length,  color: '#4ade80', max: events.length },
              ].map(({ label, count, color, max }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="text-[9px] text-white/25 w-32 flex-shrink-0">{label}</div>
                  <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color }}
                    />
                  </div>
                  <div className="text-[9px] tabular-nums w-6 text-right" style={{ color }}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SQL schema hint ────────────────────────────────────────────── */}
        <div className="border border-white/[0.05] bg-white/[0.01] p-4">
          <div className="text-[9px] text-white/15 tracking-[0.2em] mb-2">SUPABASE — RUN THIS SQL TO ENABLE</div>
          <pre className="text-[9px] text-white/25 font-mono leading-relaxed overflow-x-auto">{`CREATE TABLE security_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text,
  event_type  text,
  ip_address  text,
  device_id   text,
  risk_score  integer DEFAULT 0,
  details     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE security_events REPLICA IDENTITY FULL;
-- Enable Realtime in Supabase Dashboard → Database → Replication`}</pre>
        </div>
      </div>
    </>
  );
}

'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const ALL_ATTACK_TYPES = Object.keys(EVENT_META);

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

// ── Attack Config Panel ───────────────────────────────────────────────────────

function AttackConfigPanel({
  onLaunch,
  simulating,
  waveInfo,
}: {
  onLaunch: (config: { attackTypes: string[]; count: number; coordinated: boolean }) => void;
  simulating: boolean;
  waveInfo: { current: number; total: number } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...ALL_ATTACK_TYPES]);
  const [intensity, setIntensity] = useState(5);
  const [coordinated, setCoordinated] = useState(false);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const selectAll = () => setSelectedTypes([...ALL_ATTACK_TYPES]);
  const selectNone = () => setSelectedTypes([]);

  const intensityLabel =
    intensity <= 3 ? 'PROBE' :
    intensity <= 8 ? 'MODERATE' :
    intensity <= 14 ? 'AGGRESSIVE' : 'OVERWHELMING';

  const intensityColor =
    intensity <= 3 ? 'text-green-400' :
    intensity <= 8 ? 'text-yellow-400' :
    intensity <= 14 ? 'text-orange-400' : 'text-red-400';

  const intensityBarColor =
    intensity <= 3 ? '#4ade80' :
    intensity <= 8 ? '#eab308' :
    intensity <= 14 ? '#f97316' : '#ef4444';

  return (
    <div className="border border-purple-500/20 bg-purple-500/[0.02]">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-500/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-[11px]">⚡</span>
          <span className="text-[10px] text-purple-400/80 tracking-[0.2em] font-bold">ATTACK CONFIGURATION</span>
        </div>
        <span className={`text-[9px] text-purple-400/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Expanded config */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="attack-config"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-4 border-t border-purple-500/10">
              {/* Attack type selection */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-white/25 tracking-[0.2em]">ATTACK VECTORS</span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[8px] text-purple-400/50 hover:text-purple-400 tracking-widest transition-colors">ALL</button>
                    <span className="text-white/10 text-[8px]">|</span>
                    <button onClick={selectNone} className="text-[8px] text-purple-400/50 hover:text-purple-400 tracking-widest transition-colors">NONE</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ATTACK_TYPES.map((type) => {
                    const meta = EVENT_META[type];
                    const active = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] tracking-wider border transition-all ${
                          active
                            ? `${meta.bg} ${meta.color} border-current`
                            : 'text-white/20 border-white/[0.06] hover:border-white/15 hover:text-white/40'
                        }`}
                      >
                        <span className="text-[11px]">{meta.icon}</span>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intensity slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-white/25 tracking-[0.2em]">INTENSITY</span>
                  <span className={`text-[9px] font-bold tracking-widest ${intensityColor}`}>
                    {intensityLabel} — {intensity} EVENTS
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full h-1.5 appearance-none bg-white/[0.06] rounded-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${intensityBarColor} 0%, ${intensityBarColor} ${(intensity / 20) * 100}%, rgba(255,255,255,0.06) ${(intensity / 20) * 100}%, rgba(255,255,255,0.06) 100%)`,
                    }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[8px] text-white/15">1</span>
                    <span className="text-[8px] text-white/15">20</span>
                  </div>
                </div>
              </div>

              {/* Coordinated attack toggle */}
              <div className="flex items-center justify-between p-3 border border-white/[0.06] bg-white/[0.02]">
                <div>
                  <div className="text-[10px] text-white/50 font-medium">Coordinated Attack</div>
                  <div className="text-[9px] text-white/20 mt-0.5">Fire 3 waves with 1.5s delay between each</div>
                </div>
                <button
                  onClick={() => setCoordinated(!coordinated)}
                  className={`w-9 h-5 rounded-full transition-all duration-200 relative ${
                    coordinated ? 'bg-purple-500' : 'bg-white/[0.1]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm ${
                      coordinated ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Launch button */}
              <button
                onClick={() => onLaunch({ attackTypes: selectedTypes, count: intensity, coordinated })}
                disabled={simulating || selectedTypes.length === 0}
                className={`w-full py-3 text-[11px] font-bold tracking-[0.25em] border transition-all duration-300 relative overflow-hidden ${
                  simulating
                    ? 'border-purple-500/60 text-purple-400 bg-purple-500/15 cursor-not-allowed'
                    : selectedTypes.length === 0
                      ? 'border-white/10 text-white/20 cursor-not-allowed'
                      : 'border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/70 hover:shadow-lg hover:shadow-purple-500/10 active:bg-purple-500/30'
                }`}
              >
                {/* Scan line during simulation */}
                {simulating && (
                  <div
                    className="absolute inset-x-0 h-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"
                    style={{ animation: 'attackScanX 1.2s linear infinite' }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {simulating ? (
                    <>
                      <span className="animate-spin text-[13px]">⟳</span>
                      {waveInfo
                        ? `WAVE ${waveInfo.current}/${waveInfo.total} — ATTACKING...`
                        : 'ATTACKING...'}
                    </>
                  ) : (
                    <>
                      <span className="text-[13px]">⚡</span>
                      {coordinated ? 'LAUNCH COORDINATED ATTACK' : 'LAUNCH ATTACK'}
                    </>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact launch button when collapsed */}
      {!expanded && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onLaunch({ attackTypes: selectedTypes, count: intensity, coordinated })}
            disabled={simulating || selectedTypes.length === 0}
            className={`w-full py-2.5 text-[10px] font-bold tracking-[0.2em] border transition-all relative overflow-hidden ${
              simulating
                ? 'border-purple-500/60 text-purple-400 bg-purple-500/10 animate-pulse'
                : 'border-purple-500/40 text-purple-400/70 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/60'
            }`}
          >
            {simulating && (
              <div
                className="absolute inset-x-0 h-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"
                style={{ animation: 'attackScanX 1.2s linear infinite' }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <span>{simulating ? '⟳' : '⚡'}</span>
              {simulating
                ? (waveInfo ? `WAVE ${waveInfo.current}/${waveInfo.total}` : 'ATTACKING...')
                : 'QUICK ATTACK'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CyberThreatMonitor() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [waveInfo, setWaveInfo] = useState<{ current: number; total: number } | null>(null);
  const [analysisEvent, setAnalysisEvent] = useState<SecurityEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [isLiveBattle, setIsLiveBattle] = useState(false);
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'security_events' }, () => {
        // When events are deleted (clear all), reload
        loadEvents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadEvents]);

  // ── Flash new events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length > prevEventCount.current && prevEventCount.current > 0) {
      const newIds = events.slice(0, events.length - prevEventCount.current).map(e => e.id);
      setNewEventIds(new Set(newIds));
      setTimeout(() => setNewEventIds(new Set()), 3000);
    }
    prevEventCount.current = events.length;
  }, [events]);

  // ── Launch attack ───────────────────────────────────────────────────────────
  const launchAttack = useCallback(async (config: { attackTypes: string[]; count: number; coordinated: boolean }) => {
    setSimulating(true);
    setWaveInfo(null);

    try {
      if (config.coordinated) {
        const waves = 3;
        const perWave = Math.ceil(config.count / waves);
        for (let w = 1; w <= waves; w++) {
          setWaveInfo({ current: w, total: waves });
          await fetch('/api/security-simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attack_types: config.attackTypes,
              count: perWave,
            }),
          });
          if (w < waves) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      } else {
        await fetch('/api/security-simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attack_types: config.attackTypes,
            count: config.count,
          }),
        });
      }
      await loadEvents();
    } finally {
      setSimulating(false);
      setWaveInfo(null);
    }
  }, [loadEvents]);

  // ── Auto-Pilot (Live Battle) ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLiveBattle) return;
    
    // Fire an attack every 2.5 to 5 seconds
    const intervalId = setInterval(() => {
      // Pick 1-2 random attack types
      const shuffled = [...ALL_ATTACK_TYPES].sort(() => 0.5 - Math.random());
      const selectedTypes = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);
      
      fetch('/api/security-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attack_types: selectedTypes,
          count: Math.floor(Math.random() * 3) + 1, // small bursts
        }),
      }).catch(console.error); // Silently catch to not spam console
      
    }, Math.floor(Math.random() * 2500) + 2500);

    return () => clearInterval(intervalId);
  }, [isLiveBattle]);

  const clearAllEvents = useCallback(async () => {
    setClearing(true);
    try {
      await fetch('/api/security-events', { method: 'DELETE' });
      setEvents([]);
      prevEventCount.current = 0;
    } finally {
      setClearing(false);
    }
  }, []);

  // ── Quick apply defense ───────────────────────────────────────────────────
  const handleQuickBlock = async (targetType: string, targetValue: string) => {
    try {
      await fetch('/api/security-defenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_value: targetValue, action: 'block' }),
      });
      // Optional: show a small success indication or wait for the next mitigated events
    } catch (err) {
      console.error('Failed to quick block', err);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const activeThreats      = events.filter(e => e.risk_score >= 65 && !e.details?.mitigated).length;
  const criticalCount      = events.filter(e => e.risk_score >= 85 && !e.details?.mitigated).length;
  const bruteForceCount    = events.filter(e => e.event_type === 'brute_force_login').length;
  const abnormalDownloads  = events.filter(e => e.event_type === 'document_download').length;
  const tokenHijacks       = events.filter(e => e.event_type === 'token_hijack_attempt').length;
  const blockedCount       = events.filter(e => e.details?.mitigated).length;

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
          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <span className="text-[9px] text-white/20 tabular-nums">{events.length} EVENTS</span>
            )}
            {simulating && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 border border-purple-500/40 bg-purple-500/10 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-[9px] text-purple-400 tracking-widest font-bold">ATTACK IN PROGRESS</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Attack Configuration Panel ──────────────────────────────────── */}
        <div className="flex gap-2 mb-4 w-full">
          <div className="flex-1">
            <AttackConfigPanel onLaunch={launchAttack} simulating={simulating || isLiveBattle} waveInfo={waveInfo} />
          </div>
          <button
            onClick={() => setIsLiveBattle(!isLiveBattle)}
            className={`w-32 flex flex-col items-center justify-center border transition-all relative overflow-hidden ${
              isLiveBattle 
                ? 'border-red-500 text-red-400 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                : 'border-white/10 text-white/40 hover:text-white/80 hover:bg-white/[0.05] hover:border-white/20'
            }`}
          >
            {isLiveBattle && (
              <div
                className="absolute inset-0 bg-red-500/10"
                style={{ animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
              />
            )}
            <span className="text-xl relative z-10">{isLiveBattle ? '🔥' : '⚔️'}</span>
            <span className="text-[9px] font-bold tracking-widest mt-1 relative z-10 text-center">
              {isLiveBattle ? 'STOP AUTO-PILOT' : 'LIVE BATTLE\nAUTO-PILOT'}
            </span>
          </button>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: 'ACTIVE THREATS',       value: activeThreats,     color: activeThreats > 0 ? 'text-red-400' : 'text-white/30',    pulse: activeThreats > 0 },
            { label: 'CRITICAL ALERTS',       value: criticalCount,     color: criticalCount > 0 ? 'text-red-400' : 'text-white/30',    pulse: criticalCount > 0 },
            { label: 'BLOCKED EVENTS',        value: blockedCount,      color: blockedCount > 0 ? 'text-purple-400' : 'text-white/30',  pulse: false },
            { label: 'BRUTE FORCE',           value: bruteForceCount,   color: bruteForceCount > 0 ? 'text-orange-400' : 'text-white/30', pulse: false },
            { label: 'ABNORMAL DOWNLOADS',    value: abnormalDownloads, color: abnormalDownloads > 0 ? 'text-orange-400' : 'text-white/30', pulse: false },
            { label: 'TOKEN HIJACKS',         value: tokenHijacks,      color: tokenHijacks > 0 ? 'text-purple-400' : 'text-white/30',  pulse: tokenHijacks > 0 },
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
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-white/20">{filteredEvents.length} EVENTS</span>
              {events.length > 0 && (
                <button
                  onClick={clearAllEvents}
                  disabled={clearing}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] border transition-all ${
                    clearing
                      ? 'border-red-500/40 text-red-400/50 animate-pulse'
                      : 'border-red-500/20 text-red-400/40 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/[0.06]'
                  }`}
                >
                  <span className="text-[10px]">{clearing ? '⟳' : '✕'}</span>
                  {clearing ? 'CLEARING...' : 'CLEAR ALL'}
                </button>
              )}
            </div>
          </div>

          {/* Attack scan overlay during simulation */}
          <div className="relative">
            {simulating && (
              <div
                className="absolute inset-x-0 top-0 h-px bg-purple-400/60 z-10 pointer-events-none"
                style={{ animation: 'attackScanDown 2s linear infinite' }}
              />
            )}

            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <div className="text-2xl opacity-20">🛡</div>
                <div className="text-[10px] text-white/20 tracking-widest">NO THREATS DETECTED</div>
                <div className="text-[9px] text-white/10 tracking-wider mt-1">Open the Attack Configuration panel and click &quot;LAUNCH ATTACK&quot;</div>
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
                          <span className={`text-[10px] font-bold tracking-wide ${ev.details?.mitigated ? 'text-white/40 line-through' : meta.color}`}>{meta.label}</span>
                          {ev.details?.mitigated ? (
                             <span className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 border border-purple-500/40 bg-purple-500/10 text-purple-400">
                               DEFENSE ACTIVE: BLOCKED
                             </span>
                          ) : (
                            <span className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 border ${
                              risk.label === 'CRITICAL' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                              risk.label === 'HIGH'     ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' :
                              risk.label === 'MEDIUM'   ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' :
                                                          'border-green-500/40 bg-green-500/10 text-green-400'
                            }`}>{risk.label}</span>
                          )}
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
                            {Object.entries(ev.details).slice(0, 3).map(([k, v]) => (
                              <span key={k} className="mr-3">{k}: <span className="text-white/35">{String(v)}</span></span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right side - Actions */}
                      <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
                        {ev.details?.mitigated ? (
                          <div className="text-[10px] text-purple-400/60 font-medium tracking-widest border border-purple-500/20 px-2 py-0.5 mt-0.5">
                            MITIGATED
                          </div>
                        ) : (
                          <RiskBar score={ev.risk_score} />
                        )}
                        
                        <div className="flex gap-1 mt-auto">
                          {!ev.details?.mitigated && ev.risk_score >= 65 && (
                            <button
                              onClick={() => handleQuickBlock('ip', ev.ip_address)}
                              className="px-2 py-1 text-[9px] text-red-400/80 font-bold border border-red-500/30 hover:bg-red-500/10 transition-all tracking-widest"
                              title="Instantly block this IP address"
                            >
                              BLOCK IP
                            </button>
                          )}
                          <button
                            onClick={() => setAnalysisEvent(ev)}
                            className="px-2 py-1 text-[9px] text-purple-400/60 border border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/40 transition-all tracking-widest"
                          >
                            ⚡ ANALYSE
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

        {/* ── Attack type breakdown ──────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="border border-white/[0.07] bg-white/[0.01] p-4">
            <div className="text-[9px] text-white/20 tracking-[0.2em] mb-3">ATTACK VECTOR BREAKDOWN</div>
            <div className="space-y-2">
              {ALL_ATTACK_TYPES.map((type) => {
                const meta = EVENT_META[type];
                const count = events.filter(e => e.event_type === type).length;
                const pct = events.length > 0 ? (count / events.length) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-40 flex-shrink-0">
                      <span className="text-[11px]">{meta.icon}</span>
                      <span className={`text-[9px] ${meta.color} tracking-wider`}>{meta.label}</span>
                    </div>
                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'currentColor' }}
                      />
                    </div>
                    <div className="text-[9px] tabular-nums w-8 text-right text-white/30">{count}</div>
                  </div>
                );
              })}
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

      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes attackScanX {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes attackScanDown {
          0%   { top: 0; }
          100% { top: 100%; }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid rgba(168, 85, 247, 0.6);
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid rgba(168, 85, 247, 0.6);
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
        }
      `}</style>
    </>
  );
}

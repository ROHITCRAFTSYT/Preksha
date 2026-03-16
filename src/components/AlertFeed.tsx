'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Alert {
  id: string;
  event_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400',    bg: 'border-red-500/40 bg-red-500/10' },
  high:     { color: 'text-orange-400', bg: 'border-orange-500/40 bg-orange-500/10' },
  medium:   { color: 'text-yellow-400', bg: 'border-yellow-500/40 bg-yellow-500/10' },
  low:      { color: 'text-green-400',  bg: 'border-green-500/40 bg-green-500/10' },
  info:     { color: 'text-blue-400',   bg: 'border-blue-500/40 bg-blue-500/10' },
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  new:            { color: 'text-red-400',    label: 'NEW' },
  acknowledged:   { color: 'text-yellow-400', label: 'ACK' },
  investigating:  { color: 'text-blue-400',   label: 'INVEST.' },
  resolved:       { color: 'text-green-400',  label: 'RESOLVED' },
  false_positive: { color: 'text-white/30',   label: 'FALSE +' },
};

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAlerts(data as Alert[]);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('rt-sec-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_alerts' }, () => loadAlerts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAlerts]);

  // Auto-generate alerts from recent events that don't have alerts yet
  const autoGenerateAlerts = useCallback(async () => {
    setCreating(true);
    try {
      // Get recent events
      const { data: events } = await supabase
        .from('security_events')
        .select('id, event_type, risk_score, ip_address, details')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!events || events.length === 0) return;

      // Get existing alert event IDs
      const { data: existing } = await supabase
        .from('security_alerts')
        .select('event_id');
      const existingIds = new Set((existing ?? []).map(a => a.event_id));

      // Create alerts for events without one
      const newEvents = events.filter(e => !existingIds.has(e.id));
      if (newEvents.length === 0) return;

      await Promise.all(newEvents.slice(0, 10).map(e =>
        fetch('/api/security-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e),
        })
      ));
      await loadAlerts();
    } finally {
      setCreating(false);
    }
  }, [loadAlerts]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await fetch('/api/security-alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadAlerts();
  }, [loadAlerts]);

  const createIncidentFromSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const selectedAlerts = alerts.filter(a => selected.has(a.id));
    const maxSeverity = selectedAlerts.some(a => a.severity === 'critical') ? 'critical'
      : selectedAlerts.some(a => a.severity === 'high') ? 'high' : 'medium';

    await fetch('/api/security-incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Incident — ${selectedAlerts.length} related alerts`,
        description: `Auto-created from ${selectedAlerts.length} selected alerts`,
        severity: maxSeverity,
        alert_ids: [...selected],
      }),
    });
    setSelected(new Set());
    await loadAlerts();
  }, [selected, alerts, loadAlerts]);

  const filteredAlerts = alerts.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
    return true;
  });

  const newCount = alerts.filter(a => a.status === 'new').length;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">SECURITY OPERATIONS</div>
          <h2 className="text-sm font-bold text-white/80 tracking-wide">Alert Feed</h2>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 bg-red-500/90 text-white font-bold">{newCount} NEW</span>
          )}
          <button
            onClick={autoGenerateAlerts}
            disabled={creating}
            className={`px-3 py-1.5 text-[10px] border transition-all ${creating ? 'border-purple-500/40 text-purple-400 animate-pulse' : 'border-purple-500/30 text-purple-400/60 hover:text-purple-400 hover:border-purple-500/50'}`}
          >
            {creating ? '⟳ GENERATING...' : '⚡ AUTO-GENERATE ALERTS'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-1">
          <span className="text-[8px] text-white/20 tracking-widest self-center mr-1">STATUS</span>
          {['all', 'new', 'acknowledged', 'investigating', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2 py-1 text-[9px] tracking-widest border rounded-[2px] transition-all ${filter === s ? 'bg-white/[0.08] text-white border-white/25' : 'text-white/25 border-white/[0.06] hover:text-white/50'}`}>
              {s === 'all' ? 'ALL' : STATUS_STYLE[s]?.label ?? s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="text-[8px] text-white/20 tracking-widest self-center mr-1">SEVERITY</span>
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setSevFilter(s)} className={`px-2 py-1 text-[9px] tracking-widest border rounded-[2px] transition-all ${sevFilter === s ? 'bg-white/[0.08] text-white border-white/25' : 'text-white/25 border-white/[0.06] hover:text-white/50'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 border border-purple-500/20 bg-purple-500/[0.04]">
          <span className="text-[10px] text-purple-400 font-bold">{selected.size} SELECTED</span>
          <button onClick={createIncidentFromSelected} className="px-3 py-1 text-[9px] border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors tracking-widest">
            📋 CREATE INCIDENT
          </button>
          <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-[9px] text-white/30 hover:text-white/60 transition-colors">CLEAR</button>
        </div>
      )}

      {/* Alert list */}
      <div className="border border-white/[0.07] bg-white/[0.01] divide-y divide-white/[0.04]">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="text-2xl opacity-15">🔔</div>
            <div className="text-[10px] text-white/20 tracking-widest">NO ALERTS</div>
            <div className="text-[9px] text-white/10">Click &quot;AUTO-GENERATE ALERTS&quot; to create from recent events</div>
          </div>
        ) : filteredAlerts.map(alert => {
          const sev = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.medium;
          const st = STATUS_STYLE[alert.status] ?? STATUS_STYLE.new;
          const isSelected = selected.has(alert.id);

          return (
            <div key={alert.id} className={`px-4 py-3 transition-colors ${isSelected ? 'bg-purple-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => setSelected(prev => { const n = new Set(prev); n.has(alert.id) ? n.delete(alert.id) : n.add(alert.id); return n; })}
                  className={`mt-1 w-3.5 h-3.5 border flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-purple-400 bg-purple-500/30' : 'border-white/15 hover:border-white/30'}`}
                >
                  {isSelected && <span className="text-[8px] text-purple-400">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 border ${sev.bg} ${sev.color}`}>{alert.severity.toUpperCase()}</span>
                    <span className={`text-[8px] tracking-widest ${st.color}`}>● {st.label}</span>
                    <span className="text-[10px] text-white/60 font-medium">{alert.title}</span>
                  </div>
                  <div className="text-[9px] text-white/30 mt-1">{alert.description}</div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {alert.mitre_tactic && (
                      <span className="text-[8px] text-purple-400/50 border border-purple-500/20 px-1.5 py-0.5">{alert.mitre_tactic}</span>
                    )}
                    {alert.mitre_technique && (
                      <span className="text-[8px] text-blue-400/50 border border-blue-500/20 px-1.5 py-0.5">{alert.mitre_technique}</span>
                    )}
                    <span className="text-[9px] text-white/20">{timeAgo(alert.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {alert.status === 'new' && (
                    <button onClick={() => updateStatus(alert.id, 'acknowledged')} className="px-2 py-1 text-[8px] border border-yellow-500/30 text-yellow-400/60 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all tracking-widest">ACK</button>
                  )}
                  {(alert.status === 'new' || alert.status === 'acknowledged') && (
                    <button onClick={() => updateStatus(alert.id, 'investigating')} className="px-2 py-1 text-[8px] border border-blue-500/30 text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all tracking-widest">INVEST.</button>
                  )}
                  {alert.status !== 'resolved' && alert.status !== 'false_positive' && (
                    <button onClick={() => updateStatus(alert.id, 'resolved')} className="px-2 py-1 text-[8px] border border-green-500/30 text-green-400/60 hover:text-green-400 hover:bg-green-500/10 transition-all tracking-widest">RESOLVE</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

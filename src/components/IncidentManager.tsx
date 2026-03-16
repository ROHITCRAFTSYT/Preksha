'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  alert_ids: string[];
  owner: string | null;
  timeline: { status: string; timestamp: string; note: string }[];
  playbook_id: string | null;
  created_at: string;
  closed_at: string | null;
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

const STATUS_PIPELINE = ['open', 'investigating', 'mitigated', 'closed'] as const;

const STATUS_META: Record<string, { color: string; icon: string }> = {
  open:          { color: 'text-red-400',    icon: '🔴' },
  investigating: { color: 'text-blue-400',   icon: '🔵' },
  mitigated:     { color: 'text-yellow-400', icon: '🟡' },
  closed:        { color: 'text-green-400',  icon: '🟢' },
};

const SEV_STYLE: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-400',
  high:     'border-orange-500/40 bg-orange-500/10 text-orange-400',
  medium:   'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  low:      'border-green-500/40 bg-green-500/10 text-green-400',
};

export default function IncidentManager() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    const { data } = await supabase
      .from('security_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setIncidents(data as Incident[]);
  }, []);

  useEffect(() => { loadIncidents(); }, [loadIncidents]);

  useEffect(() => {
    const ch = supabase
      .channel('rt-sec-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_incidents' }, () => loadIncidents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadIncidents]);

  const transitionStatus = useCallback(async (id: string, newStatus: string, note?: string) => {
    await fetch('/api/security-incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus, note }),
    });
    await loadIncidents();
  }, [loadIncidents]);

  const runAnalysis = async (id: string) => {
    setIsAnalyzing(id);
    try {
      const res = await fetch('/api/security-incident-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: id }),
      });
      const data = await res.json();
      if (data.analysis) {
        await transitionStatus(id, incidents.find(i => i.id === id)?.status ?? 'investigating', `AI Analysis: ${data.analysis.substring(0, 50)}...`);
        // We just add it to the timeline by calling transitionStatus with the same status but a new note
      }
    } finally {
      setIsAnalyzing(null);
    }
  };

  const generateReport = async (inc: Incident) => {
    setIsReporting(inc.id);
    try {
      // Create a basic report from timeline
      const content = `
# Incident Report: ${inc.title}
**Severity:** ${inc.severity.toUpperCase()}
**Status:** ${inc.status.toUpperCase()}
**Created:** ${new Date(inc.created_at).toLocaleString()}
**Closed:** ${inc.closed_at ? new Date(inc.closed_at).toLocaleString() : 'N/A'}

## Description
${inc.description || 'No description provided.'}

## Timeline
${inc.timeline.map(t => `- **${new Date(t.timestamp).toLocaleString()}** [${t.status.toUpperCase()}] ${t.note}`).join('\n')}

## Associated Alerts
${inc.alert_ids.length} alerts linked to this incident.

## Post-Incident Actions
*Generated automatically by ResilienceOS SOC.*
      `.trim();

      await fetch('/api/security-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: inc.id,
          title: `PIR: ${inc.title}`,
          content
        }),
      });
      alert('Post-Incident Report generated successfully. Check the Reports tab.');
    } finally {
      setIsReporting(null);
    }
  };

  const filtered = incidents.filter(i => statusFilter === 'all' || i.status === statusFilter);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">SECURITY OPERATIONS</div>
          <h2 className="text-sm font-bold text-white/80 tracking-wide">Incident Manager</h2>
        </div>
        <div className="flex items-center gap-2">
          {incidents.filter(i => i.status === 'open').length > 0 && (
            <span className="text-[9px] px-2 py-0.5 bg-red-500/90 text-white font-bold">
              {incidents.filter(i => i.status === 'open').length} OPEN
            </span>
          )}
        </div>
      </div>

      {/* Status pipeline overview */}
      <div className="grid grid-cols-4 gap-2">
        {STATUS_PIPELINE.map(status => {
          const count = incidents.filter(i => i.status === status).length;
          const m = STATUS_META[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-3 border transition-all ${statusFilter === status ? 'border-white/25 bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'}`}
            >
              <div className="text-[8px] text-white/20 tracking-[0.2em]">{status.toUpperCase()}</div>
              <div className={`text-xl font-bold tabular-nums mt-1 ${m.color}`}>{count}</div>
            </button>
          );
        })}
      </div>

      {/* Incident list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="border border-white/[0.07] p-12 text-center">
            <div className="text-2xl opacity-15 mb-2">📋</div>
            <div className="text-[10px] text-white/20 tracking-widest">NO INCIDENTS</div>
            <div className="text-[9px] text-white/10 mt-1">Create incidents from the Alerts tab by selecting alerts and clicking &quot;CREATE INCIDENT&quot;</div>
          </div>
        ) : filtered.map(inc => {
          const isExpanded = expandedId === inc.id;
          const m = STATUS_META[inc.status] ?? STATUS_META.open;
          const currentIdx = STATUS_PIPELINE.indexOf(inc.status as typeof STATUS_PIPELINE[number]);
          const nextStatus = currentIdx < STATUS_PIPELINE.length - 1 ? STATUS_PIPELINE[currentIdx + 1] : null;

          return (
            <div key={inc.id} className="border border-white/[0.07] bg-white/[0.01] transition-colors">
              <button
                onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[14px]">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 border ${SEV_STYLE[inc.severity] ?? SEV_STYLE.medium}`}>{inc.severity.toUpperCase()}</span>
                    <span className="text-[10px] text-white/60 font-medium truncate">{inc.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-white/25">
                    <span>{inc.alert_ids.length} alert{inc.alert_ids.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{timeAgo(inc.created_at)}</span>
                    {inc.owner && <><span>·</span><span>{inc.owner}</span></>}
                  </div>
                </div>
                <span className={`text-[9px] tracking-widest ${m.color}`}>{inc.status.toUpperCase()}</span>
                <span className={`text-[9px] text-white/20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-3">
                  {inc.description && (
                    <p className="text-[10px] text-white/40">{inc.description}</p>
                  )}

                  {/* Status pipeline visual */}
                  <div className="flex items-center gap-1">
                    {STATUS_PIPELINE.map((s, i) => {
                      const isPast = i <= currentIdx;
                      const isCurrent = s === inc.status;
                      return (
                        <div key={s} className="flex items-center gap-1 flex-1">
                          <div className={`w-full h-1 rounded-full ${isPast ? 'bg-purple-500' : 'bg-white/[0.08]'}`} />
                          {i < STATUS_PIPELINE.length - 1 && <div className="w-0.5" />}
                          {isCurrent && <span className="text-[7px] text-purple-400 tracking-widest whitespace-nowrap">{s.toUpperCase()}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Timeline */}
                  <div>
                    <div className="text-[8px] text-white/20 tracking-[0.2em] mb-2">TIMELINE</div>
                    <div className="space-y-1.5 pl-3 border-l border-white/[0.08]">
                      {(inc.timeline as { status: string; timestamp: string; note: string }[]).map((entry, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full -ml-[9px] ${STATUS_META[entry.status]?.color.replace('text-', 'bg-') ?? 'bg-white/30'}`} />
                          <span className={`text-[9px] ${STATUS_META[entry.status]?.color ?? 'text-white/40'} tracking-wider`}>{entry.status.toUpperCase()}</span>
                          <span className="text-[9px] text-white/20">{entry.note}</span>
                          <span className="text-[8px] text-white/15 ml-auto">{timeAgo(entry.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI & Reporting Actions */}
                  <div className="flex gap-2 pt-2 mt-2 border-t border-white/[0.05]">
                    {inc.status !== 'closed' && (
                      <button
                        onClick={() => runAnalysis(inc.id)}
                        disabled={isAnalyzing === inc.id}
                        className="px-3 py-1.5 text-[9px] font-bold tracking-widest border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                      >
                        {isAnalyzing === inc.id ? 'ANALYZING...' : '✨ AI ANALYSE'}
                      </button>
                    )}
                    {inc.status === 'closed' && (
                      <button
                        onClick={() => generateReport(inc)}
                        disabled={isReporting === inc.id}
                        className="px-3 py-1.5 text-[9px] font-bold tracking-widest border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                      >
                        {isReporting === inc.id ? 'GENERATING...' : '📄 GENERATE PIR'}
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  {nextStatus && (
                    <div className="flex gap-2 mt-2">
                       <button
                        onClick={() => transitionStatus(inc.id, nextStatus)}
                        className="px-4 py-2 text-[10px] font-bold tracking-widest border border-purple-500/40 text-purple-400 bg-purple-500/[0.05] hover:bg-purple-500/10 transition-colors"
                      >
                        → TRANSITION TO {nextStatus.toUpperCase()}
                      </button>
                      <button
                        onClick={() => {
                          const ip = prompt('Enter IP or User ID to block:');
                          if(ip) {
                            fetch('/api/security-defenses', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ target_type: ip.includes('.') ? 'ip' : 'user', target_value: ip, action: 'block' })
                            }).then(() => alert('Defense rule created. Check Defenses tab.'));
                          }
                        }}
                        className="px-3 py-2 text-[10px] tracking-widest border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                      >
                        🛡 QUICK BLOCK
                      </button>
                      {inc.status !== 'closed' && (
                        <button
                          onClick={() => transitionStatus(inc.id, 'closed', 'Incident closed')}
                          className="px-3 py-2 text-[10px] tracking-widest border border-white/10 text-white/30 hover:text-green-400 hover:border-green-500/40 transition-colors"
                        >
                          ✓ CLOSE
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';
import type { GovService } from '@/lib/services';

// ─── Incident shape — supports both live DB incidents and derived ones ─────────
export interface Incident {
  id: string;
  /** serviceName (from DB) or service (legacy derived) */
  serviceName?: string;
  service?: string;
  type: 'outage' | 'degraded' | 'restored' | 'chaos';
  message: string;
  timestamp: number;
  resolved?: boolean;
  timeAgo?: string; // pre-computed for DB incidents
}

interface IncidentFeedProps {
  services: GovService[];
  incidents: Incident[];
}

// ─── Derive incidents from current service state (used as offline fallback) ──
// Priority order: outage > chaos > degraded, then stable by service name
const TYPE_PRIORITY = { outage: 0, chaos: 1, degraded: 2, restored: 3 };

export function generateIncidents(services: GovService[]): Incident[] {
  const incidents: Incident[] = [];
  services.forEach((s) => {
    if (s.status === 'outage') {
      incidents.push({
        id: `${s.id}-outage`,
        serviceName: s.name,
        type: 'outage',
        message: `${s.name} is experiencing a complete outage. ${s.fallbacks.length} fallback routes available.`,
        timestamp: 1, // stable non-zero; timeAgo overridden below
        timeAgo: 'just now',
      });
    }
    if (s.status === 'degraded') {
      incidents.push({
        id: `${s.id}-degraded`,
        serviceName: s.name,
        type: 'degraded',
        message: `${s.name} is responding slowly (${Math.round(s.latency)}ms). Investigating root cause.`,
        timestamp: 1,
        timeAgo: 'just now',
      });
    }
    if (s.chaosActive) {
      incidents.push({
        id: `${s.id}-chaos`,
        serviceName: s.name,
        type: 'chaos',
        message: `CHAOS INJECTION active on ${s.name}. Resilience test in progress.`,
        timestamp: 1,
        timeAgo: 'just now',
      });
    }
  });
  // Stable sort: by type priority first, then by service name (alphabetical)
  return incidents.sort((a, b) =>
    (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9) ||
    (a.serviceName ?? '').localeCompare(b.serviceName ?? '')
  );
}

// ─── Type display config ───────────────────────────────────────────────────────
const typeConfig = {
  outage:   { color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/5',    icon: '✕', label: 'OUTAGE'    },
  degraded: { color: 'text-yellow-400', border: 'border-yellow-400/30', bg: 'bg-yellow-400/5', icon: '⚠', label: 'DEGRADED'  },
  restored: { color: 'text-green-400',  border: 'border-green-400/30',  bg: 'bg-green-400/5',  icon: '✓', label: 'RESTORED'  },
  chaos:    { color: 'text-purple-400', border: 'border-purple-400/30', bg: 'bg-purple-400/5', icon: '⚡', label: 'CHAOS'    },
};

function timeAgoFromTs(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function IncidentFeed({ services, incidents }: IncidentFeedProps) {
  // If no DB incidents passed, fall back to deriving from service state
  const list = incidents.length > 0 ? incidents : generateIncidents(services);

  if (list.length === 0) {
    return (
      <div className="font-mono border border-white/10 p-6 text-center">
        <div className="text-green-400 text-base mb-2">✓</div>
        <div className="text-white/50 text-xs tracking-widest">NO ACTIVE INCIDENTS</div>
        <div className="text-white/20 text-[10px] mt-1">All services operating normally</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 font-mono">
      {list.slice(0, 10).map((incident) => {
        const cfg = typeConfig[incident.type] ?? typeConfig.outage;
        const displayTime = incident.timeAgo ?? timeAgoFromTs(incident.timestamp);
        const isResolved = incident.resolved;
        return (
          <div
            key={incident.id}
            className={`border ${cfg.border} ${cfg.bg} p-3.5 flex gap-3 ${isResolved ? 'opacity-50' : ''}`}
          >
            <div className={`flex-shrink-0 text-xs ${cfg.color} mt-0.5`}>{cfg.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>
                  {cfg.label}
                  {isResolved && <span className="text-white/30 font-normal ml-1">· RESOLVED</span>}
                </span>
                <span className="text-[9px] text-white/30">{displayTime}</span>
              </div>
              <p className="text-[10px] text-white/55 mt-1 leading-relaxed">{incident.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

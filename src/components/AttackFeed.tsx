'use client';

import { useMemo } from 'react';

export interface SecurityEvent {
  id: string;
  event_type: string;
  ip_address: string;
  risk_score: number;
  created_at: string;
  details: {
    endpoint?: string;
    payload?: string;
    status?: 'detected' | 'blocked';
  };
}

export default function AttackFeed({ events, onSelectEvent }: { events: SecurityEvent[]; onSelectEvent: (e: SecurityEvent) => void }) {
  
  const displayEvents = useMemo(() => {
    return events.slice(0, 15);
  }, [events]);

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] text-white/50 tracking-[0.2em] font-bold">LIVE ATTACK FEED</h3>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-red-500/80 tracking-widest">MONITORING</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
        {displayEvents.length === 0 ? (
          <div className="text-[10px] text-white/20 text-center py-8 tracking-widest">No active threats detected.</div>
        ) : (
          displayEvents.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSelectEvent(evt)}
              className="w-full text-left bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all p-3 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold tracking-widest ${evt.risk_score >= 80 ? 'text-red-400' : evt.risk_score >= 50 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {evt.event_type.toUpperCase().replace(/_/g, ' ')}
                  </span>
                  {evt.details?.status === 'blocked' && (
                    <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 ml-2">BLOCKED</span>
                  )}
                </div>
                <span className="text-[9px] text-white/30 truncate max-w-[80px]">
                  {new Date(evt.created_at).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-end justify-between mt-2">
                <div className="space-y-0.5">
                  <div className="text-[9px] text-white/50 font-mono"><span className="text-white/20">SRC:</span> {evt.ip_address}</div>
                  {evt.details?.endpoint && (
                    <div className="text-[9px] text-white/50 font-mono truncate max-w-[180px]"><span className="text-white/20">TGT:</span> {evt.details.endpoint}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-white/20 tracking-widest mb-[1px]">RISK SCORE</div>
                  <div className={`text-lg font-bold tabular-nums leading-none ${evt.risk_score >= 80 ? 'text-red-400' : evt.risk_score >= 50 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {evt.risk_score}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

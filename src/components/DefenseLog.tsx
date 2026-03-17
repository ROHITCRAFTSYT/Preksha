'use client';

import { SecurityEvent } from './AttackFeed';

export default function DefenseLog({ events }: { events: SecurityEvent[] }) {
  const autoBlockedEvents = events.filter((e) => e.details?.status === 'blocked').slice(0, 10);

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] p-4 flex flex-col h-[280px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] text-white/50 tracking-[0.2em] font-bold">AUTO-RESPONSE LOG</h3>
        <div className="text-[9px] text-green-400/80 tracking-widest border border-green-500/30 px-2 py-0.5 bg-green-500/10">
          SYSTEM ACTIVE
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {autoBlockedEvents.length === 0 ? (
          <div className="text-[10px] text-white/20 text-center py-8 tracking-widest">No automated actions taken yet.</div>
        ) : (
          autoBlockedEvents.map((evt) => (
            <div key={evt.id} className="text-[10px] border border-white/[0.04] p-2 flex items-start gap-3 bg-white/[0.01]">
              <span className="text-white/30 tracking-widest whitespace-nowrap">
                {new Date(evt.created_at).toLocaleTimeString()}
              </span>
              <span className="text-orange-400 font-bold whitespace-nowrap">ACTION: BLOCK IP</span>
              <span className="text-white/50 font-mono flex-1">{evt.ip_address}</span>
              <span className="text-white/30 truncate max-w-[120px]">
                Reason: {evt.event_type.replace(/_/g, ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

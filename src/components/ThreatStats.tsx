'use client';

import { SecurityEvent } from './AttackFeed';

export default function ThreatStats({ events }: { events: SecurityEvent[] }) {
  const activeThreats = events.length;
  const highRisk = events.filter((e) => e.risk_score >= 80).length;
  const blockedIps = new Set(events.filter((e) => e.details?.status === 'blocked').map((e) => e.ip_address)).size;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-[#0a0a0a] border border-white/[0.08] p-4 flex flex-col justify-between group hover:border-white/20 transition-all cursor-default">
        <div className="text-[10px] text-white/50 tracking-[0.2em] font-bold mb-2">ACTIVE THREATS</div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-bold tabular-nums leading-none text-white/90">
            {activeThreats}
          </div>
          <div className="text-[9px] text-white/40 mb-1">IN LAST HOUR</div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-red-500/30 p-4 flex flex-col justify-between group hover:border-red-500/50 transition-all cursor-default relative overflow-hidden">
        <div className="absolute inset-0 bg-red-500/[0.03] pointer-events-none" />
        <div className="text-[10px] text-red-500/60 tracking-[0.2em] font-bold mb-2">HIGH RISK (≥80)</div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-bold tabular-nums leading-none text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            {highRisk}
          </div>
          <div className="text-[9px] text-red-400/50 mb-1">CRITICAL EVENTS</div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-orange-500/30 p-4 flex flex-col justify-between group hover:border-orange-500/50 transition-all cursor-default relative overflow-hidden">
        <div className="absolute inset-0 bg-orange-500/[0.03] pointer-events-none" />
        <div className="text-[10px] text-orange-500/60 tracking-[0.2em] font-bold mb-2">AUTO-BLOCKED IPS</div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-bold tabular-nums leading-none text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]">
            {blockedIps}
          </div>
          <div className="text-[9px] text-orange-400/50 mb-1">DEFENSE ACTIVE</div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AttackFeed, { SecurityEvent } from '@/components/AttackFeed';
import ThreatStats from '@/components/ThreatStats';
import AIAnalysisPanel from '@/components/AIAnalysisPanel';
import DefenseLog from '@/components/DefenseLog';

export default function SecurityLabDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load initial events
  useEffect(() => {
    supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setEvents(data as SecurityEvent[]);
      });
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('security_events_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, (payload) => {
        setEvents((prev) => [payload.new as SecurityEvent, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSimulateAttack = useCallback(async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/simulate-attack', { method: 'POST' });
    } finally {
      setIsSimulating(false);
    }
  }, []);

  return (
    <div className="h-screen bg-[#070707] text-white font-mono flex flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-white/[0.07] bg-[#0a0a0a]/95 backdrop-blur-sm px-5 h-[52px] flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-white/30 hover:text-white/60 text-[10px] tracking-widest transition-colors hidden sm:inline">
            ← DASHBOARD
          </Link>
          <div className="hidden sm:block w-px h-3.5 bg-white/10" />
          <div className="font-bold text-sm tracking-widest italic -skew-x-6">
            RESILIENCE<span className="text-blue-400">OS</span>
          </div>
          <span className="text-white/[0.15] text-xs">/</span>
          <span className="text-white/25 text-[10px] tracking-widest">SECURITY LAB</span>
        </div>

        <button
          onClick={handleSimulateAttack}
          disabled={isSimulating}
          className="px-3 py-1.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/40 hover:border-red-500/80 transition-all disabled:opacity-50"
        >
          {isSimulating ? 'SIMULATING...' : '⚡ START ATTACK SIMULATION'}
        </button>
      </header>

      {/* ── Main Layout ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
        {/* Top row: Stats */}
        <ThreatStats events={events} />

        {/* Next row: Feed and AI Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 h-[440px]">
          <AttackFeed events={events} onSelectEvent={setSelectedEvent} />
          <AIAnalysisPanel selectedEvent={selectedEvent} />
        </div>

        {/* Last row: Logging */}
        <DefenseLog events={events} />
      </div>
    </div>
  );
}

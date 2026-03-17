'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AttackFeed, { SecurityEvent } from '@/components/AttackFeed';
import ThreatStats from '@/components/ThreatStats';
import AIAnalysisPanel from '@/components/AIAnalysisPanel';
import DefenseLog from '@/components/DefenseLog';
import InteractiveHoneypot from '@/components/InteractiveHoneypot';
import CredentialVault from '@/components/CredentialVault';

export default function SecurityLabDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load initial events and fallback polling
  useEffect(() => {
    const fetchEvents = () => {
      supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          if (data) setEvents(data as SecurityEvent[]);
        });
    };

    fetchEvents(); // Initial load
    const interval = setInterval(fetchEvents, 2000); // Polling completely bypasses Realtime setup requirements
    return () => clearInterval(interval);
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
    <div className="min-h-screen bg-[#050505] text-white p-6 space-y-6">
      {/* Top Header & Defense Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white/90">SECURITY LAB</h1>
          <p className="text-[11px] text-white/40 tracking-[0.2em] uppercase mt-1">Advanced Threat Simulation & Auto-Remediation</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] text-red-400 font-bold tracking-widest leading-tight uppercase">Defense Status</span>
              <span className="text-[12px] text-red-200 font-bold tabular-nums">LIVE MONITORING ACTIVE</span>
            </div>
          </div>
          <button 
            onClick={handleSimulateAttack}
            disabled={isSimulating}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] transition-all flex items-center gap-2"
          >
            {isSimulating ? 'SIMULATION RUNNING' : 'START ATTACK SIMULATION'}
          </button>
        </div>
      </div>

      <ThreatStats events={events} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Row 1: Left - Honeypot, Mid - Feed, Right - AI */}
        <div className="lg:col-span-1 h-[650px]">
          <InteractiveHoneypot />
        </div>
        
        <div className="lg:col-span-1 h-[650px]">
          <AttackFeed events={events} onSelectEvent={setSelectedEvent} />
        </div>

        <div className="lg:col-span-2 h-[650px] space-y-6 flex flex-col">
          <div className="flex-1">
            <AIAnalysisPanel selectedEvent={selectedEvent} />
          </div>
          <div className="h-[300px]">
            <CredentialVault />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2">
           <DefenseLog events={events} />
        </div>
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/[0.08] p-5 flex flex-col justify-center items-center text-center opacity-40">
           <div className="text-2xl mb-2">🛡️</div>
           <div className="text-[10px] tracking-widest text-white/50 font-bold">INTEGRATED WAF ENGINE</div>
           <div className="text-[9px] text-white/30 mt-1 uppercase italic tracking-widest">Aadhaar Shield v2.4 Enabled</div>
        </div>
      </div>
    </div>
  );
}

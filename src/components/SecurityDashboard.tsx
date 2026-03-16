'use client';
import { useState } from 'react';
import CyberThreatMonitor from '@/components/CyberThreatMonitor';
import ThreatOverview from '@/components/ThreatOverview';
import AlertFeed from '@/components/AlertFeed';
import IncidentManager from '@/components/IncidentManager';
import PlaybookViewer from '@/components/PlaybookViewer';
import ThreatTaxonomy from '@/components/ThreatTaxonomy';
import ActiveDefenses from '@/components/ActiveDefenses';
import ReportViewer from '@/components/ReportViewer';
import LiveThreatModal from '@/components/LiveThreatModal';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

type SecurityTab = 'overview' | 'monitor' | 'alerts' | 'incidents' | 'defenses' | 'reports' | 'playbooks' | 'taxonomy';

const TABS: { id: SecurityTab; label: string; icon: string }[] = [
  { id: 'overview',  label: 'OVERVIEW',  icon: '◎' },
  { id: 'monitor',   label: 'MONITOR',   icon: '⚡' },
  { id: 'alerts',    label: 'ALERTS',    icon: '🔔' },
  { id: 'incidents', label: 'INCIDENTS', icon: '📋' },
  { id: 'defenses',  label: 'DEFENSES',  icon: '🛡' },
  { id: 'reports',   label: 'REPORTS',   icon: '📄' },
  { id: 'playbooks', label: 'PLAYBOOKS', icon: '📖' },
  { id: 'taxonomy',  label: 'TAXONOMY',  icon: '🔬' },
];

export default function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview');
  const [meanRisk, setMeanRisk] = useState<number>(0);
  const [criticalEvent, setCriticalEvent] = useState<any | null>(null);

  useEffect(() => {
    // Initial fetch for mean risk
    async function fetchStats() {
      const { data } = await supabase.from('security_events').select('risk_score').order('created_at', { ascending: false }).limit(20);
      if (data && data.length > 0) {
        setMeanRisk(Math.round(data.reduce((a, b) => a + Number(b.risk_score), 0) / data.length));
      }
    }
    fetchStats();

    // Global listener for DEFCON 1 and Critical Modals
    const channel = supabase
      .channel('global-sec-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, async (payload) => {
        const ev = payload.new;
        
        // Recalculate mean risk
        const { data } = await supabase.from('security_events').select('risk_score').order('created_at', { ascending: false }).limit(20);
        if (data && data.length > 0) {
          setMeanRisk(Math.round(data.reduce((a, b) => a + Number(b.risk_score), 0) / data.length));
        }

        // Show instant defense modal for critical unmitigated attacks
        if (ev.risk_score >= 85 && !ev.details?.mitigated) {
          setCriticalEvent(ev);
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleBlock = async (targetType: string, targetValue: string) => {
    try {
      await fetch('/api/security-defenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_value: targetValue, action: 'block' }),
      });
    } catch (err) {
      console.error('Failed to quick block', err);
    }
  };

  const isDefcon1 = meanRisk > 80;

  return (
    <div className={`space-y-4 transition-all duration-1000 ${isDefcon1 ? 'ring-2 ring-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.15)] bg-red-500/[0.02] p-2 rounded-xl' : ''}`}>
      {isDefcon1 && (
        <div className="absolute top-0 inset-x-0 h-1 bg-red-500/50 animate-pulse z-50"></div>
      )}
      
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b border-white/[0.07] pb-0.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-widest transition-all relative whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-purple-400'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            <span className="text-[11px]">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-px bg-purple-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={isDefcon1 ? 'px-2 pb-2' : ''}>
        {activeTab === 'overview' && <ThreatOverview />}
        {activeTab === 'monitor' && <CyberThreatMonitor />}
        {activeTab === 'alerts' && <AlertFeed />}
        {activeTab === 'incidents' && <IncidentManager />}
        {activeTab === 'defenses' && <ActiveDefenses />}
        {activeTab === 'reports' && <ReportViewer />}
        {activeTab === 'playbooks' && <PlaybookViewer />}
        {activeTab === 'taxonomy' && <ThreatTaxonomy />}
      </div>

      <LiveThreatModal 
        event={criticalEvent} 
        onClose={() => setCriticalEvent(null)} 
        onBlock={handleBlock} 
      />
    </div>
  );
}

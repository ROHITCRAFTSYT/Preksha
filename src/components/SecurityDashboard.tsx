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

  return (
    <div className="space-y-4">
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
      {activeTab === 'overview' && <ThreatOverview />}
      {activeTab === 'monitor' && <CyberThreatMonitor />}
      {activeTab === 'alerts' && <AlertFeed />}
      {activeTab === 'incidents' && <IncidentManager />}
      {activeTab === 'defenses' && <ActiveDefenses />}
      {activeTab === 'reports' && <ReportViewer />}
      {activeTab === 'playbooks' && <PlaybookViewer />}
      {activeTab === 'taxonomy' && <ThreatTaxonomy />}
    </div>
  );
}

'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlaybookStep {
  order: number;
  title: string;
  description: string;
}

interface Playbook {
  id: string;
  title: string;
  attack_type: string;
  severity_range: string;
  description: string;
  steps: PlaybookStep[];
  mitre_tactics: string[];
  estimated_time_minutes: number;
}

const ATTACK_ICONS: Record<string, string> = {
  brute_force_login: '🔨',
  document_download: '📥',
  token_hijack_attempt: '🔑',
  api_abuse: '⚡',
  suspicious_login: '👤',
};

const ATTACK_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  brute_force_login:    { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/[0.04]' },
  document_download:    { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/[0.04]' },
  token_hijack_attempt: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/[0.04]' },
  api_abuse:            { text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/[0.04]' },
  suspicious_login:     { text: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/[0.04]' },
};

export default function PlaybookViewer() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPlaybooks = useCallback(async () => {
    try {
      const res = await fetch('/api/security-playbooks');
      const data = await res.json();
      setPlaybooks(data.playbooks ?? []);
    } catch {
      setPlaybooks([]);
    }
  }, []);

  useEffect(() => { loadPlaybooks(); }, [loadPlaybooks]);

  return (
    <div className="space-y-4 pb-8">
      <div>
        <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">DEFENSIVE OPERATIONS</div>
        <h2 className="text-sm font-bold text-white/80 tracking-wide">Remediation Playbooks</h2>
        <p className="text-[10px] text-white/25 mt-1">Step-by-step response procedures for each attack type. Apply to active incidents or use for training.</p>
      </div>

      <div className="space-y-2">
        {playbooks.map(pb => {
          const isExpanded = expandedId === pb.id;
          const colors = ATTACK_COLORS[pb.attack_type] ?? { text: 'text-white/60', border: 'border-white/15', bg: 'bg-white/[0.02]' };
          const icon = ATTACK_ICONS[pb.attack_type] ?? '📖';

          return (
            <div key={pb.id} className={`border ${colors.border} ${colors.bg} transition-colors`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : pb.id)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-[18px] flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${colors.text}`}>{pb.title}</span>
                  </div>
                  <div className="text-[9px] text-white/30 mt-0.5 truncate">{pb.description}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-white/20">{pb.steps.length} steps</div>
                    <div className="text-[9px] text-white/15">~{pb.estimated_time_minutes} min</div>
                  </div>
                  <span className={`text-[9px] text-white/20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-4">
                      {/* MITRE tags */}
                      <div className="flex gap-1.5 flex-wrap">
                        {(pb.mitre_tactics as string[]).map((t, i) => (
                          <span key={i} className="text-[8px] text-purple-400/60 border border-purple-500/20 px-2 py-0.5 tracking-wider">{t}</span>
                        ))}
                        <span className="text-[8px] text-white/20 border border-white/10 px-2 py-0.5 tracking-wider">SEV: {pb.severity_range.toUpperCase()}</span>
                      </div>

                      {/* Steps */}
                      <div className="space-y-0">
                        {(pb.steps as PlaybookStep[]).map((step, i) => (
                          <div key={step.order} className="flex gap-3 group">
                            {/* Step line + dot */}
                            <div className="flex flex-col items-center w-5 flex-shrink-0">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${colors.border} ${colors.text}`}>
                                {step.order}
                              </div>
                              {i < pb.steps.length - 1 && <div className="w-px flex-1 bg-white/[0.08]" />}
                            </div>
                            {/* Content */}
                            <div className="pb-4 flex-1">
                              <div className="text-[10px] text-white/60 font-medium">{step.title}</div>
                              <div className="text-[9px] text-white/30 mt-0.5 leading-relaxed">{step.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                        <span className="text-[9px] text-white/15 tracking-wider">Est. response time: {pb.estimated_time_minutes} minutes</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {playbooks.length === 0 && (
          <div className="border border-white/[0.07] p-12 text-center">
            <div className="text-2xl opacity-15 mb-2">📖</div>
            <div className="text-[10px] text-white/20 tracking-widest">LOADING PLAYBOOKS...</div>
          </div>
        )}
      </div>
    </div>
  );
}

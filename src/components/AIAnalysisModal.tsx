'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, AlertTriangle, Users, Wrench, Clock, MessageSquare, Loader2 } from 'lucide-react';
import type { GovService } from '@/lib/services';
import type { AIAnalysis } from '@/app/api/ai-analyse/route';

interface Props {
  service: GovService;
  incidents: { message: string; created_at: string }[];
  onClose: () => void;
}

const SEVERITY_STYLES = {
  CRITICAL: { label: 'CRITICAL', color: 'text-red-400',    border: 'border-red-500/50',    bg: 'bg-red-500/10',    glow: '#ef4444' },
  HIGH:     { label: 'HIGH',     color: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/8', glow: '#f97316' },
  MEDIUM:   { label: 'MEDIUM',   color: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/8', glow: '#facc15' },
};

export default function AIAnalysisModal({ service, incidents, onClose }: Props) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleSections, setVisibleSections] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetch_analysis() {
      setLoading(true);
      setError(null);
      setAnalysis(null);
      setVisibleSections(0);

      try {
        const res = await fetch('/api/ai-analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: {
              name:      service.name,
              category:  service.category,
              region:    service.region,
              status:    service.status,
              latency:   service.latency,
              uptime:    service.uptime,
              fallbacks: service.fallbacks,
            },
            incidents,
            latencyHistory: service.history.map((h) => h.latency),
          }),
        });

        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }

        const { analysis: a } = await res.json();
        if (cancelled) return;
        setAnalysis(a);

        // Stagger section reveals
        for (let i = 1; i <= 6; i++) {
          await new Promise((r) => setTimeout(r, i * 100));
          if (!cancelled) setVisibleSections(i);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_analysis();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  const sev = analysis ? (SEVERITY_STYLES[analysis.severity] ?? SEVERITY_STYLES.MEDIUM) : null;

  return (
    <motion.div
      key="ai-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        key="ai-panel"
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow behind panel */}
        {sev && (
          <div
            className="absolute -inset-px pointer-events-none rounded-sm"
            style={{ background: `radial-gradient(ellipse at top, ${sev.glow}15 0%, transparent 65%)` }}
          />
        )}

        <div className="border border-white/10 bg-[#070707]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Zap size={12} className="text-green-400" />
              <span className="text-[9px] text-white/40 tracking-[0.3em]">AI INCIDENT ANALYST</span>
              <span className="text-white/15 text-[9px]">·</span>
              <span className="text-[9px] text-white/60 tracking-wider">{service.name.toUpperCase()}</span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 border border-white/10 text-white/30 hover:text-white hover:border-white/30 transition-all"
            >
              <X size={10} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center gap-4 py-10">
                <Loader2 size={20} className="text-green-400 animate-spin" />
                <div className="text-center">
                  <p className="text-[10px] text-white/50 tracking-[0.3em]">ANALYSING INCIDENT DATA</p>
                  <p className="text-[8px] text-white/20 mt-1.5 tracking-wider">
                    Evaluating latency trends · Checking incident history · Generating recommendations
                  </p>
                </div>
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full bg-green-400"
                      style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="border border-red-500/30 bg-red-500/5 p-4 text-center">
                <AlertTriangle size={14} className="text-red-400 mx-auto mb-2" />
                <p className="text-[10px] text-red-400 tracking-wider">{error}</p>
                <p className="text-[8px] text-white/20 mt-1">
                  Ensure GROQ_API_KEY is set in .env.local to enable AI analysis
                </p>
              </div>
            )}

            {/* Analysis */}
            {analysis && sev && (
              <>
                {/* Severity + overview row */}
                <AnimatePresence>
                  {visibleSections >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center justify-between border ${sev.border} ${sev.bg} px-4 py-3`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse ${sev.color}`} />
                        <span className={`text-[10px] font-bold tracking-[0.3em] ${sev.color}`}>
                          {sev.label} SEVERITY
                        </span>
                      </div>
                      <span className="text-[8px] text-white/30 tracking-widest">
                        POWERED BY CLAUDE AI
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Root Cause */}
                <AnimatePresence>
                  {visibleSections >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-[8px] text-white/30 tracking-[0.25em]">
                        <AlertTriangle size={9} />
                        ROOT CAUSE HYPOTHESIS
                      </div>
                      <p className="text-[11px] text-white/80 leading-relaxed pl-4 border-l border-white/10">
                        {analysis.rootCause}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Impact */}
                <AnimatePresence>
                  {visibleSections >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-[8px] text-white/30 tracking-[0.25em]">
                        <Users size={9} />
                        CITIZEN IMPACT
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed pl-4 border-l border-white/10">
                        {analysis.impact}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Recommendations */}
                <AnimatePresence>
                  {visibleSections >= 4 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2 text-[8px] text-white/30 tracking-[0.25em]">
                        <Wrench size={9} />
                        RECOMMENDED ACTIONS
                      </div>
                      <div className="space-y-1.5 pl-4 border-l border-white/10">
                        {analysis.recommendations.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-green-400 text-[9px] mt-0.5 flex-shrink-0">
                              {i + 1}.
                            </span>
                            <p className="text-[11px] text-white/60 leading-relaxed">{r}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ETA */}
                <AnimatePresence>
                  {visibleSections >= 5 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-4 border border-white/8 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-[8px] text-white/30">
                        <Clock size={9} />
                        ESTIMATED RESOLUTION
                      </div>
                      <span className="text-[11px] text-white/70 font-bold">{analysis.estimatedResolution}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Citizen message */}
                <AnimatePresence>
                  {visibleSections >= 6 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-[8px] text-white/30 tracking-[0.25em]">
                        <MessageSquare size={9} />
                        CITIZEN COMMUNICATION
                      </div>
                      <div className="border border-blue-400/20 bg-blue-400/5 px-4 py-3">
                        <p className="text-[11px] text-blue-300/80 leading-relaxed italic">
                          &ldquo;{analysis.citizenMessage}&rdquo;
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

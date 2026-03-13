'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GovService } from '@/lib/services';

interface ChaosPanelProps {
  chaosMode: boolean;
  onToggleChaos: () => void;
  onChaosAll: () => void;
  onRestoreAll: () => void;
  services: GovService[];
  onSimulateOutage: (id: string) => void;
  onRestoreService: (id: string) => void;
}

export default function ChaosPanel({
  chaosMode,
  onToggleChaos,
  onChaosAll,
  onRestoreAll,
  services,
  onSimulateOutage,
  onRestoreService,
}: ChaosPanelProps) {
  const [confirmAll, setConfirmAll] = useState(false);
  const chaosCount = services.filter((s) => s.chaosActive).length;

  // Auto-reset "CONFIRM CHAOS" after 3 seconds if the user doesn't act
  useEffect(() => {
    if (!confirmAll) return;
    const t = setTimeout(() => setConfirmAll(false), 3000);
    return () => clearTimeout(t);
  }, [confirmAll]);

  // Reset confirmAll when chaos mode is turned off
  useEffect(() => {
    if (!chaosMode) setConfirmAll(false);
  }, [chaosMode]);

  return (
    <div
      className={`border font-mono transition-all duration-300 ${
        chaosMode ? 'border-red-500/50 bg-red-950/20' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${chaosMode ? 'text-red-400' : 'text-white/40'}`}>⚡</span>
          <span className={`text-[10px] font-bold tracking-widest ${chaosMode ? 'text-red-400' : 'text-white/40'}`}>
            CHAOS MODE
          </span>
          {chaosMode && (
            <span className="text-[8px] border border-red-500/50 text-red-400 px-1 py-px tracking-widest animate-pulse">
              ACTIVE
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleChaos}
          className={`px-3 py-1 text-[9px] font-bold tracking-widest transition-all duration-200 border ${
            chaosMode
              ? 'border-red-500/60 text-red-400 hover:bg-red-500/20 active:bg-red-500/30'
              : 'border-white/20 text-white/50 hover:bg-white/10 active:bg-white/15'
          }`}
        >
          {chaosMode ? 'DISABLE' : 'ENABLE'}
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="p-3 space-y-3">
        {/* Inactive description */}
        {!chaosMode && (
          <p className="text-[9px] text-white/30 leading-relaxed">
            Simulate random service failures to test system resilience. Enable to inject failures into individual services or run a full infrastructure stress test.
          </p>
        )}

        {/* Active controls — animated in/out */}
        <AnimatePresence initial={false}>
          {chaosMode && (
            <motion.div
              key="chaos-controls"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="space-y-3">
                {/* Warning */}
                <div className="text-[9px] text-red-400/80 leading-relaxed border border-red-500/20 p-2 bg-red-500/5">
                  ⚠ CHAOS ACTIVE — Failures are being simulated and persisted to the database.
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="border border-white/10 p-2">
                    <div className="text-lg font-bold tabular-nums text-red-400">{chaosCount}</div>
                    <div className="text-[8px] text-white/30 tracking-widest">INJECTED</div>
                  </div>
                  <div className="border border-white/10 p-2">
                    <div className="text-lg font-bold tabular-nums text-white/50">{services.length - chaosCount}</div>
                    <div className="text-[8px] text-white/30 tracking-widest">HEALTHY</div>
                  </div>
                </div>

                {/* Per-service list */}
                <div>
                  <div className="text-[8px] text-white/30 tracking-widest mb-2">TARGET SERVICE</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {services.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between gap-2 border p-1.5 transition-colors ${
                          s.chaosActive ? 'border-red-500/20 bg-red-500/5' : 'border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className={`w-1 h-1 rounded-full flex-shrink-0 ${
                            s.chaosActive ? 'bg-red-500 animate-pulse' : 'bg-white/20'
                          }`} />
                          <span className="text-[9px] text-white/60 truncate">{s.name}</span>
                        </div>
                        {!s.chaosActive ? (
                          <button
                            type="button"
                            onClick={() => onSimulateOutage(s.id)}
                            className="flex-shrink-0 px-2 py-0.5 border border-red-500/40 text-red-400 text-[8px] hover:bg-red-500/10 active:bg-red-500/20 transition-colors tracking-wider"
                          >
                            INJECT
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRestoreService(s.id)}
                            className="flex-shrink-0 px-2 py-0.5 border border-green-500/40 text-green-400 text-[8px] hover:bg-green-500/10 active:bg-green-500/20 transition-colors tracking-wider"
                          >
                            RESTORE
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bulk actions */}
                <div className="border-t border-white/10 pt-3 flex gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    {!confirmAll ? (
                      <motion.button
                        key="chaos-all"
                        type="button"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => setConfirmAll(true)}
                        className="flex-1 py-1.5 border border-red-500/50 text-red-400 text-[9px] hover:bg-red-500/10 active:bg-red-500/20 transition-colors tracking-widest"
                      >
                        ⚡ CHAOS ALL
                      </motion.button>
                    ) : (
                      <motion.button
                        key="confirm-chaos"
                        type="button"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => { onChaosAll(); setConfirmAll(false); }}
                        className="flex-1 py-1.5 bg-red-500 text-white text-[9px] font-bold tracking-widest hover:bg-red-600 active:bg-red-700 transition-colors animate-pulse"
                      >
                        !! CONFIRM CHAOS
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => { onRestoreAll(); setConfirmAll(false); }}
                    className="flex-1 py-1.5 border border-green-500/50 text-green-400 text-[9px] hover:bg-green-500/10 active:bg-green-500/20 transition-colors tracking-widest"
                  >
                    ✓ RESTORE ALL
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

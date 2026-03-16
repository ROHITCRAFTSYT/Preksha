'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GovService } from '@/lib/services';
import { getStatusColor, getStatusBg, getStatusDot, getStatusLabel } from '@/lib/services';
import AIAnalysisModal from '@/components/AIAnalysisModal';

interface ServiceCardProps {
  service: GovService;
  onSimulateOutage?: (id: string) => void;
  onRestoreService?: (id: string) => void;
  chaosMode?: boolean;
  incidents?: { message: string; created_at: string }[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function ServiceCard({ service, onSimulateOutage, onRestoreService, chaosMode, incidents = [], expanded = false, onToggleExpand }: ServiceCardProps) {
  const [aiOpen, setAiOpen] = useState(false);

  const latencyBar = Math.min(100, (service.latency / 2000) * 100);
  const uptimeBar  = service.uptime;

  const canAnalyse = service.status === 'degraded' || service.status === 'outage' || service.chaosActive;

  return (
    <div
      className={`border font-mono text-sm transition-colors duration-300 relative overflow-hidden ${
        service.chaosActive
          ? 'border-red-500/60 bg-red-950/20'
          : getStatusBg(service.status)
      }`}
    >
      {/* ── Chaos active: animated scan line + left edge pulse ─────────── */}
      {service.chaosActive && (
        <>
          {/* Corner ribbon */}
          <div className="absolute top-0 right-0 z-20 pointer-events-none">
            <div className="bg-red-500 text-white text-[7px] font-bold tracking-[0.2em] px-3 py-0.5 shadow-lg shadow-red-500/30">
              ⚡ CHAOS
            </div>
          </div>
          {/* Scan line sweeping down */}
          <div
            className="absolute inset-x-0 h-px bg-red-500/30 z-10 pointer-events-none"
            style={{ animation: 'chaosCardScan 2.4s linear infinite' }}
          />
          {/* Left edge pulse */}
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ animation: 'chaosPulseEdge 1.2s ease-in-out infinite' }}
          />
        </>
      )}

      {/* ── Card Header (always visible, click to expand) ──────────────── */}
      <div
        role="button"
        tabIndex={0}
        className="p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer select-none"
        onClick={onToggleExpand}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? onToggleExpand?.() : null}
        aria-expanded={expanded}
      >
        {/* Status dot */}
        <div className="mt-1 flex-shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${getStatusDot(service.status)} ${
              service.status === 'outage' || service.chaosActive ? 'animate-pulse' : ''
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + status row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-white font-bold text-xs tracking-wider truncate">{service.name}</div>
              <div className="text-white/40 text-[10px] mt-0.5 tracking-widest">
                {service.category} · {service.region}
              </div>
            </div>

            {/* Right side: status label + AI button */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-5">
              <span className={`text-[10px] font-bold tracking-widest ${getStatusColor(service.status)}`}>
                {getStatusLabel(service.status)}
              </span>
              {canAnalyse && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAiOpen(true); }}
                  className="text-[9px] tracking-widest text-green-400/70 hover:text-green-400 border border-green-500/20 hover:border-green-500/50 px-2 py-1 transition-all hover:bg-green-500/5 flex items-center gap-1"
                >
                  ⚡ AI ANALYSE
                </button>
              )}
            </div>
          </div>

          {/* Latency + Uptime bars */}
          <div className="mt-2 space-y-1">
            {/* Latency */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[9px] w-14 flex-shrink-0">LATENCY</span>
              <div className="flex-1 h-1 bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    service.latency === 0 ? 'bg-gray-600' :
                    service.latency > 800 ? 'bg-red-500' :
                    service.latency > 400 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${latencyBar}%` }}
                />
              </div>
              <span className={`text-[10px] w-14 text-right flex-shrink-0 tabular-nums ${
                service.latency === 0 ? 'text-gray-500' :
                service.latency > 800 ? 'text-red-400' :
                service.latency > 400 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {service.latency === 0 ? 'N/A' : `${Math.round(service.latency)}ms`}
              </span>
            </div>

            {/* Uptime */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[9px] w-14 flex-shrink-0">UPTIME</span>
              <div className="flex-1 h-1 bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    uptimeBar > 99 ? 'bg-green-400' :
                    uptimeBar > 95 ? 'bg-yellow-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${uptimeBar}%` }}
                />
              </div>
              <span className={`text-[10px] w-14 text-right flex-shrink-0 tabular-nums ${
                uptimeBar > 99 ? 'text-green-400' :
                uptimeBar > 95 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {service.uptime.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 mt-1 text-white/25 text-[9px] transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </div>
      </div>

      {/* ── Expandable section (animated) ─────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-white/10 p-4 space-y-3">
              {/* Description */}
              <p className="text-white/50 text-[10px] leading-relaxed">{service.description}</p>

              {/* Latency sparkline */}
              <div>
                <div className="text-[9px] text-white/30 mb-1.5 tracking-widest">LATENCY HISTORY</div>
                <div className="flex items-end gap-px h-8">
                  {service.history.slice(-20).map((point, i) => {
                    const barH = point.latency === 0 ? 2 : Math.max(2, (point.latency / 2000) * 32);
                    return (
                      <div
                        key={i}
                        title={`${Math.round(point.latency)}ms`}
                        className={`flex-1 transition-all ${
                          point.latency === 0 ? 'bg-gray-700' :
                          point.latency > 800 ? 'bg-red-500/70' :
                          point.latency > 400 ? 'bg-yellow-400/70' : 'bg-green-400/60'
                        }`}
                        style={{ height: `${barH}px`, opacity: 0.3 + (i / 20) * 0.7 }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Fallback routes — only for degraded / outage */}
              {(service.status === 'degraded' || service.status === 'outage') && service.fallbacks.length > 0 && (
                <div>
                  <div className="text-[9px] text-yellow-400/80 mb-1.5 tracking-widest flex items-center gap-1">
                    ⚠ FALLBACK ROUTES AVAILABLE
                  </div>
                  <div className="space-y-1.5">
                    {service.fallbacks.map((fb, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white/5 border border-white/10 p-2">
                        <span className="text-yellow-400 text-[9px] mt-0.5 flex-shrink-0">→</span>
                        <div>
                          <div className="text-white text-[10px] font-bold">{fb.label}</div>
                          <div className="text-white/40 text-[9px]">{fb.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chaos controls — INJECT when chaos mode is on, RESTORE always visible for injected services */}
              {(chaosMode || service.chaosActive) && (
                <div className="border-t border-red-500/20 pt-3 flex gap-2">
                  {!service.chaosActive ? (
                    <button
                      type="button"
                      onClick={() => onSimulateOutage?.(service.id)}
                      className="flex-1 py-2 border border-red-500/50 text-red-400 text-[10px] hover:bg-red-500/10 active:bg-red-500/20 transition-colors tracking-widest"
                    >
                      ⚡ INJECT FAILURE
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestoreService?.(service.id)}
                      className="flex-1 py-2 border border-green-500/50 text-green-400 text-[10px] hover:bg-green-500/10 active:bg-green-500/20 transition-colors tracking-widest"
                    >
                      ✓ RESTORE SERVICE
                    </button>
                  )}
                </div>
              )}

              {/* Last checked timestamp */}
              <div className="text-[9px] text-white/20 text-right tabular-nums" suppressHydrationWarning>
                {service.lastChecked > 0
                  ? `LAST CHECK: ${new Date(service.lastChecked).toLocaleTimeString()}`
                  : 'LAST CHECK: LOADING...'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Analysis Modal (portal-style fullscreen overlay) ─────────── */}
      <AnimatePresence>
        {aiOpen && (
          <AIAnalysisModal
            service={service}
            incidents={incidents}
            onClose={() => setAiOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveThreatModalProps {
  event: any;
  onClose: () => void;
  onBlock: (targetType: string, targetValue: string) => Promise<void>;
}

export default function LiveThreatModal({ event, onClose, onBlock }: LiveThreatModalProps) {
  if (!event) return null;

  const handleBlock = async () => {
    await onBlock('ip', event.ip_address);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="fixed bottom-8 right-8 z-[999] w-[400px] border border-red-500/50 bg-black/90 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="absolute inset-0 bg-red-500/5" style={{ animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4 border-b border-red-500/20 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🚨</span>
              <div>
                <div className="text-[12px] text-red-500 font-bold tracking-[0.2em] leading-none">CRITICAL THREAT DETECTED</div>
                <div className="text-[10px] text-white/50 tracking-widest mt-1">RISK SCORE: {event.risk_score}/100</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center text-[10px] tracking-widest bg-red-500/10 border border-red-500/20 p-2">
              <span className="text-red-400/70">ATTACK TYPE</span>
              <span className="text-white font-mono">{event.event_type.toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] tracking-widest bg-red-500/10 border border-red-500/20 p-2">
              <span className="text-red-400/70">SOURCE IP</span>
              <span className="text-white font-mono">{event.ip_address}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] tracking-widest bg-red-500/10 border border-red-500/20 p-2">
              <span className="text-red-400/70">TARGET ID</span>
              <span className="text-white font-mono text-right truncate max-w-[150px]">{event.user_id}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBlock}
              className="flex-1 bg-red-500 hover:bg-red-400 text-black py-4 font-black tracking-widest text-[11px] transition-colors"
            >
              [ INSTANT BLOCK IP ]
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

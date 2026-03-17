'use client';

import { useState, useEffect } from 'react';
import { SecurityEvent } from './AttackFeed';

export default function AIAnalysisPanel({ selectedEvent }: { selectedEvent: SecurityEvent | null }) {
  const [analysis, setAnalysis] = useState<{ attack_type: string; severity: string; recommended_action: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEvent) {
      setAnalysis(null);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    setAnalysis(null);

    fetch('/api/lab-analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedEvent)
    })
      .then(r => r.json())
      .then(res => {
        if (isMounted) {
          setAnalysis(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedEvent]);

  if (!selectedEvent) {
    return (
      <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="text-white/20 text-3xl mb-3">🤖</div>
        <h3 className="text-[11px] text-white/40 tracking-[0.2em] font-bold">AI ANALYSIS ENGINE</h3>
        <p className="text-[10px] text-white/30 mt-2 max-w-[200px]">Select an event from the live attack feed to generate a threat assessment.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[10px] text-white/50 tracking-[0.2em] font-bold flex items-center gap-2">
          <span>🧠</span> AI ASSESSMENT
        </h3>
        <span className="text-[9px] text-blue-400/60 tracking-widest border border-blue-500/20 px-2 py-0.5 bg-blue-500/10">Llama-3.3-70b</span>
      </div>

      <div className="flex-1 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[10px] text-blue-400/60 tracking-[0.2em] animate-pulse">ANALYZING PAYLOAD...</span>
          </div>
        ) : analysis ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div>
              <div className="text-[9px] text-white/30 tracking-widest mb-1">CLASSIFICATION</div>
              <div className="text-[13px] font-bold text-white/90 border border-white/[0.08] bg-white/[0.02] p-3">
                {analysis.attack_type.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-white/30 tracking-widest mb-1">AI SEVERITY RATING</div>
                <div className={`p-3 border text-[11px] font-bold tracking-widest 
                  ${analysis.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 
                    analysis.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 
                    'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
                  {analysis.severity}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/30 tracking-widest mb-1">RISK SCORE</div>
                <div className="p-3 border border-white/[0.08] bg-white/[0.02] text-[11px] font-bold tracking-widest tabular-nums text-white/80">
                  {selectedEvent.risk_score} / 100
                </div>
              </div>
            </div>

            <div>
              <div className="text-[9px] text-white/30 tracking-widest mb-1">RECOMMENDED ACTION</div>
              <div className="text-[11px] leading-relaxed text-blue-400/90 border border-blue-500/20 bg-blue-500/5 p-4 rounded-sm">
                {analysis.recommended_action}
              </div>
            </div>

            {selectedEvent.details?.payload && (
              <div className="mt-4">
                <div className="text-[9px] text-white/30 tracking-widest mb-1">EXTRACTED PAYLOAD</div>
                <div className="bg-black/50 border border-white/[0.05] p-3 text-[10px] font-mono text-red-400/80 break-all">
                  {selectedEvent.details.payload}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-red-400/60 p-4 border border-red-500/20 bg-red-500/5">
            Analysis failed to generate.
          </div>
        )}
      </div>
    </div>
  );
}

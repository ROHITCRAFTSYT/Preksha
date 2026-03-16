'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface SecurityReport {
  id: string;
  incident_id: string;
  title: string;
  content: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  const hrs = Math.floor(d / 3600);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReportViewer() {
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from('security_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setReports(data as SecurityReport[]);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  useEffect(() => {
    const ch = supabase
      .channel('rt-security-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_reports' }, () => loadReports())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadReports]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">DOCUMENTATION</div>
        <h2 className="text-sm font-bold text-white/80 tracking-wide">Post-Incident Reports (PIR)</h2>
        <p className="text-[10px] text-white/25 mt-1">Automatically generated reports combining event timelines and AI-driven analysis for closed incidents.</p>
      </div>

      <div className="space-y-3 print:space-y-6">
        {reports.length === 0 ? (
          <div className="border border-white/[0.07] p-12 text-center print:hidden">
            <div className="text-2xl opacity-15 mb-2">📄</div>
            <div className="text-[10px] text-white/20 tracking-widest">NO REPORTS GENERATED YET</div>
            <div className="text-[9px] text-white/10 mt-1">Generate a report from a closed incident in the Incidents tab.</div>
          </div>
        ) : (
          reports.map(report => {
            const isExpanded = expandedId === report.id;
            return (
              <div key={report.id} className="border border-white/[0.07] bg-white/[0.01] print:bg-white print:border-black/20 print:text-black print:page-break-inside-avoid">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors print:hidden"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-50">📄</span>
                    <div>
                      <h3 className="text-sm font-bold text-white/80">{report.title}</h3>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">GENERATED {timeAgo(report.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrint(); }} 
                      className="px-3 py-1.5 text-[9px] border border-white/10 text-white/40 hover:text-white transition-colors"
                      title="Print / Save as PDF"
                    >
                      🖨 PRINT
                    </button>
                    <span className={`text-[12px] text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </div>

                {/* Always visible in print, toggled on screen */}
                <div className={`${isExpanded ? 'block' : 'hidden print:block'} p-6 border-t border-white/[0.05] print:border-t-0 print:p-8 bg-black/20 print:bg-white`}>
                  {/* Print-only header */}
                  <div className="hidden print:block border-b border-black/20 pb-4 mb-6">
                    <h1 className="text-2xl font-black">{report.title}</h1>
                    <p className="text-sm text-gray-500 mt-1">ResilienceOS Security Operations Center • Post-Incident Report</p>
                    <p className="text-xs text-gray-400 mt-1">Date: {new Date(report.created_at).toLocaleString()}</p>
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none print:prose-p:text-black print:prose-headings:text-black print:prose-li:text-black text-[12px] leading-relaxed text-white/70">
                    {/* Basic Markdown rendering */}
                    {report.content.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-white/90 print:text-black mt-6 mb-2 border-b border-white/10 print:border-black/10 pb-1">{line.slice(4)}</h3>;
                      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-white/90 print:text-black mt-8 mb-3">{line.slice(3)}</h2>;
                      if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-white print:text-black mt-8 mb-4">{line.slice(2)}</h1>;
                      if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.slice(2)}</li>;
                      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-purple-500/50 pl-3 py-1 my-2 text-white/50 print:text-gray-600 bg-white/[0.02] print:bg-gray-50">{line.slice(2)}</blockquote>;
                      if (line.trim() === '') return <br key={i} />;
                      
                      // Bold formatting
                      const bolded = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="text-white/90 print:text-black">{part.slice(2, -2)}</strong>;
                        return part;
                      });

                      return <p key={i} className="mb-2">{bolded}</p>;
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

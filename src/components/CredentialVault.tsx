'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CapturedCredential {
  id: string;
  username: string;
  password_payload: string;
  ip_address: string;
  attack_vector: string;
  captured_at: string;
}

export default function CredentialVault() {
  const [creds, setCreds] = useState<CapturedCredential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreds = async () => {
      const { data } = await supabase
        .from('honeypot_credentials')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(20);
      
      if (data) setCreds(data as CapturedCredential[]);
      setLoading(false);
    };

    fetchCreds();
    const interval = setInterval(fetchCreds, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[10px] text-white/50 tracking-[0.2em] font-bold flex items-center gap-2">
          <span>🗝️</span> CAPTURED CREDENTIALS
        </h3>
        <span className="text-[9px] text-green-400/60 tracking-widest border border-green-500/20 px-2 py-0.5 bg-green-500/10 uppercase">Honeypot Active</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="text-[10px] text-white/20 text-center py-8 tracking-widest">LOADING VAULT...</div>
        ) : creds.length === 0 ? (
          <div className="text-[10px] text-white/20 text-center py-8 tracking-widest">No credentials captured yet.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="pb-2 text-[9px] text-white/30 tracking-widest uppercase">Username</th>
                <th className="pb-2 text-[9px] text-white/30 tracking-widest uppercase">Payload</th>
                <th className="pb-2 text-[9px] text-white/30 tracking-widest uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {creds.map((c) => (
                <tr key={c.id} className="group hover:bg-white/[0.01]">
                  <td className="py-3 text-[11px] text-white/80 font-mono">{c.username}</td>
                  <td className="py-3 text-[11px] text-red-400/70 font-mono truncate max-w-[150px]">{c.password_payload}</td>
                  <td className="py-3 text-[10px] text-white/40 font-mono">{c.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

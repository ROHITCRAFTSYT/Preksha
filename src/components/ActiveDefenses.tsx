'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ActiveDefense {
  id: string;
  target_type: string;
  target_value: string;
  action: string;
  status: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

export default function ActiveDefenses() {
  const [defenses, setDefenses] = useState<ActiveDefense[]>([]);
  const [targetType, setTargetType] = useState('ip');
  const [targetValue, setTargetValue] = useState('');
  const [action, setAction] = useState('block');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDefenses = useCallback(async () => {
    const { data } = await supabase
      .from('active_defenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDefenses(data as ActiveDefense[]);
  }, []);

  useEffect(() => { loadDefenses(); }, [loadDefenses]);

  useEffect(() => {
    const ch = supabase
      .channel('rt-active-defenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_defenses' }, () => loadDefenses())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadDefenses]);

  const addDefense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/security-defenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_value: targetValue, action }),
      });
      setTargetValue('');
      await loadDefenses();
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeDefense = async (id: string) => {
    await fetch(`/api/security-defenses?id=${id}`, { method: 'DELETE' });
    await loadDefenses();
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    await fetch('/api/security-defenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: currentStatus === 'active' ? 'inactive' : 'active' }),
    });
    await loadDefenses();
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">ACTIVE MITIGATION</div>
        <h2 className="text-sm font-bold text-white/80 tracking-wide">Active Defenses</h2>
        <p className="text-[10px] text-white/25 mt-1">Manage real-time blocking, rate limiting, and other mitigations applied to the environment.</p>
      </div>

      {/* Add new defense form */}
      <form onSubmit={addDefense} className="flex flex-wrap items-end gap-3 p-4 border border-white/[0.07] bg-white/[0.01]">
        <div>
          <label className="block text-[8px] text-white/30 tracking-widest mb-1.5">TARGET TYPE</label>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="bg-black border border-white/10 text-[10px] text-white/80 px-3 py-2 w-32 outline-none focus:border-purple-500/50">
            <option value="ip">IP Address</option>
            <option value="user">User ID</option>
            <option value="attack_type">Attack Type</option>
            <option value="endpoint">API Endpoint</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[8px] text-white/30 tracking-widest mb-1.5">TARGET VALUE</label>
          <input
            type="text"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder={targetType === 'ip' ? 'e.g. 192.168.1.50' : targetType === 'user' ? 'e.g. uid_anon_1' : 'e.g. brute_force_login'}
            className="w-full bg-black border border-white/10 text-[10px] text-white/80 px-3 py-2 outline-none focus:border-purple-500/50 placeholder:text-white/10"
          />
        </div>
        <div>
          <label className="block text-[8px] text-white/30 tracking-widest mb-1.5">ACTION</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="bg-black border border-white/10 text-[10px] text-white/80 px-3 py-2 w-36 outline-none focus:border-purple-500/50">
            <option value="block">Block Traffic</option>
            <option value="rate_limit">Rate Limit</option>
            <option value="require_mfa">Require MFA</option>
            <option value="revoke_session">Revoke Session</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !targetValue}
          className="px-4 py-2 border border-purple-500/40 text-[10px] tracking-widest font-bold text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed h-[35px] transition-colors"
        >
          {isSubmitting ? 'APPLYING...' : 'APPLY DEFENSE'}
        </button>
      </form>

      {/* Defense list */}
      <div className="space-y-2">
        {defenses.length === 0 ? (
          <div className="border border-white/[0.07] p-12 text-center">
            <div className="text-2xl opacity-15 mb-2">🛡</div>
            <div className="text-[10px] text-white/20 tracking-widest">NO ACTIVE DEFENSES</div>
          </div>
        ) : (
          defenses.map(def => (
            <div key={def.id} className={`flex items-center gap-4 p-3 border ${def.status === 'active' ? 'border-purple-500/20 bg-purple-500/[0.03]' : 'border-white/[0.05] bg-white/[0.01] opacity-60'}`}>
              <div className="flex-1 flex items-center gap-4">
                <span className={`text-[9px] font-bold tracking-widest px-2 py-1 border ${def.action === 'block' ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'}`}>
                  {def.action.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-[10px] text-white/40 tracking-widest">{def.target_type.toUpperCase()}</span>
                <span className="text-[12px] font-mono text-white/80">{def.target_value}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-white/20">{timeAgo(def.created_at)}</span>
                <button
                  onClick={() => toggleStatus(def.id, def.status)}
                  className={`px-3 py-1 text-[9px] tracking-widest border transition-colors ${def.status === 'active' ? 'border-white/10 text-white/40 hover:text-white' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}
                >
                  {def.status === 'active' ? 'DISABLE' : 'ENABLE'}
                </button>
                <button
                  onClick={() => removeDefense(def.id)}
                  className="px-2 py-1 text-[9px] text-red-400/50 hover:text-red-400 transition-colors"
                  title="Remove from history"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

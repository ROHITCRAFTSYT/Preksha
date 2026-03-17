'use client';

import { useState } from 'react';

export default function InteractiveHoneypot() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [transmissionStatus, setTransmissionStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [lastSystemResult, setLastSystemResult] = useState<React.ReactNode | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'search'>('login');

  const executeAttack = async (type: 'login' | 'search') => {
    setIsExecuting(true);
    setLastSystemResult(null);

    let eventType = 'suspicious_login';
    let payload = '';
    let ip = '198.51.100.12';
    let isSqli = false;

    if (type === 'login') {
      isSqli = username.includes("'") || username.toLowerCase().includes("union") || username.includes("=");
      eventType = isSqli ? 'sql_injection' : 'brute_force_login';
      payload = `user=${username}&pass=${password.replace(/./g, '*')}`;
      ip = isSqli ? '10.0.0.50' : '198.51.100.12';
    } else {
      const isXss = searchQuery.includes("<script") || searchQuery.includes("alert(");
      isSqli = searchQuery.includes("'") || searchQuery.toLowerCase().includes("union");
      eventType = isSqli ? 'sql_injection' : isXss ? 'xss_attempt' : 'api_abuse';
      payload = `q=${searchQuery}`;
      ip = '45.33.22.11';
    }

    setTransmissionStatus('sending');
    try {
      const res = await fetch('/api/security-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          user_id: type === 'login' ? username : 'anonymous',
          ip_address: ip,
          details: {
            endpoint: type === 'login' ? '/legacy-admin-honeypot' : '/search-api',
            payload: payload,
            honeypot_triggered: true,
            simulated: true,
          },
        }),
      });

      if (res.ok) {
        setTransmissionStatus('success');
        setTimeout(() => setTransmissionStatus('idle'), 3000);
      } else {
        setTransmissionStatus('error');
      }
    } catch (err) {
      console.error(err);
      setTransmissionStatus('error');
    }

    // Dummy UI response delay
    setTimeout(() => {
        setIsExecuting(false);
        if (type === 'login') {
          if (isSqli || (username === 'admin' && password === 'password123')) {
            setLastSystemResult(
              <div className="bg-green-50 p-2 border border-green-200 mt-2">
                <p className="text-green-800 font-bold mb-1">Login Successful. Welcome Admin.</p>
                <div className="text-[10px] text-gray-600 space-y-1 font-mono mt-2">
                  <div>* Unread messages: 14</div>
                  <div>* Pending approvals: 0</div>
                  <div className="text-red-600 mt-2">System Warning: Backup failed.</div>
                </div>
              </div>
            );
          } else {
            setLastSystemResult(
              <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 border border-red-100 mt-2">
                Invalid credentials. This attempt has been logged.
              </p>
            );
          }
        } else {
          const isXss = searchQuery.includes("<script") || searchQuery.includes("alert(");
          const isSqliSearch = searchQuery.includes("'") || searchQuery.toLowerCase().includes("union");
          
          if (isXss) {
             setLastSystemResult(
               <div className="mt-4 border border-red-200 bg-red-50 p-4">
                 <div className="font-bold text-red-600 flex items-center gap-2 mb-2">
                   <span>⚠️</span> [Simulated Browser Alert Box] 
                 </div>
                 <div className="font-mono text-xs bg-white p-2 border border-red-100">
                    XSS Payload Executed: {searchQuery}
                 </div>
               </div>
             );
          } else if (isSqliSearch) {
             setLastSystemResult(
               <div className="mt-4 border border-gray-300 bg-white shadow-sm overflow-hidden">
                 <div className="bg-gray-100 px-3 py-2 text-xs font-bold border-b border-gray-300">
                   Database Dump (Users Table)
                 </div>
                 <table className="w-full text-left text-[10px] font-mono">
                   <thead className="bg-gray-50 border-b">
                     <tr><th className="p-2 w-16">ID</th><th className="p-2">USERNAME</th><th className="p-2">PASSWORD_HASH</th></tr>
                   </thead>
                   <tbody>
                     <tr className="border-b">
                        <td className="p-2">1</td><td className="p-2 text-blue-600">admin</td><td className="p-2 text-gray-500">$2a$10$wK...</td>
                     </tr>
                     <tr className="border-b">
                        <td className="p-2">2</td><td className="p-2 text-blue-600">jdoe</td><td className="p-2 text-gray-500">$2a$10$fA...</td>
                     </tr>
                     <tr>
                        <td className="p-2">3</td><td className="p-2 text-blue-600">sysop</td><td className="p-2 text-gray-500">$2a$10$lP...</td>
                     </tr>
                   </tbody>
                 </table>
               </div>
             );
          } else {
            setLastSystemResult(
              <div className="mt-4 text-sm text-gray-600 border border-gray-200 bg-white p-4">
                0 results found for: {searchQuery}
              </div>
            );
          }
        }
      }, 800);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeAttack('login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeAttack('search');
  };

  const prefillSQLi = () => {
    setActiveTab('login');
    setUsername("' OR 1=1 --");
    setPassword("anything");
  };

  const prefillBrute = () => {
    setActiveTab('login');
    setUsername("admin");
    setPassword("password123");
  };

  const prefillXSS = () => {
    setActiveTab('search');
    setSearchQuery("<script>alert('XSS')</script>");
  };

  return (
    <div className="bg-[#e4e4e7] border border-blue-500/30 h-full flex flex-col relative rounded-sm overflow-hidden flex-shrink-0">
      
      {/* ── Fake Browser Chrome ── */}
      <div className="bg-[#f4f4f5] border-b border-gray-300 p-2 flex items-center gap-3">
        <div className="flex gap-1.5 ml-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-sm px-3 py-1 text-[10px] text-gray-500 font-sans flex items-center gap-2">
          <span>🔒</span> https://legacy.govdata.local
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full max-w-full">
        <div className="min-h-full bg-white text-gray-800 font-sans flex flex-col">
          
          {/* Fake Website Header */}
          <header className="bg-blue-800 p-4 shadow-md z-10 shrink-0">
            <h1 className="text-white text-xl font-bold tracking-tight">GovData <span className="text-blue-300 font-normal italic text-sm">v4.1</span></h1>
            <p className="text-blue-100 text-xs mt-1">Employee Intra-Net Portal</p>
            
            <nav className="mt-4 flex gap-4 text-xs font-semibold text-blue-200">
              <button 
                onClick={() => { setActiveTab('login'); setLastSystemResult(null); }} 
                className={`pb-1 ${activeTab === 'login' ? 'text-white border-b-2 border-white' : 'hover:text-white'}`}
              >
                Admin Login
              </button>
              <button 
                onClick={() => { setActiveTab('search'); setLastSystemResult(null); }}
                className={`pb-1 ${activeTab === 'search' ? 'text-white border-b-2 border-white' : 'hover:text-white'}`}
              >
                Record Search
              </button>
            </nav>
          </header>

          {/* Body Content */}
          <div className="p-6 flex-1 bg-gray-50 w-full overflow-hidden">
            
            {activeTab === 'login' && (
              <div className="max-w-xs mx-auto animate-in fade-in">
                <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm">
                  <h2 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">Administrator Access</h2>
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isExecuting}
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 text-sm disabled:opacity-50"
                    >
                      {isExecuting ? 'Authenticating...' : 'Sign In'}
                    </button>
                    {lastSystemResult}
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'search' && (
              <div className="max-w-md mx-auto animate-in fade-in">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Public Records Search</h2>
                <p className="text-xs text-gray-500 mb-6">Search through declassified documents and public indices.</p>
                
                <form onSubmit={handleSearchSubmit}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter query or wildcard..."
                      className="flex-1 border border-gray-300 px-3 py-2 text-sm shadow-inner focus:border-blue-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isExecuting}
                      className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {isExecuting ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {lastSystemResult}
                </form>
              </div>
            )}

          </div>

          {/* Quick Injectors (Floating outside the dummy UI logic, for user convenience) */}
          <div className="bg-gray-800 p-2 shrink-0 border-t-4 border-gray-900">
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mr-2">Quick Inject:</span>
              <button onClick={prefillSQLi} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 hover:bg-red-500/30 font-mono">SQLi</button>
              <button onClick={prefillBrute} className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 hover:bg-orange-500/30 font-mono">Brute Force</button>
              <button onClick={prefillXSS} className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 hover:bg-yellow-500/30 font-mono">XSS</button>
            </div>
          </div>

          {/* Dummy Browser Status Bar */}
          <div className="bg-gray-100 border-t border-gray-300 px-3 py-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
               CONNECTED TO SECURE_BACKEND_v4
             </div>
             <div className="flex items-center gap-2">
               {transmissionStatus === 'sending' && <span className="text-blue-500 animate-pulse">TRANSMITTING TO SECURITY LAB...</span>}
               {transmissionStatus === 'success' && <span className="text-green-600 font-bold">✓ SECURITY LOG GENERATED</span>}
               {transmissionStatus === 'error' && <span className="text-red-500 font-bold">⚠️ LAB CONNECTION FAILURE</span>}
               {transmissionStatus === 'idle' && <span>SYSTEM_ID: 0xFD21</span>}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

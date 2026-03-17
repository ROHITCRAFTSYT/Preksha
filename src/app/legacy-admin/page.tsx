'use client';

import { useState } from 'react';

export default function LegacyAdminHoneypot() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // The honeypot ALWAYS fails login to encourage brute forcing or SQLi, 
    // whilst logging every attempt as a critical security event.
    
    // Check if the payload contains obvious SQLi
    const isSqli = username.includes("'") || password.includes("'") || username.toLowerCase().includes("union") || username.toLowerCase().includes("or 1=1");
    const eventType = isSqli ? 'sql_injection' : 'brute_force_login';

    try {
      await fetch('/api/security-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          user_id: username || 'anonymous',
          ip_address: '192.168.1.10', // Mock IP for the honeypot
          details: {
            endpoint: '/legacy-admin',
            payload: `user=${username}&pass=${password.replace(/./g, '*')}`,
            honeypot_triggered: true,
            raw_input: { username, password } // Log raw for AI analysis
          },
        }),
      });
    } catch (error) {
      console.error('Failed to log honeypot event', error);
    }

    // Simulate an old, slow system
    setTimeout(() => {
      if (isSqli) {
        setError('SQL syntax error near "OR 1=1"'); // Tantalizing error for attackers
      } else {
        setError('Invalid credentials. This attempt has been logged.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#ece9e6] flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white shadow-xl rounded-sm overflow-hidden border border-gray-300">
        
        {/* Fake Old Header */}
        <div className="bg-gradient-to-b from-blue-700 to-blue-900 px-6 py-4 border-b border-blue-900">
          <div className="text-white font-bold text-xl drop-shadow-md">
            GovData <span className="text-blue-200 font-normal italic">v2.4 (Deprecated)</span>
          </div>
          <div className="text-blue-100 text-xs mt-1">Administrator Access Portal</div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-xs text-yellow-700 font-medium">
              Warning: This system is scheduled for decommissioning. 
              Please migrate to ResilienceOS immediately.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Administrator ID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-gray-800 shadow-inner focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="admin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Master Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-gray-800 shadow-inner focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm font-bold bg-red-50 p-2 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 shadow-sm transition-colors mt-2"
            >
              Sign In
            </button>
          </form>
        </div>

        {/* Fake Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 text-center">
          <p className="text-[10px] text-gray-500">
            © 2014 Government Data Systems. All rights reserved. <br/>
            Server: NODE_04_EAST
          </p>
        </div>
      </div>
    </div>
  );
}

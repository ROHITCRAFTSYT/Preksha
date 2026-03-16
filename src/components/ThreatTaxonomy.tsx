'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaxonomyEntry {
  id: string;
  name: string;
  icon: string;
  category: string;
  mitreTactic: string;
  mitreTechnique: string;
  color: string;
  description: string;
  indicators: string[];
  detectionLogic: string;
  defenseRecommendations: string[];
}

const TAXONOMY: TaxonomyEntry[] = [
  {
    id: 'credential-stuffing',
    name: 'Credential Stuffing / Brute Force',
    icon: '🔨',
    category: 'Authentication Attack',
    mitreTactic: 'TA0006 — Credential Access',
    mitreTechnique: 'T1110 — Brute Force',
    color: '#ef4444',
    description: 'Automated attempts to gain unauthorized access by trying large volumes of credentials (username/password pairs) obtained from data breaches or generated systematically.',
    indicators: [
      'High volume of failed login attempts from single IP or IP range',
      'Multiple accounts targeted in rapid succession',
      'Use of known proxy/VPN/Tor exit nodes',
      'Login attempts with credentials from known breach databases',
      'Unusual user-agent strings indicating automated tools',
    ],
    detectionLogic: 'Trigger when >10 failed login attempts per IP within 60 seconds, or >5 failed attempts on a single account within 5 minutes. Cross-reference IPs against threat intelligence feeds.',
    defenseRecommendations: [
      'Implement progressive rate limiting on login endpoints',
      'Enable CAPTCHA after 3 failed attempts',
      'Deploy account lockout with exponential backoff',
      'Enforce multi-factor authentication (MFA) for all accounts',
      'Monitor and block IPs from known proxy/anonymizer services',
      'Implement credential breach detection (e.g., Have I Been Pwned API)',
    ],
  },
  {
    id: 'data-exfiltration',
    name: 'Document Exfiltration',
    icon: '📥',
    category: 'Data Theft',
    mitreTactic: 'TA0009 — Collection',
    mitreTechnique: 'T1005 — Data from Local System',
    color: '#f97316',
    description: 'Systematic download or extraction of sensitive government documents (Aadhaar, PAN, Voter ID, etc.) at volumes exceeding normal user behavior, indicating automated scraping or insider threat.',
    indicators: [
      'Burst download pattern: >10 documents in 60 seconds',
      'Download of document types the user has not previously accessed',
      'Automated download patterns (constant intervals, no UI interaction)',
      'Downloads from sessions with unusual geographic origin',
      'Large data transfer volumes from single session',
    ],
    detectionLogic: 'Monitor document download velocity per session. Alert when downloads exceed 10 per minute or total session data exceeds 50MB. Flag sessions downloading document types outside user\'s typical pattern.',
    defenseRecommendations: [
      'Enforce per-user download rate limits (5 docs per 10-minute window)',
      'Implement session-level data transfer caps',
      'Require re-authentication for bulk document access',
      'Apply DLP (Data Loss Prevention) rules on sensitive document types',
      'Watermark downloaded documents with user session identifiers',
      'Log all document access for forensic audit trail',
    ],
  },
  {
    id: 'token-hijacking',
    name: 'Token / Session Hijacking',
    icon: '🔑',
    category: 'Session Attack',
    mitreTactic: 'TA0006 — Credential Access',
    mitreTechnique: 'T1528 — Steal Application Access Token',
    color: '#a855f7',
    description: 'Interception, theft, or forgery of OAuth tokens or session cookies to impersonate legitimate users and bypass authentication controls.',
    indicators: [
      'Token used from IP address different from original authentication',
      'Forged or malformed token signatures',
      'Session tokens replayed after expiration',
      'Multiple simultaneous sessions with same token from different IPs',
      'Tokens appearing in request logs from unexpected user-agents',
    ],
    detectionLogic: 'Validate token binding (IP + device fingerprint) on every request. Flag tokens where source IP differs from authentication IP. Detect expired or malformed token signatures in real-time.',
    defenseRecommendations: [
      'Bind tokens to client IP and device fingerprint at issuance',
      'Implement short token lifetimes with refresh token rotation',
      'Use secure, HttpOnly, SameSite cookies for session management',
      'Deploy token introspection on every API call',
      'Rotate OAuth signing keys periodically',
      'Implement abnormal session detection and forced re-auth',
    ],
  },
  {
    id: 'api-abuse',
    name: 'API Abuse / Rate Violation',
    icon: '⚡',
    category: 'Availability Attack',
    mitreTactic: 'TA0040 — Impact',
    mitreTechnique: 'T1499 — Endpoint Denial of Service',
    color: '#eab308',
    description: 'Excessive or malicious use of API endpoints through automated tooling, including scraping, enumeration attacks, resource exhaustion, and denial-of-service attempts.',
    indicators: [
      'Request volume exceeding 100 requests/min from single source',
      'Bot-like user-agent strings (python-requests, curl, Scrapy)',
      'Systematic endpoint enumeration patterns',
      'Requests with no referrer from non-browser clients',
      'Large payload sizes on read endpoints',
    ],
    detectionLogic: 'Track request rate per API key and per IP. Alert at 50 req/min (warning) and block at 100 req/min. Analyze user-agent distribution and flag non-browser clients accessing sensitive endpoints.',
    defenseRecommendations: [
      'Implement tiered rate limiting per API key and per IP',
      'Deploy bot management solution (challenge-response for suspicious traffic)',
      'Require API key authentication on all endpoints',
      'Implement request signing (HMAC) for sensitive operations',
      'Use API gateway with DDoS protection and traffic shaping',
      'Monitor and alert on abnormal traffic patterns in real-time',
    ],
  },
  {
    id: 'suspicious-login',
    name: 'Suspicious Login Activity',
    icon: '👤',
    category: 'Account Compromise',
    mitreTactic: 'TA0001 — Initial Access',
    mitreTechnique: 'T1078 — Valid Accounts',
    color: '#60a5fa',
    description: 'Login activity from unusual contexts — new devices, unexpected geographic locations, off-hours timing, or impossible travel patterns — suggesting potential account compromise.',
    indicators: [
      'Login from previously unseen device or browser',
      'Login from country not in user\'s baseline',
      'Impossible travel: login from two distant locations within impossible time',
      'Login during off-hours for user\'s timezone',
      'Immediate sensitive actions after login from new context',
    ],
    detectionLogic: 'Build per-user behavioral baselines (device, location, time patterns). Flag logins deviating >2σ from baseline. Detect impossible travel by computing distance/time between sequential logins.',
    defenseRecommendations: [
      'Implement risk-based adaptive authentication',
      'Deploy step-up MFA for high-risk login contexts',
      'Build and maintain per-user device and location baselines',
      'Implement impossible travel detection algorithms',
      'Send login notification alerts to registered communication channels',
      'Require explicit approval for logins from new countries',
    ],
  },
];

export default function ThreatTaxonomy() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4 pb-8">
      <div>
        <div className="text-[9px] text-purple-400/60 tracking-[0.3em] mb-1">KNOWLEDGE BASE</div>
        <h2 className="text-sm font-bold text-white/80 tracking-wide">Threat Taxonomy</h2>
        <p className="text-[10px] text-white/25 mt-1">
          Educational glossary of attack categories mapped to the MITRE ATT&CK framework. Understand indicators, detection logic, and defensive recommendations.
        </p>
      </div>

      {/* Summary table */}
      <div className="border border-white/[0.07] bg-white/[0.01] overflow-hidden">
        <div className="grid grid-cols-4 gap-px bg-white/[0.05] text-[8px] text-white/25 tracking-[0.15em]">
          <div className="bg-[#0d0d0d] px-3 py-2">ATTACK CATEGORY</div>
          <div className="bg-[#0d0d0d] px-3 py-2">CATEGORY</div>
          <div className="bg-[#0d0d0d] px-3 py-2">MITRE TACTIC</div>
          <div className="bg-[#0d0d0d] px-3 py-2">MITRE TECHNIQUE</div>
        </div>
        {TAXONOMY.map(t => (
          <div key={t.id} className="grid grid-cols-4 gap-px bg-white/[0.03] text-[9px]">
            <div className="bg-[#0d0d0d] px-3 py-2 flex items-center gap-1.5">
              <span>{t.icon}</span>
              <span style={{ color: t.color }}>{t.name}</span>
            </div>
            <div className="bg-[#0d0d0d] px-3 py-2 text-white/30">{t.category}</div>
            <div className="bg-[#0d0d0d] px-3 py-2 text-purple-400/60">{t.mitreTactic}</div>
            <div className="bg-[#0d0d0d] px-3 py-2 text-blue-400/60">{t.mitreTechnique}</div>
          </div>
        ))}
      </div>

      {/* Expandable details */}
      <div className="space-y-2">
        {TAXONOMY.map(t => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="border border-white/[0.07] bg-white/[0.01]">
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[16px]">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold" style={{ color: t.color }}>{t.name}</span>
                  <span className="text-[9px] text-white/20 ml-2">{t.category}</span>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 hidden sm:flex">
                  <span className="text-[8px] text-purple-400/50 border border-purple-500/20 px-1.5 py-0.5">{t.mitreTactic.split(' — ')[0]}</span>
                  <span className="text-[8px] text-blue-400/50 border border-blue-500/20 px-1.5 py-0.5">{t.mitreTechnique.split(' — ')[0]}</span>
                </div>
                <span className={`text-[9px] text-white/20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-4">
                      <p className="text-[10px] text-white/40 leading-relaxed">{t.description}</p>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Indicators */}
                        <div>
                          <div className="text-[8px] text-white/20 tracking-[0.2em] mb-2">🔍 INDICATORS OF COMPROMISE</div>
                          <ul className="space-y-1.5">
                            {t.indicators.map((ind, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[6px] mt-1 flex-shrink-0" style={{ color: t.color }}>●</span>
                                <span className="text-[9px] text-white/35 leading-relaxed">{ind}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Defense */}
                        <div>
                          <div className="text-[8px] text-white/20 tracking-[0.2em] mb-2">🛡 DEFENSE RECOMMENDATIONS</div>
                          <ul className="space-y-1.5">
                            {t.defenseRecommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[6px] mt-1 flex-shrink-0 text-green-400">●</span>
                                <span className="text-[9px] text-white/35 leading-relaxed">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Detection logic */}
                      <div>
                        <div className="text-[8px] text-white/20 tracking-[0.2em] mb-2">⚙ DETECTION LOGIC</div>
                        <div className="text-[9px] text-white/30 font-mono leading-relaxed p-3 bg-white/[0.02] border border-white/[0.06]">
                          {t.detectionLogic}
                        </div>
                      </div>

                      {/* MITRE tags */}
                      <div className="flex gap-2 pt-1">
                        <span className="text-[8px] text-purple-400/60 border border-purple-500/20 px-2 py-0.5">{t.mitreTactic}</span>
                        <span className="text-[8px] text-blue-400/60 border border-blue-500/20 px-2 py-0.5">{t.mitreTechnique}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

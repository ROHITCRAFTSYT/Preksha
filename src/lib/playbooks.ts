export interface PlaybookStep {
  order: number;
  title: string;
  description: string;
}

export interface SecurityPlaybook {
  id: string;
  title: string;
  attack_type: string;
  severity_range: string;
  description: string;
  steps: PlaybookStep[];
  mitre_tactics: string[];
  estimated_time_minutes: number;
}

export const FALLBACK_PLAYBOOKS: SecurityPlaybook[] = [
  {
    id: 'pb-brute-force',
    title: 'Credential Stuffing Response',
    attack_type: 'brute_force_login',
    severity_range: 'high-critical',
    description: 'Respond to automated credential stuffing or brute-force login attacks targeting user accounts.',
    steps: [
      { order: 1, title: 'Verify Attack Pattern', description: 'Confirm attack via failed login spike in security events. Check IP clustering and velocity.' },
      { order: 2, title: 'Enable Rate Limiting', description: 'Apply progressive rate limiting: 5 attempts/min per IP, 10 attempts/min per account.' },
      { order: 3, title: 'Block Malicious IPs', description: 'Add confirmed attacking IPs to WAF deny list. Consider geo-blocking high-risk regions.' },
      { order: 4, title: 'Force Password Reset', description: 'Trigger password reset for accounts with successful unauthorized logins.' },
      { order: 5, title: 'Enable MFA Enforcement', description: 'Require multi-factor authentication for all affected accounts.' },
      { order: 6, title: 'Post-Incident Review', description: 'Document attack timeline, review detection gaps, update rate-limit thresholds.' },
    ],
    mitre_tactics: ['TA0006 Credential Access', 'TA0001 Initial Access'],
    estimated_time_minutes: 45,
  },
  {
    id: 'pb-doc-download',
    title: 'Document Exfiltration Response',
    attack_type: 'document_download',
    severity_range: 'medium-critical',
    description: 'Respond to abnormal document download patterns indicating potential data exfiltration.',
    steps: [
      { order: 1, title: 'Detect Anomaly', description: 'Identify burst download pattern: >10 documents in 60 seconds from single IP/session.' },
      { order: 2, title: 'Suspend Session', description: 'Immediately revoke the active session token and force re-authentication.' },
      { order: 3, title: 'Quarantine Documents', description: 'Flag downloaded documents and check for sensitive PII (Aadhaar, PAN, etc).' },
      { order: 4, title: 'Implement Download Caps', description: 'Enforce per-user download limits: max 5 documents per 10-minute window.' },
      { order: 5, title: 'Audit Trail Review', description: 'Cross-reference download logs with user profile to check for compromised accounts.' },
      { order: 6, title: 'Notify Data Protection Officer', description: 'If PII was accessed, initiate data breach notification procedure per IT Act 2000.' },
    ],
    mitre_tactics: ['TA0009 Collection', 'TA0010 Exfiltration'],
    estimated_time_minutes: 60,
  },
  {
    id: 'pb-sqli',
    title: 'SQL Injection Mitigation',
    attack_type: 'sql_injection',
    severity_range: 'critical',
    description: 'Respond to attempts pointing towards SQL injection syntax in inputs.',
    steps: [
      { order: 1, title: 'Identify Injection Vector', description: 'Review the extracted payload to determine which endpoint and parameter is targeted.' },
      { order: 2, title: 'Update WAF Rules', description: 'Ensure Web Application Firewall blocks incoming requests matching this SQLi signature immediately.' },
      { order: 3, title: 'Audit Prepared Statements', description: 'Review the codebase around the affected endpoint to ensure parameterized queries are used exclusively.' },
      { order: 4, title: 'Check Data Integrity', description: 'Run database integrity checks to verify no data was exfiltrated or modified.' },
    ],
    mitre_tactics: ['TA0001 Initial Access', 'TA0040 Impact'],
    estimated_time_minutes: 60,
  },
  {
    id: 'pb-token-hijack',
    title: 'Token Hijack Mitigation',
    attack_type: 'token_hijack_attempt',
    severity_range: 'critical',
    description: 'Respond to OAuth token hijacking or session forgery attempts targeting DigiLocker authentication.',
    steps: [
      { order: 1, title: 'Detect Forged Token', description: 'Validate token signatures. Look for mismatched origin IPs or expired/replayed tokens.' },
      { order: 2, title: 'Revoke All Sessions', description: 'Invalidate all active OAuth tokens for the affected user immediately.' },
      { order: 3, title: 'Rotate Signing Keys', description: 'If key compromise is suspected, rotate OAuth signing keys across all services.' },
      { order: 4, title: 'Implement Token Binding', description: 'Bind tokens to source IP and device fingerprint to prevent replay attacks.' },
      { order: 5, title: 'Alert Affected Users', description: 'Notify affected users via email/SMS to review account activity and change passwords.' },
    ],
    mitre_tactics: ['TA0006 Credential Access', 'TA0005 Defense Evasion'],
    estimated_time_minutes: 30,
  },
  {
    id: 'pb-api-abuse',
    title: 'API Abuse Containment',
    attack_type: 'api_abuse',
    severity_range: 'medium-high',
    description: 'Contain and mitigate automated API abuse including scraping, enumeration, and denial-of-service.',
    steps: [
      { order: 1, title: 'Identify Abuse Pattern', description: 'Detect requests exceeding 100/min per API key. Check user-agent strings for bot signatures.' },
      { order: 2, title: 'Apply Throttling', description: 'Enable graduated throttling: warning at 50 req/min, block at 100 req/min.' },
      { order: 3, title: 'Revoke API Keys', description: 'Disable compromised or abused API keys and notify the key owner.' },
      { order: 4, title: 'Deploy CAPTCHA', description: 'Introduce challenge-response verification on high-value endpoints.' },
      { order: 5, title: 'Implement Request Signing', description: 'Require HMAC-signed requests for sensitive API endpoints.' },
      { order: 6, title: 'Review API Surface', description: 'Audit exposed endpoints, remove unnecessary ones, add authentication where missing.' },
    ],
    mitre_tactics: ['TA0001 Initial Access', 'TA0040 Impact'],
    estimated_time_minutes: 40,
  },
  {
    id: 'pb-xss',
    title: 'Cross-Site Scripting (XSS) Response',
    attack_type: 'xss_attempt',
    severity_range: 'medium-high',
    description: 'Respond to XSS payloads injected into user inputs or search bars.',
    steps: [
      { order: 1, title: 'Identify Sink', description: 'Locate where the unsanitized input is rendered in the DOM.' },
      { order: 2, title: 'Apply Output Encoding', description: 'Ensure the affected frontend component uses proper HTML escaping or sanitization.' },
      { order: 3, title: 'Deploy CSP Policy', description: 'Update the Content-Security-Policy header to restrict inline scripts and unauthorized domains.' },
    ],
    mitre_tactics: ['TA0001 Initial Access'],
    estimated_time_minutes: 30,
  },
  {
    id: 'pb-suspicious-login',
    title: 'Suspicious Login Investigation',
    attack_type: 'suspicious_login',
    severity_range: 'medium-high',
    description: 'Investigate and respond to logins from unusual devices, locations, or times indicating possible account compromise.',
    steps: [
      { order: 1, title: 'Validate Login Context', description: 'Check device fingerprint, geolocation, and login time against user baseline behavior.' },
      { order: 2, title: 'Challenge User', description: 'Send verification challenge via registered email/phone before granting access.' },
      { order: 3, title: 'Review Session Activity', description: 'Audit actions performed during the suspicious session for data access or changes.' },
      { order: 4, title: 'Enable Geo-Fencing', description: 'Restrict logins to user baseline countries. Flag logins with impossible travel velocity.' },
      { order: 5, title: 'Deploy Adaptive MFA', description: 'Trigger step-up authentication for high-risk login contexts automatically.' },
    ],
    mitre_tactics: ['TA0001 Initial Access', 'TA0003 Persistence'],
    estimated_time_minutes: 25,
  },
];

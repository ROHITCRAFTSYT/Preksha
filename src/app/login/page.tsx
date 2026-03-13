'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { signIn, getSession, signInWithGoogle } from '@/lib/supabase';
import { FlickeringGrid } from '@/components/FlickeringGrid';

// ─── Inner component that uses useSearchParams ────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') ?? 'free';

  // Validate redirect to prevent open-redirect attacks: must be a relative path
  const rawRedirect = searchParams.get('redirect') ?? '/dashboard';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';

  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess]   = useState('');
  const [checking, setChecking] = useState(true);

  // Surface OAuth errors passed back via ?error= from /api/auth/callback
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) setError(decodeURIComponent(oauthError));
  }, [searchParams]);

  // ── If already logged in, skip login page entirely ────────────────────────
  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.replace(redirect);
      } else {
        setChecking(false);
      }
    });
  }, [redirect, router]);

  // Fade in title
  const [titleVisible, setTitleVisible] = useState(false);
  useEffect(() => {
    if (!checking) setTimeout(() => setTitleVisible(true), 100);
  }, [checking]);

  // Show blank screen while checking session (avoids login flash)
  if (checking) {
    return (
      <div className="relative min-h-screen bg-black flex items-center justify-center font-mono overflow-hidden">
        <FlickeringGrid
          className="absolute inset-0 z-0"
          color="rgb(74, 222, 128)"
          maxOpacity={0.12}
          flickerChance={0.3}
          squareSize={4}
          gridGap={6}
        />
        <div className="relative z-10 text-green-400/40 text-[10px] tracking-widest animate-pulse">CHECKING SESSION…</div>
      </div>
    );
  }

  // ── Google OAuth handler ────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);
    const { error: oauthErr } = await signInWithGoogle();
    if (oauthErr) {
      setError(oauthErr.message);
      setGoogleLoading(false);
    }
    // On success: Supabase redirects the browser — no further action needed here
  }

  // ── Email/password handler ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName, planId }),
        });
        const json = await res.json() as { error?: string; message?: string };
        if (!res.ok) { setError(json.error ?? 'Registration failed'); return; }
        setSuccess('Account created! Signing you in…');
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) { setError(signInErr.message); return; }
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        router.push(redirect);
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json() as { error?: string };
        if (!res.ok) { setError(json.error ?? 'Login failed'); return; }
        await signIn(email, password);
        router.push(redirect);
      }
    } finally {
      setLoading(false);
    }
  }

  const planLabels: Record<string, { label: string; color: string }> = {
    free:       { label: 'Individual — Free',      color: 'text-indigo-400'  },
    pro:        { label: 'Company — ₹999/mo',       color: 'text-purple-400' },
    enterprise: { label: 'Enterprise — ₹4,999/mo', color: 'text-pink-400'   },
  };
  const planMeta = planLabels[planId] ?? planLabels.free;

  return (
    <main className="relative min-h-screen bg-black font-mono flex items-center justify-center px-4 overflow-hidden">
      {/* FlickeringGrid background */}
      <FlickeringGrid
        className="absolute inset-0 z-0"
        color="rgb(74, 222, 128)"
        maxOpacity={0.12}
        flickerChance={0.3}
        squareSize={4}
        gridGap={6}
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white/20" />
      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white/20" />
      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white/20" />
      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white/20" />

      {/* Nav */}
      <div className="absolute top-0 left-0 right-0 border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-base tracking-widest italic -skew-x-6 text-white">
          RESILIENCE<span className="text-green-400">OS</span>
        </Link>
        <Link href="/pricing" className="text-[10px] text-white/40 hover:text-white transition-colors tracking-widest">
          PRICING
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Top label */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[9px] text-white/30 tracking-[0.3em]">
            {mode === 'login' ? 'AUTHENTICATION' : 'CREATE ACCOUNT'}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Title */}
        <div className={`transition-opacity duration-700 ${titleVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-2xl font-bold tracking-widest text-white mb-1">
            {mode === 'login' ? 'SIGN IN' : 'SIGN UP'}
          </h1>
          <p className="text-[11px] text-white/40 mb-6 tracking-wider">
            {mode === 'login'
              ? 'Access your ResilienceOS dashboard'
              : `Creating account on ${planMeta.label} plan`}
          </p>
        </div>

        {/* Plan badge (signup only) */}
        {mode === 'signup' && planId !== 'free' && (
          <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1 border border-white/10 bg-white/5 text-[10px] ${planMeta.color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {planMeta.label}
          </div>
        )}

        {/* ── Google Sign-In ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white text-[11px] tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          {googleLoading ? (
            <span className="text-white/60 tracking-widest text-[10px] animate-pulse">REDIRECTING TO GOOGLE…</span>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{mode === 'login' ? 'SIGN IN WITH GOOGLE' : 'SIGN UP WITH GOOGLE'}</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[9px] text-white/20 tracking-widest">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* ── Email / Password Form ────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[9px] text-white/40 tracking-widest mb-1">FULL NAME</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                maxLength={100}
                placeholder="John Doe"
                className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-green-400/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[9px] text-white/40 tracking-widest mb-1">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              maxLength={254}
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-green-400/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[9px] text-white/40 tracking-widest mb-1">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-green-400/50 transition-colors"
            />
            {mode === 'signup' && (
              <p className="text-[8px] text-white/20 mt-1 tracking-wide">Minimum 8 characters</p>
            )}
          </div>

          {/* Error / success */}
          {error && (
            <div className="border border-red-500/30 bg-red-500/5 px-3 py-2 text-[10px] text-red-400">
              ✕ {error}
            </div>
          )}
          {success && (
            <div className="border border-green-400/30 bg-green-400/5 px-3 py-2 text-[10px] text-green-400">
              ✓ {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 bg-green-400 text-black text-xs font-bold tracking-widest hover:bg-green-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading
              ? (mode === 'login' ? 'SIGNING IN…' : 'CREATING ACCOUNT…')
              : (mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →')}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
            className="text-[10px] text-white/30 hover:text-white/70 transition-colors tracking-wider"
          >
            {mode === 'login' ? 'No account? SIGN UP' : 'Have account? SIGN IN'}
          </button>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Bottom links */}
        <div className="mt-6 text-center space-y-2">
          <Link href="/pricing" className="block text-[9px] text-white/20 hover:text-white/50 transition-colors tracking-widest">
            VIEW PRICING PLANS
          </Link>
          <p className="text-[8px] text-white/15 tracking-wider">
            By signing up you agree to our Terms of Service
          </p>
        </div>
      </div>
    </main>
  );
}

// ─── Page wrapper with Suspense ───────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-green-400 text-xs tracking-widest animate-pulse">LOADING…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

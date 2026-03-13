'use client';
import { useEffect, useState, useCallback } from 'react';
import { TextScramble } from '@/components/TextScramble';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { renderCanvas, destroyCanvas } from '@/lib/canvasTrail';
import { HoverButton } from '@/components/HoverButton';
import { WavePath } from '@/components/WavePath';
import { MarqueeAnimation } from '@/components/MarqueeAnimation';
import { getSession, signOut, supabase } from '@/lib/supabase';
import type { DbService, DbIncident } from '@/lib/supabase';

export default function HeroPage() {
  const router = useRouter();
  const [scrambleTrigger] = useState(true);
  const [subTrigger, setSubTrigger] = useState(false);

  // ── Live stats ─────────────────────────────────────────────────────────────
  const [liveStats, setLiveStats] = useState({
    services: 24,
    uptime: '99.7%',
    incidents: 0,
    loaded: false,
  });

  useEffect(() => {
    async function fetchStats() {
      const [{ data: svcs }, { data: incs }] = await Promise.all([
        supabase.from('services').select('uptime_percent'),
        supabase
          .from('incidents')
          .select('id, resolved, created_at')
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      const rows = svcs as Pick<DbService, 'uptime_percent'>[] | null;
      const incRows = incs as Pick<DbIncident, 'id' | 'resolved' | 'created_at'>[] | null;

      if (!rows || rows.length === 0) return; // stay on defaults if DB not connected

      const avgUptime = rows.reduce((acc, s) => acc + s.uptime_percent, 0) / rows.length;
      const todayIncidents = (incRows ?? []).filter((i) => !i.resolved).length;

      setLiveStats({
        services: rows.length,
        uptime: `${avgUptime.toFixed(1)}%`,
        incidents: todayIncidents,
        loaded: true,
      });
    }
    fetchStats();
  }, []);

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [userEmail, setUserEmail]     = useState('');
  const [authReady, setAuthReady]     = useState(false); // hide auth UI until checked

  useEffect(() => {
    renderCanvas();
    const subTimer = setTimeout(() => setSubTrigger(true), 800);
    return () => {
      destroyCanvas();
      clearTimeout(subTimer);
    };
  }, []);

  // Check session once on mount — fast, reads from Supabase local store
  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUserEmail(session.user.email ?? '');
      }
      setAuthReady(true);
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    // Also clear our HttpOnly cookies via the logout API
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsLoggedIn(false);
    setUserEmail('');
    router.refresh();
  }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* Canvas trail background */}
      <canvas
        id="resilienceos-canvas"
        className="absolute inset-0 w-full h-full z-0 pointer-events-none"
      />

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-20 border-b border-white/20 bg-black/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="font-mono text-white text-xl lg:text-2xl font-bold tracking-widest italic transform -skew-x-12">
              RESILIENCE<span className="text-green-400">OS</span>
            </div>
            <div className="h-3 lg:h-4 w-px bg-white/40" />
            <span className="text-white/60 text-[8px] lg:text-[10px] font-mono">DIGITAL SERVICES MONITOR</span>
          </div>

          {/* Nav links — swap based on auth state */}
          <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-white/60">
            <Link href="/features" className="hover:text-white transition-colors tracking-widest">
              FEATURES
            </Link>

            {/* Only show PRICING when logged out */}
            {authReady && !isLoggedIn && (
              <>
                <div className="w-1 h-1 bg-white/40 rounded-full" />
                <Link href="/pricing" className="hover:text-white transition-colors tracking-widest">
                  PRICING
                </Link>
              </>
            )}

            <div className="w-1 h-1 bg-white/40 rounded-full" />

            {/* SIGN IN → LOGOUT swap */}
            {authReady && (
              isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="hover:text-red-400 transition-colors tracking-widest text-white/60"
                >
                  LOGOUT
                </button>
              ) : (
                <Link href="/login" className="hover:text-white transition-colors tracking-widest">
                  SIGN IN
                </Link>
              )
            )}

            <div className="w-1 h-1 bg-white/40 rounded-full" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              ALL SYSTEMS NOMINAL
            </span>
            <div className="w-1 h-1 bg-white/40 rounded-full" />
            <span>v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Corner Frame Accents */}
      <div className="absolute top-0 left-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-l-2 border-white/30 z-20" />
      <div className="absolute top-0 right-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-r-2 border-white/30 z-20" />
      <div className="absolute left-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-l-2 border-white/30 z-20" style={{ bottom: '5vh' }} />
      <div className="absolute right-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-r-2 border-white/30 z-20" style={{ bottom: '5vh' }} />

      {/* Left side vertical bar — desktop only */}
      <div className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-3">
        <div className="text-[9px] font-mono text-white/40" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          MONITORING ACTIVE
        </div>
        <div className="flex flex-col gap-1 items-center">
          {[8, 14, 10, 18, 6, 12, 16, 9].map((h, i) => (
            <div key={i} className="w-1 bg-green-400/60" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>

      {/* CTA Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-end pt-16 lg:pt-0" style={{ marginTop: '5vh' }}>
        <div className="w-full lg:w-1/2 px-6 lg:px-16 lg:pr-[10%]">
          <div className="max-w-lg relative lg:ml-auto">

            {/* Top decorative wave line */}
            <div className="flex items-center gap-2 mb-3 opacity-60">
              <div className="w-8 h-px bg-white/60 flex-shrink-0" />
              <span className="text-green-400 text-[10px] font-mono tracking-wider flex-shrink-0">■</span>
              <WavePath className="text-white/60" />
            </div>

            {/* Badge — show username when logged in */}
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 border border-green-400/40 bg-green-400/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {authReady && isLoggedIn ? (
                <span className="text-green-400 text-[10px] font-mono tracking-widest">
                  LOGGED IN AS {userEmail.split('@')[0].toUpperCase()}
                </span>
              ) : (
                <span className="text-green-400 text-[10px] font-mono tracking-widest">
                  REAL-TIME RESILIENCE PLATFORM
                </span>
              )}
            </div>

            {/* Main Title — scramble effect */}
            <div className="relative mb-1">
              <div className="hidden lg:block absolute -right-3 top-0 bottom-0 w-1 dither-pattern opacity-40" />
              <TextScramble
                as="h1"
                className="text-3xl lg:text-5xl font-bold text-white leading-tight font-mono tracking-wider"
                duration={1.2}
                speed={0.04}
                trigger={scrambleTrigger}
              >
                RESILIENCEOS
              </TextScramble>
            </div>

            {/* Subtitle — scramble effect */}
            <TextScramble
              as="h2"
              className="text-sm lg:text-lg font-mono text-green-400 mb-4 tracking-widest"
              duration={1.0}
              speed={0.04}
              trigger={subTrigger}
            >
              DIGITAL SERVICES RESILIENCE HUB
            </TextScramble>

            {/* Decorative dots — desktop only */}
            <div className="hidden lg:flex gap-1 mb-3 opacity-40">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-0.5 h-0.5 bg-white rounded-full" />
              ))}
            </div>

            {/* Description */}
            <div className="relative">
              <p className="text-xs lg:text-sm text-gray-300 mb-5 lg:mb-6 leading-relaxed font-mono opacity-80">
                Detect outages instantly. Monitor service health across all government digital infrastructure. Simulate failures with Chaos Mode and discover fallback routes — keeping citizens connected when it matters most.
              </p>
              <div className="hidden lg:block absolute -left-4 top-1/2 w-3 h-3 border border-white opacity-30" style={{ transform: 'translateY(-50%)' }}>
                <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white" style={{ transform: 'translate(-50%, -50%)' }} />
              </div>
            </div>

            {/* Stats row — desktop only */}
            <div className="hidden lg:grid grid-cols-3 gap-4 mb-6 border border-white/10 p-3 bg-black/30 backdrop-blur-sm">
              {[
                { label: 'SERVICES TRACKED', value: String(liveStats.services) },
                { label: 'UPTIME', value: liveStats.uptime },
                { label: 'INCIDENTS TODAY', value: String(liveStats.incidents) },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className={`text-lg font-bold font-mono transition-colors ${!liveStats.loaded ? 'text-green-400/40 animate-pulse' : stat.label === 'INCIDENTS TODAY' && liveStats.incidents > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {stat.value}
                  </div>
                  <div className="text-[9px] font-mono text-white/40 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ── Buttons — swap based on auth ── */}
            {authReady && (
              isLoggedIn ? (
                /* Logged-in state: OPEN DASHBOARD + CHAOS MODE */
                <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                  <Link href="/dashboard" className="w-full lg:w-auto">
                    <HoverButton
                      className="w-full px-6 py-3 text-xs lg:text-sm font-bold"
                      backgroundColor="#052e16"
                      glowColor="#4ade80"
                      textColor="#ffffff"
                      hoverTextColor="#86efac"
                    >
                      OPEN DASHBOARD
                    </HoverButton>
                  </Link>
                  <Link href="/dashboard?chaos=true" className="w-full lg:w-auto">
                    <HoverButton
                      className="w-full px-6 py-3 text-xs lg:text-sm"
                      backgroundColor="#1c0a0a"
                      glowColor="#f87171"
                      textColor="#f87171"
                      hoverTextColor="#fca5a5"
                    >
                      ⚡ CHAOS MODE
                    </HoverButton>
                  </Link>
                </div>
              ) : (
                /* Logged-out state: GET STARTED FREE + VIEW PRICING */
                <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                  <Link href="/login?mode=signup&plan=free" className="w-full lg:w-auto">
                    <HoverButton
                      className="w-full px-6 py-3 text-xs lg:text-sm font-bold"
                      backgroundColor="#052e16"
                      glowColor="#4ade80"
                      textColor="#ffffff"
                      hoverTextColor="#86efac"
                    >
                      GET STARTED FREE
                    </HoverButton>
                  </Link>
                  <Link href="/pricing" className="w-full lg:w-auto">
                    <HoverButton
                      className="w-full px-6 py-3 text-xs lg:text-sm"
                      backgroundColor="#0a0a1c"
                      glowColor="#818cf8"
                      textColor="#818cf8"
                      hoverTextColor="#a5b4fc"
                    >
                      VIEW PRICING →
                    </HoverButton>
                  </Link>
                </div>
              )
            )}

            {/* Placeholder to avoid layout shift while auth is loading */}
            {!authReady && (
              <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                <div className="w-full lg:w-40 h-11 bg-white/5 border border-white/10 animate-pulse" />
                <div className="w-full lg:w-36 h-11 bg-white/5 border border-white/10 animate-pulse" />
              </div>
            )}

            {/* Bottom notation — desktop only */}
            <div className="hidden lg:flex items-center gap-2 mt-6 opacity-40">
              <span className="text-white text-[9px] font-mono">■</span>
              <div className="flex-1 h-px bg-white" />
              <span className="text-white text-[9px] font-mono">RESILIENCE.OS.PROTOCOL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="absolute left-0 right-0 z-20 border-t border-white/20 bg-black/40 backdrop-blur-sm" style={{ bottom: '5vh' }}>
        <div className="container mx-auto px-4 lg:px-8 py-2 lg:py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-6 text-[8px] lg:text-[9px] font-mono text-white/50">
            <span className="hidden lg:inline">SYSTEM.ACTIVE</span>
            <span className="lg:hidden">SYS.ACT</span>
            <div className="hidden lg:flex gap-1 items-end">
              {[8, 14, 10, 18, 6, 12, 16, 9].map((h, i) => (
                <div key={i} className="w-1 bg-green-400/40" style={{ height: `${h}px` }} />
              ))}
            </div>
            <span>V1.0.0</span>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 text-[8px] lg:text-[9px] font-mono text-white/50">
            <span className="hidden lg:inline">◐ MONITORING</span>
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-green-400/60 rounded-full animate-pulse" />
              <div className="w-1 h-1 bg-green-400/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-1 h-1 bg-green-400/20 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="hidden lg:inline">UPTIME: {liveStats.uptime}</span>
          </div>
        </div>
      </div>

      {/* Marquee Banner — scrolling names */}
      <div className="absolute bottom-0 left-0 right-0 z-20 py-3 bg-black/60 backdrop-blur-sm border-t border-white/10 overflow-hidden">
        <MarqueeAnimation
          baseVelocity={4}
          direction="left"
          className="text-white/20 text-2xl tracking-[0.3em] font-mono"
        >
          ROHIT ★ PREKSHA ★ SRUSHTI ★ JAKSHITH ★
        </MarqueeAnimation>
        <MarqueeAnimation
          baseVelocity={3}
          direction="right"
          className="text-green-400/20 text-2xl tracking-[0.3em] font-mono"
        >
          SYBAGNG ★ SYBAGNG ★ SYBAGNG ★ SYBAGNG ★
        </MarqueeAnimation>
      </div>

      <style jsx>{`
        .dither-pattern {
          background-image:
            repeating-linear-gradient(0deg, transparent 0px, transparent 1px, white 1px, white 2px),
            repeating-linear-gradient(90deg, transparent 0px, transparent 1px, white 1px, white 2px);
          background-size: 3px 3px;
        }
      `}</style>
    </main>
  );
}

import Link from "next/link";
import { Features } from "@/components/Features";
import { ShootingStars } from "@/components/ShootingStars";
import { TechCarousel } from "@/components/TechCarousel";

export const metadata = {
  title: "Features — ResilienceOS",
  description: "Platform capabilities for real-time government service monitoring and resilience testing.",
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-black font-mono relative overflow-hidden">
      {/* Shooting stars background — 6 layers ensure stars are always visible */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Layer 1 — default purple/cyan, medium */}
        <ShootingStars
          minSpeed={10}
          maxSpeed={28}
          minDelay={400}
          maxDelay={900}
          starWidth={14}
          starHeight={1}
        />
        {/* Layer 2 — green, slightly slower */}
        <ShootingStars
          minSpeed={8}
          maxSpeed={22}
          minDelay={500}
          maxDelay={1100}
          starWidth={10}
          starHeight={1}
          starColor="#86efac"
          trailColor="#4ade80"
        />
        {/* Layer 3 — cyan, fast */}
        <ShootingStars
          minSpeed={14}
          maxSpeed={32}
          minDelay={350}
          maxDelay={800}
          starWidth={12}
          starHeight={1}
          starColor="#67e8f9"
          trailColor="#22d3ee"
        />
        {/* Layer 4 — violet, slow + wide */}
        <ShootingStars
          minSpeed={6}
          maxSpeed={18}
          minDelay={600}
          maxDelay={1200}
          starWidth={18}
          starHeight={1}
          starColor="#c4b5fd"
          trailColor="#7c3aed"
        />
        {/* Layer 5 — white, ultra-fast flashes */}
        <ShootingStars
          minSpeed={20}
          maxSpeed={40}
          minDelay={300}
          maxDelay={700}
          starWidth={8}
          starHeight={1}
          starColor="#f8fafc"
          trailColor="#cbd5e1"
        />
        {/* Layer 6 — yellow-green, medium */}
        <ShootingStars
          minSpeed={9}
          maxSpeed={24}
          minDelay={450}
          maxDelay={1000}
          starWidth={11}
          starHeight={1}
          starColor="#bef264"
          trailColor="#84cc16"
        />
      </div>

      {/* Top nav — same style as dashboard */}
      <div className="border-b border-white/10 sticky top-0 z-30 bg-black/90 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/50 hover:text-white text-[10px] tracking-widest transition-colors"
            >
              ← BACK
            </Link>
            <div className="w-px h-4 bg-white/20" />
            <div className="font-bold text-base tracking-widest italic -skew-x-6 text-white">
              RESILIENCE<span className="text-green-400">OS</span>
            </div>
            <span className="text-[9px] text-white/30 tracking-widest hidden lg:inline">· FEATURES</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-[9px] font-bold tracking-widest border border-green-400/40 text-green-400 hover:bg-green-400/10 transition-all"
            >
              OPEN DASHBOARD →
            </Link>
          </div>
        </div>
      </div>

      {/* Features section + footer — z-10 keeps them above the star layer */}
      <div className="relative z-10">
        <Features />

        {/* Tech + Services Carousel */}
        <TechCarousel />

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-6 text-center">
          <div className="text-[9px] text-white/20 tracking-[0.3em]">
            RESILIENCEOS · DIGITAL SERVICES RESILIENCE PLATFORM · V1.0.0
          </div>
        </div>
      </div>
    </div>
  );
}

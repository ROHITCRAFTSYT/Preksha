"use client";
import { useEffect, useState } from "react";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";

type LogoItem = {
  name: string;
  icon: string;
  type: "tech" | "service";
  color: string;
};

const LOGOS: LogoItem[] = [
  // Tech stack
  { name: "Next.js",     icon: "▲", type: "tech",    color: "text-white/80" },
  { name: "Supabase",    icon: "⚡", type: "tech",    color: "text-green-400" },
  { name: "Groq AI",     icon: "◈", type: "tech",    color: "text-orange-400" },
  { name: "TypeScript",  icon: "TS", type: "tech",   color: "text-blue-400" },
  { name: "Tailwind",    icon: "✦",  type: "tech",   color: "text-cyan-400" },
  { name: "Google Auth", icon: "G",  type: "tech",   color: "text-red-400" },
  { name: "PostgreSQL",  icon: "🐘", type: "tech",   color: "text-blue-300" },
  // Monitored services
  { name: "EPFO",        icon: "PF", type: "service", color: "text-yellow-400" },
  { name: "GST Portal",  icon: "₹",  type: "service", color: "text-green-300" },
  { name: "CoWIN",       icon: "💉", type: "service", color: "text-teal-400" },
  { name: "DigiLocker",  icon: "🔐", type: "service", color: "text-purple-400" },
  { name: "Income Tax",  icon: "IT", type: "service", color: "text-amber-400" },
  { name: "Passport",    icon: "✈",  type: "service", color: "text-sky-400" },
  { name: "UMANG",       icon: "☰",  type: "service", color: "text-pink-400" },
  { name: "Ration Card", icon: "◉",  type: "service", color: "text-lime-400" },
];

export function TechCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const timer = setTimeout(() => {
      if (api.selectedScrollSnap() + 1 === api.scrollSnapList().length) {
        setCurrent(0);
        api.scrollTo(0);
      } else {
        api.scrollNext();
        setCurrent((c) => c + 1);
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [api, current]);

  return (
    <div className="w-full py-20 border-t border-white/[0.06] bg-black">
      <div className="max-w-screen-xl mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col gap-2 mb-12">
          <div className="text-[9px] text-white/20 tracking-[0.3em]">POWERED BY · MONITORING</div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white/80">
            Built on modern infrastructure.{" "}
            <span className="text-green-400">Watching critical India.</span>
          </h2>
          <p className="text-[11px] text-white/30 tracking-wide max-w-lg mt-1">
            ResilienceOS combines best-in-class developer tooling with real-time monitoring of
            8 government portals across 5 regional nodes.
          </p>
        </div>

        {/* Two-row label */}
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[9px] text-white/30 tracking-widest">TECH STACK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[9px] text-white/30 tracking-widest">MONITORED SERVICES</span>
          </div>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {LOGOS.map((logo, i) => (
              <CarouselItem
                key={i}
                className="pl-3 basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/7"
              >
                <div className="flex flex-col items-center justify-center gap-2.5 border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all p-4 h-20 group cursor-default">
                  {/* Badge dot */}
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <div className={`w-1 h-1 rounded-full flex-shrink-0 ${
                      logo.type === "tech" ? "bg-blue-400/60" : "bg-green-400/60"
                    }`} />
                    <span className={`text-[13px] font-bold ${logo.color} group-hover:scale-110 transition-transform`}>
                      {logo.icon}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/35 tracking-widest text-center leading-tight group-hover:text-white/60 transition-colors">
                    {logo.name.toUpperCase()}
                  </span>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-px border border-white/[0.06] mt-10">
          {[
            { value: "8",     label: "Services Monitored" },
            { value: "5",     label: "Regional Nodes" },
            { value: "15s",   label: "Refresh Cycle" },
            { value: "800M+", label: "Citizens Protected" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center py-6 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
              <div className="text-2xl font-bold text-green-400 tabular-nums">{value}</div>
              <div className="text-[9px] text-white/25 tracking-widest mt-1">{label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

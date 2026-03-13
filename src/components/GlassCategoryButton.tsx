'use client';
import React from 'react';

// ─── SVG Distortion Filter (render once per page) ─────────────────────────────
export function GlassDistortionFilter() {
  return (
    <svg style={{ display: 'none', position: 'absolute' }} aria-hidden>
      <defs>
        <filter
          id="glass-distortion-dark"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0015 0.006"
            numOctaves="1"
            seed="17"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="4"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ─── Glass Category Button ─────────────────────────────────────────────────────
interface GlassCategoryButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function GlassCategoryButton({
  label,
  active,
  onClick,
}: GlassCategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center overflow-hidden cursor-pointer select-none
                 transition-all duration-500 rounded-full"
      style={{
        padding: active ? '6px 16px' : '5px 14px',
        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 2.2)',
        boxShadow: active
          ? '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.12)'
          : '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Layer 1: backdrop blur + SVG distortion ─────────────────────── */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          filter: 'url(#glass-distortion-dark)',
          isolation: 'isolate',
        }}
      />

      {/* ── Layer 2: tinted fill ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-500"
        style={{
          background: active
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.05)',
        }}
      />

      {/* ── Layer 3: inner highlight (top-left rim light) ────────────────── */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-500"
        style={{
          boxShadow: active
            ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.45), inset -1px -1px 1px rgba(255,255,255,0.2)'
            : 'inset 1px 1px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.05)',
        }}
      />

      {/* ── Layer 4: subtle gradient sheen ──────────────────────────────── */}
      <div
        className="absolute inset-x-0 top-0 rounded-full transition-opacity duration-500"
        style={{
          height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
          opacity: active ? 1 : 0.5,
          borderRadius: '9999px 9999px 0 0',
        }}
      />

      {/* ── Text ──────────────────────────────────────────────────────────── */}
      <span
        className="relative z-10 font-mono tracking-widest transition-all duration-300"
        style={{
          fontSize: '10px',
          color: active ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.45)',
          fontWeight: active ? 700 : 500,
          textShadow: active ? '0 0 12px rgba(255,255,255,0.4)' : 'none',
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </span>
    </button>
  );
}

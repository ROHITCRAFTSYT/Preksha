'use client';
import { useEffect, useRef, ReactNode } from 'react';

// Hue bases per glow color
const glowColorMap = {
  white:  { base: 0,   spread: 0   },
  red:    { base: 0,   spread: 30  },
  orange: { base: 20,  spread: 40  },
  green:  { base: 120, spread: 40  },
  blue:   { base: 210, spread: 40  },
};

type GlowColor = keyof typeof glowColorMap;

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
}

const CSS = `
  [data-glow-card]::before,
  [data-glow-card]::after {
    pointer-events: none;
    content: "";
    position: absolute;
    inset: calc(var(--border-size) * -1);
    border: var(--border-size) solid transparent;
    border-radius: calc(var(--radius) * 1px);
    background-attachment: fixed;
    background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
    background-repeat: no-repeat;
    background-position: 50% 50%;
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }

  [data-glow-card]::before {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 0) calc(var(--saturation, 80) * 1%) calc(var(--lightness, 55) * 1%) / var(--border-spot-opacity, 0.8)),
      transparent 100%
    );
    filter: brightness(2);
  }

  [data-glow-card]::after {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(0 100% 100% / var(--border-light-opacity, 0.6)),
      transparent 100%
    );
  }

  [data-glow-card] [data-glow-inner] {
    position: absolute;
    inset: 0;
    will-change: filter;
    opacity: var(--outer, 1);
    border-radius: calc(var(--radius) * 1px);
    border-width: calc(var(--border-size) * 20);
    filter: blur(calc(var(--border-size) * 10));
    background: none;
    pointer-events: none;
    border: none;
  }

  [data-glow-card] > [data-glow-inner]::before {
    inset: -10px;
    border-width: 10px;
  }
`;

export default function GlowCard({
  children,
  className = '',
  glowColor = 'white',
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', e.clientX.toFixed(2));
        cardRef.current.style.setProperty('--xp', (e.clientX / window.innerWidth).toFixed(2));
        cardRef.current.style.setProperty('--y', e.clientY.toFixed(2));
        cardRef.current.style.setProperty('--yp', (e.clientY / window.innerHeight).toFixed(2));
      }
    };
    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const inlineStyle = {
    '--base':               base,
    '--spread':             spread,
    '--radius':             '0',
    '--border':             '1',
    '--backdrop':           'hsl(0 0% 100% / 0.02)',
    '--backup-border':      'hsl(0 0% 100% / 0.08)',
    '--size':               '220',
    '--outer':              '1',
    '--border-size':        'calc(var(--border, 1) * 1px)',
    '--spotlight-size':     'calc(var(--size, 220) * 1px)',
    '--hue':                'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 0) calc(var(--saturation, 60) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.06)),
      transparent
    )`,
    backgroundColor:        'var(--backdrop, transparent)',
    backgroundSize:         'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition:     '50% 50%',
    backgroundAttachment:   'fixed',
    border:                 'var(--border-size) solid var(--backup-border)',
    position:               'relative' as const,
    touchAction:            'none' as const,
  } as React.CSSProperties;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        ref={cardRef}
        data-glow-card
        style={inlineStyle}
        className={className}
      >
        <div data-glow-inner />
        {children}
      </div>
    </>
  );
}

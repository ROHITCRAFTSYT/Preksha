'use client';
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

type WavePathProps = React.ComponentProps<'div'>;

export function WavePath({ className, ...props }: WavePathProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  let progress = 0;
  let x = 0.5;
  let time = Math.PI / 2;
  let reqId: number | null = null;

  useEffect(() => {
    setPath(progress);
  }, []);

  const getWidth = () =>
    containerRef.current ? containerRef.current.offsetWidth : window.innerWidth;

  const setPath = (prog: number) => {
    const width = getWidth();
    path.current?.setAttributeNS(
      null,
      'd',
      `M0 50 Q${width * x} ${50 + prog * 0.55}, ${width} 50`,
    );
  };

  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  const manageMouseEnter = () => {
    if (reqId) { cancelAnimationFrame(reqId); resetAnimation(); }
  };

  const manageMouseMove = (e: React.MouseEvent) => {
    const { movementY, clientX } = e;
    if (path.current) {
      const bound = path.current.getBoundingClientRect();
      x = (clientX - bound.left) / bound.width;
      progress += movementY;
      setPath(progress);
    }
  };

  const manageMouseLeave = () => { animateOut(); };

  const animateOut = () => {
    const newProgress = progress * Math.sin(time);
    progress = lerp(progress, 0, 0.025);
    time += 0.2;
    setPath(newProgress);
    if (Math.abs(progress) > 0.75) {
      reqId = requestAnimationFrame(animateOut);
    } else {
      resetAnimation();
    }
  };

  const resetAnimation = () => { time = Math.PI / 2; progress = 0; };

  return (
    <div
      ref={containerRef}
      className={cn('relative h-px w-full', className)}
      {...props}
    >
      {/* Hover capture zone */}
      <div
        onMouseEnter={manageMouseEnter}
        onMouseMove={manageMouseMove}
        onMouseLeave={manageMouseLeave}
        className="absolute inset-x-0 -top-5 z-10 h-10 hover:-top-[60px] hover:h-[120px] transition-all duration-300"
      />
      <svg className="absolute -top-[50px] h-[100px] w-full overflow-visible">
        <path
          ref={path}
          className="fill-none stroke-current"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

interface TextRollProps {
  children: string;
  duration?: number;
  className?: string;
}

export function TextRoll({ children, duration = 600, className = "" }: TextRollProps) {
  const [displayed, setDisplayed] = useState(children);
  const prevRef = useRef(children);

  useEffect(() => {
    if (prevRef.current === children) return;
    prevRef.current = children;
    setDisplayed(children);
  }, [children]);

  return (
    <span
      className={`inline-block overflow-hidden ${className}`}
      style={{ transition: `opacity ${duration}ms ease` }}
    >
      {displayed}
    </span>
  );
}

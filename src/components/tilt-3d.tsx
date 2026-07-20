"use client";

// ---------------------------------------------------------------------------
// Tilt3D — a reusable premium card-hover effect: the card tilts in 3D
// toward the cursor using a pure CSS perspective transform, no WebGL/
// three.js scene needed. Reuses the existing --ease-luxury easing token
// (globals.css) already established for this platform's premium micro-
// interactions (site-header.tsx's wax-mark hover, etc.) rather than
// introducing a new brand look. Respects prefers-reduced-motion — the
// tilt is simply never applied for a reader who's asked for less motion,
// consistent with this codebase's existing WCAG 2.2 work.
// ---------------------------------------------------------------------------

import { useRef, useState, type ReactNode, type CSSProperties } from "react";

export function Tilt3D({
  children,
  className,
  maxTiltDeg = 8,
  onClick,
  style: baseStyle,
}: {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(900px) rotateX(${(-y * maxTiltDeg).toFixed(2)}deg) rotateY(${(x * maxTiltDeg).toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`,
      transition: "transform 80ms ease-out",
    });
  }

  function handleMouseLeave() {
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 500ms var(--ease-luxury, ease-out)",
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ ...baseStyle, ...style, willChange: "transform" }}
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

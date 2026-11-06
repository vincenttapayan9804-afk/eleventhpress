"use client";

/**
 * The AI Research Assistant's mascot: a small, friendly teal parrot with
 * big eyes, a lime crest, an orange beak and feet. Drawn as an inline SVG
 * and animated with CSS only (bobbing, blinking, wing flaps, and a
 * look-around while it searches), so it costs no image request and stays
 * crisp at every size. Motion stops for readers who prefer reduced motion
 * (see .ra-mascot in globals.css).
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking";

export function ResearchMascot({
  size = 40,
  state = "idle",
  motion = "full",
  className,
  title,
}: {
  size?: number;
  state?: MascotState;
  /** "full": bob, blink, flap. "blink": stands still and only blinks. */
  motion?: "full" | "blink";
  className?: string;
  /** Accessible name; omit when the mascot is decorative. */
  title?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const g = (name: string) => `ra-${id}-${name}`;
  const url = (name: string) => `url(#${g(name)})`;

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      // Inline size wins over parent rules that resize nested icons (e.g. Button's [&_svg]:size-4).
      style={{ width: size, height: (size * 140) / 120 }}
      className={cn("ra-mascot flex-shrink-0 overflow-visible", className)}
      data-state={state}
      data-motion={motion}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={g("head")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8EE3DC" />
          <stop offset="1" stopColor="#3FAFA8" />
        </linearGradient>
        <linearGradient id={g("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56C3BC" />
          <stop offset="0.55" stopColor="#6FC48E" />
          <stop offset="1" stopColor="#9BCB3F" />
        </linearGradient>
        <linearGradient id={g("wing")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3E9E98" />
          <stop offset="1" stopColor="#1C6461" />
        </linearGradient>
        <linearGradient id={g("beak")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7B573" />
          <stop offset="1" stopColor="#D9732C" />
        </linearGradient>
        <radialGradient id={g("iris")} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#8A6F86" />
          <stop offset="1" stopColor="#3A2838" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse className="ra-mascot-shadow" cx="60" cy="134" rx="26" ry="3.6" fill="#0f172a" opacity="0.16" />

      {/* Feet */}
      <g fill="#E8893B" stroke="#C0612A" strokeWidth="1" strokeLinejoin="round">
        <path d="M50 118 L50 126" stroke="#E8893B" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 118 L70 126" stroke="#E8893B" strokeWidth="4" strokeLinecap="round" />
        <path d="M50 124 Q42 126 40 132 Q45 131 47 129 Q48 133 51 133 Q53 130 52 128 Q56 131 59 131 Q57 126 50 124Z" />
        <path d="M70 124 Q63 126 61 131 Q64 131 68 128 Q67 130 69 133 Q72 133 73 129 Q75 131 80 132 Q78 126 70 124Z" />
      </g>

      <g className="ra-mascot-bob">
        {/* Wings, behind the body */}
        <g className="ra-mascot-wing ra-mascot-wing-l">
          <path d="M40 88 Q22 96 16 118 Q24 116 28 112 Q26 120 30 124 Q34 118 36 114 Q38 120 43 121 Q46 106 44 90Z" fill={url("wing")} />
          <path d="M22 112 Q28 106 36 104 M28 118 Q32 110 40 108" stroke="#7FD0C6" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
        </g>
        <g className="ra-mascot-wing ra-mascot-wing-r">
          <path d="M80 88 Q98 96 104 118 Q96 116 92 112 Q94 120 90 124 Q86 118 84 114 Q82 120 77 121 Q74 106 76 90Z" fill={url("wing")} />
          <path d="M98 112 Q92 106 84 104 M92 118 Q88 110 80 108" stroke="#7FD0C6" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
        </g>

        {/* Body with scaled chest feathers */}
        <ellipse cx="60" cy="100" rx="24" ry="24" fill={url("body")} />
        <g fill="none" stroke="#B4EDE2" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
          <path d="M47 92 q4 4 8 0 q4 4 8 0 q4 4 8 0" />
          <path d="M45 100 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 6 0" />
          <path d="M48 108 q4 4 8 0 q4 4 8 0 q4 4 8 0" stroke="#D6EF9C" />
        </g>

        {/* Head */}
        <g className="ra-mascot-head">
          {/* Lime crest and cheek tufts */}
          <g fill="#A9D84B" stroke="#86B934" strokeWidth="1" strokeLinejoin="round">
            <path d="M40 26 Q42 10 50 18 Q54 6 60 16 Q66 6 70 18 Q78 10 80 26Z" />
            <path d="M22 48 Q12 44 16 36 Q20 40 24 38 Q20 30 28 30Z" />
            <path d="M98 48 Q108 44 104 36 Q100 40 96 38 Q100 30 92 30Z" />
            <path d="M24 62 Q14 64 16 56 Q20 58 24 56Z" />
            <path d="M96 62 Q106 64 104 56 Q100 58 96 56Z" />
          </g>
          <ellipse cx="60" cy="52" rx="38" ry="32" fill={url("head")} />

          {/* Goggle-like eye rings */}
          <circle cx="42" cy="49" r="18" fill="#A6EAE3" stroke="#45B2AA" strokeWidth="2" />
          <circle cx="78" cy="49" r="18" fill="#A6EAE3" stroke="#45B2AA" strokeWidth="2" />

          <g className="ra-mascot-eyes">
            <circle cx="42" cy="50" r="14" fill="#FFFFFF" />
            <circle cx="78" cy="50" r="14" fill="#FFFFFF" />
            <g className="ra-mascot-pupils">
              <circle cx="43" cy="51" r="10" fill={url("iris")} />
              <circle cx="77" cy="51" r="10" fill={url("iris")} />
              <circle cx="43" cy="51" r="6" fill="#140C14" />
              <circle cx="77" cy="51" r="6" fill="#140C14" />
              <circle cx="46.5" cy="47" r="3" fill="#FFFFFF" />
              <circle cx="80.5" cy="47" r="3" fill="#FFFFFF" />
              <circle cx="40" cy="55" r="1.3" fill="#FFFFFF" opacity="0.85" />
              <circle cx="74" cy="55" r="1.3" fill="#FFFFFF" opacity="0.85" />
            </g>
            {/* Lashes */}
            <g stroke="#2B2230" strokeWidth="1.6" strokeLinecap="round">
              <path d="M30 40 L25 36 M32 37 L28 32 M35 35 L33 30" />
              <path d="M90 40 L95 36 M88 37 L92 32 M85 35 L87 30" />
            </g>
          </g>

          {/* Open, smiling beak */}
          <path d="M51 74 Q60 92 69 74 Q60 79 51 74Z" fill="#7B2D35" />
          <path d="M54 79 Q60 88 66 79 Q60 82 54 79Z" fill="#E67C8A" />
          <path d="M51 74 Q60 93 69 74" fill="none" stroke="#D9732C" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M49 61 Q60 52 71 61 Q73 71 64 77 Q60 80 56 77 Q47 71 49 61Z" fill={url("beak")} />
          <path d="M53 61 Q60 56 67 61" fill="none" stroke="#FCD3A5" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}

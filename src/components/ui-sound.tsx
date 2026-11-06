"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SOUND_PROFILE,
  UI_SOUND_SRC,
  UI_SOUND_STORAGE_KEY,
  createThrottle,
  readSoundEnabled,
  soundTarget,
  type SoundKind,
} from "@/lib/ui-sound";

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function soundEnabled(): boolean {
  return readSoundEnabled(safeStorage());
}

export function setSoundEnabled(on: boolean) {
  try {
    safeStorage()?.setItem(UI_SOUND_STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode / blocked storage: the choice lasts for this page only */
  }
  memoryPref = on;
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

// Fallback when storage throws, so the toggle still works for the session.
let memoryPref: boolean | null = null;
const isEnabled = () => memoryPref ?? soundEnabled();

/** Lazily-created Web Audio player for the one click clip. */
function createPlayer() {
  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let bytes: Promise<ArrayBuffer | null> | null = null;
  let decoding: Promise<AudioBuffer | null> | null = null;

  const fetchBytes = () =>
    (bytes ??= fetch(UI_SOUND_SRC)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null));

  /** Called from a user gesture: browsers only let audio start from one. */
  const unlock = () => {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    decoding ??= fetchBytes().then(async (b) => {
      if (!b || !ctx) return null;
      try {
        buffer = await ctx.decodeAudioData(b.slice(0));
      } catch {
        buffer = null;
      }
      return buffer;
    });
  };

  const start = (kind: SoundKind) => {
    if (!ctx || !buffer || ctx.state !== "running") return;
    const { gain, rate } = SOUND_PROFILE[kind];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    src.start();
  };

  const play = (kind: SoundKind) => {
    if (buffer) return start(kind);
    // First press of the visit: the clip is still decoding (a few ms).
    // Play it if it lands quickly; drop it otherwise rather than play late.
    if (!decoding) return;
    const asked = performance.now();
    void decoding.then(() => {
      if (performance.now() - asked < 200) start(kind);
    });
  };

  return { unlock, play, prefetch: fetchBytes };
}

/**
 * Mount once (root layout). Plays the interface click on hover / press /
 * keyboard focus of any interactive element across the whole site.
 */
export function UiSoundEffects() {
  useEffect(() => {
    const player = createPlayer();
    const allow = createThrottle();
    let hovered: unknown = null;
    let keyboardMode = false;
    let lastPointer = "mouse";

    const fire = (kind: SoundKind) => {
      if (document.visibilityState !== "visible" || !isEnabled()) return;
      if (!allow(kind, performance.now())) return;
      player.play(kind);
    };

    const onGesture = () => {
      if (isEnabled()) player.unlock();
    };

    const onPointerOver = (e: PointerEvent) => {
      // Touch "hover" fires right before every tap; the tap itself sounds.
      if (e.pointerType === "touch") return;
      const t = soundTarget(e.target);
      if (t === hovered) return;
      hovered = t;
      if (t) fire("hover");
    };

    const onPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hovered = null; // left the window
    };

    const onPointerDown = (e: PointerEvent) => {
      keyboardMode = false;
      lastPointer = e.pointerType;
      onGesture();
      // Touch presses sound on `click`, so a scroll that starts on a link stays silent.
      if (e.pointerType === "touch" || e.button !== 0) return;
      if (soundTarget(e.target)) fire("press");
    };

    const onClick = (e: MouseEvent) => {
      // detail 0 = activated from the keyboard (Enter/Space).
      if (e.detail !== 0 && lastPointer !== "touch") return;
      if (soundTarget(e.target)) fire("press");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      onGesture();
      if (e.key === "Tab" || e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
        keyboardMode = true;
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (keyboardMode && soundTarget(e.target)) fire("hover");
    };

    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1500));
    if (isEnabled()) idle(() => void player.prefetch());

    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerover", onPointerOver, opts);
    document.addEventListener("pointerout", onPointerOut, opts);
    document.addEventListener("pointerdown", onPointerDown, opts);
    document.addEventListener("click", onClick, opts);
    document.addEventListener("keydown", onKeyDown, opts);
    document.addEventListener("focusin", onFocusIn, opts);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, opts);
      document.removeEventListener("pointerout", onPointerOut, opts);
      document.removeEventListener("pointerdown", onPointerDown, opts);
      document.removeEventListener("click", onClick, opts);
      document.removeEventListener("keydown", onKeyDown, opts);
      document.removeEventListener("focusin", onFocusIn, opts);
    };
  }, []);

  return null;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === UI_SOUND_STORAGE_KEY) {
      memoryPref = null;
      cb();
    }
  };
  listeners.add(cb);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Header button that turns the interface sounds on or off. */
export function SoundToggle({ className }: { className?: string }) {
  // Server render and first client render assume "on" (the default); the
  // stored choice takes over right after hydration.
  const on = useSyncExternalStore(subscribe, isEnabled, () => true);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn interface sounds off" : "Turn interface sounds on"}
      title={on ? "Interface sounds: on" : "Interface sounds: off"}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
  );
}

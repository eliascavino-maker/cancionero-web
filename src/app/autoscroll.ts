import { useEffect, useRef, useState } from 'react';

/** Scroll speeds in px per second, slowest first. The UI shows them as 1..10. */
export const SPEED_LEVELS = [6, 8, 10, 13, 17, 22, 28, 36, 46, 60];
export const DEFAULT_LEVEL = 3;

/** `3:30`, `1:02:03` or plain seconds (`210`) to seconds. Null if unreadable or zero. */
export function parseDuration(text: string | undefined): number | null {
  if (!text) return null;
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  return seconds > 0 ? seconds : null;
}

/** Index of the level closest to a speed. */
export function nearestLevel(pxPerSecond: number): number {
  let best = 0;
  SPEED_LEVELS.forEach((s, i) => {
    if (Math.abs(s - pxPerSecond) < Math.abs(SPEED_LEVELS[best] - pxPerSecond)) best = i;
  });
  return best;
}

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Speed that reaches the end of the page in `seconds`. */
export function speedForDuration(seconds: number): number {
  return Math.max(1, maxScroll() / seconds);
}

/**
 * Scrolls the window down at `pxPerSecond` while `playing`. Calls `onEnd`
 * at the bottom of the page.
 */
export function useAutoScroll(playing: boolean, pxPerSecond: number, onEnd: () => void) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      // Time-based, so speed holds when the browser drops frames (battery
      // saver). Clamped so a tab coming back from the background does not jump.
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      carry += pxPerSecond * dt;
      const whole = Math.floor(carry);
      if (whole >= 1) {
        carry -= whole;
        window.scrollBy(0, whole);
      }
      if (window.scrollY >= maxScroll() - 1) {
        onEndRef.current();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, pxPerSecond]);
}

/** Keeps the screen on while `active`, where the browser supports it. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (stopped) l.release();
        else lock = l;
      } catch {
        // Denied (battery saver, not visible...): scrolling still works.
      }
    };
    // The browser drops the lock when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [active]);
}

const SPEEDS_KEY = 'cancionero.scrollSpeed';

function readSpeeds(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SPEEDS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Speed level chosen for one song, remembered in this browser.
 * `null` = never chosen (use the song's duration or the default).
 */
export function useSavedLevel(songKey: string | undefined): [number | null, (level: number) => void] {
  const [level, setLevel] = useState<number | null>(() => (songKey ? (readSpeeds()[songKey] ?? null) : null));
  const save = (l: number) => {
    setLevel(l);
    if (!songKey) return;
    try {
      localStorage.setItem(SPEEDS_KEY, JSON.stringify({ ...readSpeeds(), [songKey]: l }));
    } catch {
      // Storage blocked: keep it for this visit only.
    }
  };
  return [level, save];
}

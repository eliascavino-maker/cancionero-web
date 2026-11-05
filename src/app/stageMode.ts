import { useEffect, useRef } from 'react';
import { canGoFull, enterFullscreen, exitFullscreen, isImmersive } from '../components/FullscreenButton';
import { useWakeLock } from './autoscroll';
import { usePrefs } from './hooks';

/** How long the controls stay up after a tap. */
export const CHROME_MS = 4000;
/** Tapping these keeps the controls up instead of hiding them. */
const CONTROLS = '.page__header, .toolbar, dialog, .lock, .cue, button, a, input, select, summary, label';

export interface StageMode {
  on: boolean;
  toggle(): void;
}

/**
 * Modo escenario, for the live room and ▶ Tocar: very dark, big letters, the
 * screen stays on and only what's needed to play shows. A tap on the song
 * brings the rest up for a few seconds. Remembered by `Prefs.stageMode`.
 */
export function useStageMode(): StageMode {
  const [prefs, setPrefs] = usePrefs();
  const on = !!prefs.stageMode;
  /** Full screen was already asked for on this page. */
  const asked = useRef(false);
  useWakeLock(on);

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.classList.add('stage-mode');
    let timer: number | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      root.classList.remove('stage-chrome');
    };
    const show = () => {
      root.classList.add('stage-chrome');
      window.clearTimeout(timer);
      timer = window.setTimeout(hide, CHROME_MS);
    };
    const onClick = (e: MouseEvent) => {
      // Opened with modo escenario on: full screen needs a tap, so the first one asks.
      if (!asked.current) {
        asked.current = true;
        if (canGoFull() && !isImmersive()) void enterFullscreen().catch(() => {});
      }
      const shown = root.classList.contains('stage-chrome');
      const t = e.target;
      if (t instanceof Element && t.closest(CONTROLS)) {
        if (shown) show();
      } else if (shown) hide();
      else show();
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      hide();
      root.classList.remove('stage-mode');
    };
  }, [on]);

  const toggle = () => {
    asked.current = true;
    setPrefs({ ...prefs, stageMode: !on });
    if (on) void exitFullscreen().catch(() => {});
    else void enterFullscreen().catch(() => {});
  };
  return { on, toggle };
}

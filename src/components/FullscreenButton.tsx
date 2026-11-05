import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { askConfirm } from './ask';
import { Icon } from './Icon';

// Safari (Mac / iPad) still uses the webkit names.
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type El = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type Nav = Navigator & { standalone?: boolean };

const doc = () => document as Doc;
const isFull = () => !!(doc().fullscreenElement ?? doc().webkitFullscreenElement);
export const canGoFull = () => {
  const el = document.documentElement as El;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
};

/** Opened from the home screen icon: no browser bars. */
export function isInstalled(): boolean {
  if ((navigator as Nav).standalone === true) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
}

/** Full screen, or opened from the home screen (no browser bars): the stage views. */
export function isImmersive(): boolean {
  return isFull() || isInstalled();
}

// ----- the app's own full screen, where the browser has none (iPhone)

let appFull = false;
const appFullListeners = new Set<() => void>();

/** Hides the app's bars, headers and controls: only the song stays. */
function setAppFull(on: boolean) {
  if (appFull === on) return;
  appFull = on;
  document.documentElement.classList.toggle('is-immersive', on);
  appFullListeners.forEach((l) => l());
}

const subscribeAppFull = (l: () => void) => {
  appFullListeners.add(l);
  return () => void appFullListeners.delete(l);
};

const TIP_KEY = 'cancionero.fullscreenTip';
let tipShown = false;

/** In the browser (not installed): how to lose Safari's bars. Once per visit, until "No mostrar de nuevo". */
async function installTip() {
  if (tipShown || localStorage.getItem(TIP_KEY) === 'never') return;
  tipShown = true;
  const never = await askConfirm(
    'Escondo los controles de la app. Para sacar también las barras de Safari: tocá Compartir → "Agregar a inicio" y abrí el Cancionero desde ese ícono.',
    { title: 'En iPhone el navegador no deja poner pantalla completa', ok: 'No mostrar de nuevo', cancel: 'Entendido' },
  );
  if (never) localStorage.setItem(TIP_KEY, 'never');
}

export function resetFullscreenForTests() {
  setAppFull(false);
  tipShown = false;
}

/** The browser's full screen, if it has one. False where it doesn't (iPhone). */
async function requestFull(): Promise<boolean> {
  const el = document.documentElement as El;
  if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else return false;
  return true;
}

export async function exitFullscreen(): Promise<void> {
  if (isFull()) await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
}

/**
 * Modo escenario: the browser's full screen where there is one. On iPhone in
 * Safari, the tip to install it; modo escenario hides the app's own bars.
 */
export async function enterFullscreen(): Promise<void> {
  if (isImmersive()) return;
  if (!(await requestFull())) await installTip();
}

export async function toggleFullscreen(): Promise<void> {
  if (appFull) {
    setAppFull(false);
    return;
  }
  if (isFull()) {
    await exitFullscreen();
    return;
  }
  if (!(await requestFull())) {
    // iPhone: web pages can't go full screen, so the app hides its own bars.
    if (!isInstalled()) await installTip();
    setAppFull(true);
  }
}

/** Full-screen toggle. On a computer the F key does the same. */
export function FullscreenButton() {
  const [full, setFull] = useState(isFull);
  const app = useSyncExternalStore(subscribeAppFull, () => appFull);

  useEffect(() => {
    const sync = () => setFull(isFull());
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && canGoFull()) {
        e.preventDefault();
        toggleFullscreen().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      window.removeEventListener('keydown', onKey);
      // Leaving the page brings the bars back.
      setAppFull(false);
    };
  }, []);

  const on = full || app;
  const label = on ? 'Salir de pantalla completa' : 'Pantalla completa';
  return (
    <>
      <button
        className="icon-btn"
        aria-label={label}
        title={`${label} (F)`}
        aria-pressed={on}
        onClick={() => toggleFullscreen().catch(() => {})}
      >
        <Icon name={on ? 'shrink' : 'expand'} />
      </button>
      {app && createPortal(<AppFullExit />, document.body)}
    </>
  );
}

/** The way out of the app's full screen: a small button, a tap on the song, or Escape. */
function AppFullExit() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      // The leader's part buttons and parts keep working; dialogs are their own thing.
      if (t instanceof Element && t.closest('.immersive-exit, .live-parts, .cp-section--tappable, dialog')) return;
      setAppFull(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAppFull(false);
    // Next tick: the tap that turned it on is still bubbling up to the document.
    const later = setTimeout(() => document.addEventListener('click', onClick));
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(later);
      document.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <button className="icon-btn immersive-exit" aria-label="Salir de pantalla completa" onClick={() => setAppFull(false)}>
      <Icon name="shrink" size={18} />
    </button>
  );
}

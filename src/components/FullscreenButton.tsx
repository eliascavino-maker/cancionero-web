import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// Safari (Mac / iPad) still uses the webkit names.
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type El = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = () => document as Doc;
const isFull = () => !!(doc().fullscreenElement ?? doc().webkitFullscreenElement);
const canGoFull = () => {
  const el = document.documentElement as El;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
};

/** Full screen, or opened from the home screen (no browser bars): the stage views. */
export function isImmersive(): boolean {
  if (isFull()) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
}

export async function toggleFullscreen(): Promise<void> {
  if (isFull()) {
    await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
    return;
  }
  const el = document.documentElement as El;
  if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else
    // iPhone: web pages can't go full screen; installed on the home screen they open without the browser bars.
    alert(
      'En iPhone el navegador no deja poner pantalla completa.\n\nPara verla sin barras: tocá Compartir → "Agregar a inicio" y abrí el Cancionero desde ese ícono.',
    );
}

/** Full-screen toggle. On a computer the F key does the same. */
export function FullscreenButton() {
  const [full, setFull] = useState(isFull);

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
    };
  }, []);

  const label = full ? 'Salir de pantalla completa' : 'Pantalla completa';
  return (
    <button
      className="icon-btn"
      aria-label={label}
      title={`${label} (F)`}
      aria-pressed={full}
      onClick={() => toggleFullscreen().catch(() => {})}
    >
      <Icon name={full ? 'shrink' : 'expand'} />
    </button>
  );
}

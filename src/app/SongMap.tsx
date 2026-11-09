import { type RefObject, useEffect, useState } from 'react';
import type { SongSection } from '../chordpro/song';
import { sectionTitle } from './StageView';

/**
 * The song's map under its header: one bar per part, as long as the part.
 * The part on screen is white. Tapping a bar goes to that part.
 * Parts not drawn in this view (chords only, in Letra) are left out.
 */
export function SongMap({ sections, sheet }: { sections: SongSection[]; sheet: RefObject<HTMLElement | null> }) {
  const [here, setHere] = useState(0);
  const [drawn, setDrawn] = useState<number[]>([]);

  useEffect(() => {
    const root = sheet.current;
    if (!root) return;
    const els = () => [...root.querySelectorAll<HTMLElement>('[data-section]')];
    const measure = () => setDrawn(els().map((e) => Number(e.dataset.section)));
    const check = () => {
      const top = 150;
      let at = els()[0];
      for (const e of els()) if (e.getBoundingClientRect().top <= top) at = e;
      if (at) setHere(Number(at.dataset.section));
    };
    measure();
    check();
    const mo = new MutationObserver(measure);
    mo.observe(root, { childList: true, subtree: true });
    window.addEventListener('scroll', check, { passive: true });
    return () => {
      mo.disconnect();
      window.removeEventListener('scroll', check);
    };
  }, [sheet, sections]);

  const parts = sections
    .map((s, i) => ({ i, s, size: Math.max(1, s.lines.filter((l) => l.type === 'lyric').length) }))
    .filter((p) => drawn.includes(p.i));
  if (parts.length < 2) return null;

  const go = (i: number) => {
    const el = sheet.current?.querySelector<HTMLElement>(`[data-section="${i}"]`);
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <nav className="song-map" aria-label="Partes de la canción">
      {parts.map(({ i, s, size }) => {
        const name = sectionTitle(s) || `Parte ${i + 1}`;
        return (
          <button
            key={i}
            type="button"
            className="song-map__part"
            style={{ flexGrow: size }}
            aria-current={here === i ? 'location' : undefined}
            aria-label={name}
            title={name}
            onClick={() => go(i)}
          />
        );
      })}
    </nav>
  );
}

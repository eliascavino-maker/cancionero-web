import { type CSSProperties, useEffect, useRef } from 'react';
import { BAND } from '../data/band';
import { useCloud } from '../cloud/CloudProvider';
import { type Musician, chooseMe, setMe, useMe } from './me';

/** The band's musicians: from the server when in a band, else the built-in list. */
export function useMusicians(): Musician[] {
  const cloud = useCloud();
  return (cloud.band && cloud.musicians) || BAND;
}

function describe(m: Musician): string {
  return [m.instrument, m.sings ? 'canta' : undefined].filter(Boolean).join(' · ') || 'sin instrumento';
}

/** One button per musician, plus "Nadie en particular". */
function MusicianPicker({ musicians, current, onPick }: {
  musicians: Musician[];
  current?: string | null;
  onPick: (m: Musician | null) => void;
}) {
  const now = current?.toLowerCase();
  return (
    <div className="who__list" role="group" aria-label="Quién sos">
      {musicians.map((m) => (
        <button
          key={m.id ?? m.name}
          type="button"
          className="who__btn"
          style={{ '--m': m.color } as CSSProperties}
          aria-pressed={current !== undefined ? now === m.name.toLowerCase() : undefined}
          onClick={() => onPick(m)}
        >
          <strong>{m.name}</strong>
          <small>{describe(m)}</small>
        </button>
      ))}
      <button
        type="button"
        className="who__btn who__btn--none"
        aria-pressed={current !== undefined ? current === null : undefined}
        onClick={() => onPick(null)}
      >
        <strong>Nadie en particular</strong>
      </button>
    </div>
  );
}

/**
 * "¿Quién sos?", asked once per device when it is in a band and nobody was
 * chosen yet (here or on another device of the same account).
 */
export function WhoAreYouDialog() {
  const musicians = useMusicians();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dialog ask who"
      // Closed with Escape: asked again next time the app opens.
      aria-label="¿Quién sos?"
    >
      <h2 className="ask__title">¿Quién sos?</h2>
      <p className="ask__message">
        Así cada canción arranca en tu vista y con lo que cantás resaltado. Lo podés cambiar en Banda.
      </p>
      <MusicianPicker musicians={musicians} onPick={chooseMe} />
    </dialog>
  );
}

/** "Vos" on the Banda page: who you are and whether your lines are lit. */
export function MeCard() {
  const musicians = useMusicians();
  const state = useMe();
  const sings = !!state.me?.sings;
  return (
    <section className="band__section who-card">
      <h3 className="band__title">Vos</h3>
      <MusicianPicker
        musicians={musicians}
        current={state.chosen ? (state.me?.name ?? null) : undefined}
        onPick={chooseMe}
      />
      <label className="who__toggle">
        <input
          type="checkbox"
          checked={sings && state.highlight}
          disabled={!sings}
          onChange={(e) => setMe({ ...state, highlight: e.target.checked })}
        />
        Resaltar las líneas que canto
      </label>
      <p className="band__line">
        Elegir quién sos pone la vista de arranque: Acordes si tocás, Letra si solo cantás. Si después la cambiás en
        una canción, queda guardada.
      </p>
    </section>
  );
}

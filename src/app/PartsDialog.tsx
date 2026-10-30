import { type CSSProperties, useEffect, useRef } from 'react';
import type { SectionParts } from '../chordpro/song';
import { BAND, PLAYERS } from '../data/band';
import { MemberName } from '../components/SongView';

type Voice = 'none' | 'lead' | 'backing';

const without = (list: string[], name: string) => list.filter((n) => n !== name);

/** Who sings (lead or backing) and who plays in one section. Changes apply at once. */
export function PartsDialog({
  title,
  parts,
  onChange,
  onClose,
}: {
  title: string;
  parts: SectionParts;
  onChange: (parts: SectionParts) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  const voiceOf = (name: string): Voice =>
    parts.lead.includes(name) ? 'lead' : parts.backing.includes(name) ? 'backing' : 'none';

  const setVoice = (name: string, v: Voice) => {
    const lead = without(parts.lead, name);
    const backing = without(parts.backing, name);
    if (v === 'lead') lead.push(name);
    if (v === 'backing') backing.push(name);
    onChange({ ...parts, lead: inBandOrder(lead), backing: inBandOrder(backing) });
  };

  const togglePlay = (name: string) =>
    onChange({
      ...parts,
      play: parts.play.includes(name) ? without(parts.play, name) : inBandOrder([...parts.play, name]),
    });

  const allPlay = PLAYERS.every((n) => parts.play.includes(n));

  return (
    <dialog
      ref={dialog}
      className="dialog parts"
      aria-label={`Partes: ${title}`}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <header className="page__header">
        <h2>{title}</h2>
        <button className="btn btn--primary" onClick={() => dialog.current?.close()}>
          Listo
        </button>
      </header>

      <h3 className="parts__title">Voces</h3>
      <ul className="parts__list">
        {BAND.filter((m) => m.sings).map((m) => (
          <li key={m.name} className="parts__row">
            <MemberName name={m.name} />
            <div className="segmented" role="group" aria-label={`Voz de ${m.name}`}>
              {(
                [
                  ['none', '—'],
                  ['lead', 'Voz'],
                  ['backing', 'Coro'],
                ] as const
              ).map(([v, text]) => (
                <button key={v} aria-pressed={voiceOf(m.name) === v} onClick={() => setVoice(m.name, v)}>
                  {text}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="parts__head">
        <h3 className="parts__title">Instrumentos</h3>
        <button
          className="link-btn"
          onClick={() => onChange({ ...parts, play: allPlay ? [] : inBandOrder([...new Set([...parts.play, ...PLAYERS])]) })}
        >
          {allPlay ? 'Ninguno' : 'Todos'}
        </button>
      </div>
      <div className="parts__chips">
        {BAND.filter((m) => m.instrument).map((m) => (
          <button
            key={m.name}
            className="parts__chip"
            style={{ '--m': m.color } as CSSProperties}
            aria-pressed={parts.play.includes(m.name)}
            onClick={() => togglePlay(m.name)}
          >
            <strong>{m.name}</strong> <small>{m.instrument}</small>
          </button>
        ))}
      </div>
    </dialog>
  );
}

/** Band members first, in roster order; any other names keep their place after. */
function inBandOrder(names: string[]): string[] {
  const order = BAND.map((m) => m.name);
  const rank = (n: string) => (order.includes(n) ? order.indexOf(n) : order.length);
  return [...names].sort((a, b) => rank(a) - rank(b));
}

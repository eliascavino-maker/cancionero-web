import { type CSSProperties, useState } from 'react';
import { Icon } from '../components/Icon';
import { DEFAULT_SIGNALS, MAX_SIGNALS, MAX_SIGNAL_TEXT, type Signal, inkOn, signalsProblem } from '../live/signals';

/** Colors for new signals, in turn. */
const NEW_COLORS = ['#38bdf8', '#34d399', '#fb923c', '#f472b6', '#a78bfa', '#facc15'];

/**
 * The band's signals, as the owner edits them in Banda: text, color, whether
 * it vibrates, order. Each text box looks like the sign.
 */
export function SignalsEditor({
  initial,
  onSave,
}: {
  initial: Signal[];
  /** Throws to show the error. */
  onSave: (list: Signal[]) => Promise<void>;
}) {
  const [list, setList] = useState(initial);
  const [state, setState] = useState<{ busy?: boolean; saved?: boolean; error?: string }>({});

  const edit = (next: Signal[]) => {
    setList(next);
    setState({});
  };
  const change = (i: number, patch: Partial<Signal>) => edit(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const swap = (i: number, j: number) => {
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };
  const save = async () => {
    const problem = signalsProblem(list);
    if (problem) return setState({ error: problem });
    setState({ busy: true });
    try {
      await onSave(list.map((s) => ({ ...s, text: s.text.trim() })));
      setState({ saved: true });
    } catch (e) {
      setState({ error: (e as { message?: string } | undefined)?.message || 'Algo salió mal.' });
    }
  };

  return (
    <>
      <ul className="signals-edit">
        {list.map((s, i) => (
          <li key={i} className="signals-edit__row">
            <input
              type="color"
              className="signals-edit__color"
              aria-label={`Color de «${s.text.trim()}»`}
              value={s.color}
              onChange={(e) => change(i, { color: e.target.value })}
            />
            <input
              className="signals-edit__text"
              style={{ '--cue': s.color, color: inkOn(s.color) } as CSSProperties}
              aria-label={`Señal ${i + 1}`}
              maxLength={MAX_SIGNAL_TEXT}
              value={s.text}
              onChange={(e) => change(i, { text: e.target.value })}
            />
            <label className="signals-edit__vibrate">
              <input type="checkbox" checked={s.vibrate} onChange={(e) => change(i, { vibrate: e.target.checked })} />
              Vibra
            </label>
            <button
              className="icon-btn icon-btn--small"
              aria-label={`Subir «${s.text.trim()}»`}
              disabled={i === 0}
              onClick={() => swap(i, i - 1)}
            >
              <Icon name="up" size={18} />
            </button>
            <button
              className="icon-btn icon-btn--small icon-btn--danger"
              aria-label={`Quitar «${s.text.trim()}»`}
              disabled={list.length === 1}
              onClick={() => edit(list.filter((_, j) => j !== i))}
            >
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {state.error && (
        <p className="form__error" role="alert">
          {state.error}
        </p>
      )}
      <div className="band__actions">
        <button
          className="btn"
          disabled={list.length >= MAX_SIGNALS}
          onClick={() => edit([...list, { text: '', color: NEW_COLORS[list.length % NEW_COLORS.length], vibrate: false }])}
        >
          <Icon name="plus" size={18} /> Agregar
        </button>
        <button className="btn" onClick={() => edit(DEFAULT_SIGNALS)}>
          Las de fábrica
        </button>
        <button className="btn btn--primary" disabled={state.busy} onClick={save}>
          Guardar
        </button>
      </div>
      {state.saved && (
        <p className="band__line" role="status">
          Guardadas. El director las ve al entrar a la sala.
        </p>
      )}
    </>
  );
}

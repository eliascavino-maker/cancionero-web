import { useEffect, useMemo, useRef, useState } from 'react';
import { blockName, detectBlocks, looksLikeChordPro, textToChordPro } from '../../chordpro/fromText';
import { parseChordPro } from '../../chordpro/parser';
import { Icon } from '../../components/Icon';
import { SongView } from '../../components/SongView';
import { navigate, useLibrary } from '../hooks';

const PASTE_HINT = `Pegá acá la letra, con o sin acordes arriba.

Dejá una línea en blanco entre estrofas: la página
detecta sola cuál es el estribillo (lo que se repite),
el pre-coro y el puente.

Si querés, podés marcar partes con "Coro:", "Verso 2", etc.`;

/**
 * New song: paste lyrics and the structure is detected ("Pegar letra").
 * Existing song: edit the ChordPro source, or paste the lyrics again.
 */
export function EditorPage({ id }: { id?: number }) {
  const lib = useLibrary();
  const isNew = id === undefined;
  const [mode, setMode] = useState<'paste' | 'chordpro'>(isNew ? 'paste' : 'chordpro');
  const [source, setSource] = useState<string | null>(isNew ? '' : null);
  const [paste, setPaste] = useState({ title: '', artist: '', key: '', tempo: '', text: '' });
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id !== undefined) lib.getSong(id).then((s) => setSource(s?.content ?? ''));
  }, [lib, id]);

  const generated = useMemo(() => textToChordPro(paste), [paste]);
  const blocks = useMemo(() => (looksLikeChordPro(paste.text) ? [] : detectBlocks(paste.text)), [paste.text]);
  const content = mode === 'paste' ? generated : (source ?? '');
  const preview = useMemo(() => parseChordPro(content), [content]);
  if (source === null) return null;

  const canSave = mode === 'chordpro' || paste.text.trim() !== '';
  const save = async () => {
    setSaving(true);
    const saved = await lib.saveSong(content, id);
    navigate(`/song/${saved}`);
  };

  const startPaste = () => {
    const m = parseChordPro(source).metadata;
    setPaste({ title: m.title ?? '', artist: m.artists.join(', '), key: m.key ?? '', tempo: m.tempo ?? '', text: '' });
    setMode('paste');
  };
  const toChordPro = () => {
    setSource(generated);
    setMode('chordpro');
  };
  const field = (name: 'title' | 'artist' | 'key' | 'tempo') => ({
    value: paste[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPaste({ ...paste, [name]: e.target.value }),
  });

  return (
    <div className="page page--editor">
      <header className="page__header">
        <a className="icon-btn" href={isNew ? '#/' : `#/song/${id}`} aria-label="Cancelar">
          <Icon name="back" />
        </a>
        <h1>{isNew ? 'Nueva canción' : 'Editar'}</h1>
        <div className="page__actions">
          <button
            className="icon-btn"
            aria-label="Abrir archivo"
            title="Abrir archivo .cho / .chopro / .txt"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="file" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".cho,.chopro,.chordpro,.crd,.pro,.txt,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const text = await f.text();
                if (mode === 'paste') setPaste({ ...paste, text });
                else setSource(text);
              }
              e.target.value = '';
            }}
          />
          <button className="btn btn--primary" disabled={saving || !canSave} onClick={save}>
            Guardar
          </button>
        </div>
      </header>

      <div className="tabs">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'edit'} aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>
            {mode === 'paste' ? 'Letra' : 'ChordPro'}
          </button>
          <button role="tab" aria-selected={tab === 'preview'} aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}>
            Vista previa
          </button>
        </div>
      </div>

      <div className={`editor editor--${tab}`}>
        {mode === 'paste' ? (
          <div className="editor__pane paste">
            <div className="paste__fields">
              <input className="paste__title" placeholder="Título" aria-label="Título" {...field('title')} />
              <input placeholder="Artista" aria-label="Artista" {...field('artist')} />
              <input className="paste__key" placeholder="Tono" aria-label="Tono" {...field('key')} />
              <input
                className="paste__key"
                type="number"
                inputMode="numeric"
                min={20}
                max={300}
                placeholder="BPM"
                aria-label="BPM"
                {...field('tempo')}
              />
            </div>
            <textarea
              className="paste__text"
              aria-label="Letra"
              placeholder={PASTE_HINT}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
            />
            <div className="paste__footer">
              {blocks.length > 0 ? (
                <ol className="structure" aria-label="Estructura detectada">
                  {blocks.map((b, i) => (
                    <li key={i} className={`structure__item structure__item--${b.kind}`}>
                      {blockName(b)}
                      {b.times && b.times > 1 ? ` x${b.times}` : ''}
                    </li>
                  ))}
                </ol>
              ) : (
                <span className="paste__note">
                  {looksLikeChordPro(paste.text) ? 'Es ChordPro: se guarda tal cual.' : ''}
                </span>
              )}
              <button className="link-btn" onClick={toChordPro}>
                Editar como ChordPro
              </button>
            </div>
          </div>
        ) : (
          <div className="editor__pane">
            <textarea
              className="editor__source"
              aria-label="Texto ChordPro"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <button className="link-btn" onClick={isNew ? () => setMode('paste') : startPaste}>
              {isNew ? 'Volver a pegar letra' : 'Pegar la letra de nuevo'}
            </button>
          </div>
        )}
        <div className="editor__preview">
          <SongView song={preview} />
        </div>
      </div>
    </div>
  );
}

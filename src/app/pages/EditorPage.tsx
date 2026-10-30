import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChordPro } from '../../chordpro/parser';
import { Icon } from '../../components/Icon';
import { SongView } from '../../components/SongView';
import { newSongTemplate } from '../../data/sample';
import { navigate, useLibrary } from '../hooks';

/** Edits the ChordPro source with a live preview. `id` undefined = new song. */
export function EditorPage({ id }: { id?: number }) {
  const lib = useLibrary();
  const [text, setText] = useState<string | null>(id === undefined ? newSongTemplate : null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id !== undefined) lib.getSong(id).then((s) => setText(s?.content ?? ''));
  }, [lib, id]);

  const preview = useMemo(() => parseChordPro(text ?? ''), [text]);
  if (text === null) return null;

  const save = async () => {
    setSaving(true);
    const saved = await lib.saveSong(text, id);
    navigate(`/song/${saved}`);
  };

  return (
    <div className="page page--editor">
      <header className="page__header">
        <a className="icon-btn" href={id === undefined ? '#/' : `#/song/${id}`} aria-label="Cancelar">
          <Icon name="back" />
        </a>
        <h1>{id === undefined ? 'Nueva canción' : 'Editar'}</h1>
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
              if (f) setText(await f.text());
              e.target.value = '';
            }}
          />
          <button className="btn btn--primary" disabled={saving} onClick={save}>
            Guardar
          </button>
        </div>
      </header>
      <div className="tabs">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'edit'} aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>
            ChordPro
          </button>
          <button
            role="tab"
            aria-selected={tab === 'preview'}
            aria-pressed={tab === 'preview'}
            onClick={() => setTab('preview')}
          >
            Vista previa
          </button>
        </div>
      </div>
      <div className={`editor editor--${tab}`}>
        <textarea
          className="editor__source"
          aria-label="Texto ChordPro"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="editor__preview">
          <SongView song={preview} />
        </div>
      </div>
    </div>
  );
}

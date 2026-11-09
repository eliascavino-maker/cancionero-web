import { type ReactNode, useRef } from 'react';
import { Icon } from '../components/Icon';
import { useCloud } from '../cloud/CloudProvider';
import { exportBackup, importBackup } from './backup';
import { STAGE_FONT, useLibrary, usePrefs } from './hooks';

/** One group of the Banda page (Vista, Lectura, En vivo, Banda, Cuenta, Datos). */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="settings-group" id={`ajustes-${id}`} aria-labelledby={`ajustes-${id}-t`}>
      <h2 className="settings-group__title" id={`ajustes-${id}-t`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Links to each group, as chips under the title. */
export function GroupIndex({ groups }: { groups: { id: string; title: string }[] }) {
  return (
    <nav className="chips settings-index" aria-label="Ajustes">
      {groups.map((g) => (
        <a key={g.id} className="chip" href={`#/banda`} onClick={(e) => {
          e.preventDefault();
          document.getElementById(`ajustes-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}>
          {g.title}
        </a>
      ))}
    </nav>
  );
}

/** A setting: label and explanation on the left, the control on the right. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting">
      <div className="setting__text">
        <span className="setting__label">{label}</span>
        {hint && <span className="setting__hint">{hint}</span>}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  );
}

export function ThemeSetting() {
  const [prefs, setPrefs] = usePrefs();
  return (
    <Row label="Tema" hint="Oscuro para el escenario; claro para ensayar de día.">
      <div className="segmented" role="group" aria-label="Tema">
        <button aria-pressed={prefs.theme === 'dark'} onClick={() => setPrefs({ ...prefs, theme: 'dark' })}>
          Oscuro
        </button>
        <button aria-pressed={prefs.theme === 'light'} onClick={() => setPrefs({ ...prefs, theme: 'light' })}>
          Claro
        </button>
      </div>
    </Row>
  );
}

export function ReadingSettings() {
  const [prefs, setPrefs] = usePrefs();
  const size = (key: 'fontSize' | 'stageFontSize', min: number, max: number, label: string, hint: string) => (
    <Row label={label} hint={hint}>
      <div className="toolbar__group" role="group" aria-label={label}>
        <button
          className="icon-btn"
          aria-label={`${label}: más chica`}
          disabled={prefs[key] <= min}
          onClick={() => setPrefs({ ...prefs, [key]: prefs[key] - 2 })}
        >
          <Icon name="minus" />
        </button>
        <span className="setting__value">{prefs[key]}</span>
        <button
          className="icon-btn"
          aria-label={`${label}: más grande`}
          disabled={prefs[key] >= max}
          onClick={() => setPrefs({ ...prefs, [key]: prefs[key] + 2 })}
        >
          <Icon name="plus" />
        </button>
      </div>
    </Row>
  );
  return (
    <>
      {size('fontSize', 14, 44, 'Tamaño de letra', 'En la canción. También se cambia con A− / A+.')}
      {size('stageFontSize', STAGE_FONT.min, STAGE_FONT.max, 'Letra en modo escenario', 'Más grande, para leer de lejos.')}
      <Row label="Indicaciones" hint="«4 compases de intro», «x2», «Corte», en su renglón.">
        <input
          type="checkbox"
          className="switch"
          aria-label="Mostrar las indicaciones"
          checked={prefs.showCues}
          onChange={(e) => setPrefs({ ...prefs, showCues: e.target.checked })}
        />
      </Row>
    </>
  );
}

export function StageSetting() {
  const [prefs, setPrefs] = usePrefs();
  return (
    <Row label="Arrancar en modo escenario" hint="En la sala en vivo y en ▶ Tocar: negro puro, letra grande, la pantalla no se apaga.">
      <input
        type="checkbox"
        className="switch"
        aria-label="Arrancar en modo escenario"
        checked={!!prefs.stageMode}
        onChange={(e) => setPrefs({ ...prefs, stageMode: e.target.checked })}
      />
    </Row>
  );
}

export function DataSettings() {
  const lib = useLibrary();
  const cloud = useCloud();
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <p className="band__line">
        Un respaldo es un archivo .json con todas las canciones y los setlists. Sirve para guardar una copia o
        pasarla a otro lado.
      </p>
      <div className="band__actions">
        <button className="btn" onClick={() => exportBackup(lib)}>
          <Icon name="download" size={18} /> Exportar respaldo
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          <Icon name="upload" size={18} /> Importar respaldo
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBackup(lib, f, cloud.band?.bandName);
            e.target.value = '';
          }}
        />
      </div>
    </>
  );
}

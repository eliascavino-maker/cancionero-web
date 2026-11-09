import { askConfirm, tell } from '../components/ask';
import type { Library } from '../data/library';

/** Downloads every song and setlist as a .json file. */
export async function exportBackup(lib: Library) {
  const data = await lib.exportAll();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `cancionero-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Loads a backup: with a band it adds to it; without one it replaces this browser's library. */
export async function importBackup(lib: Library, file: File, bandName: string | undefined) {
  const ok = await askConfirm(
    bandName
      ? `Agrega sus canciones y setlists a «${bandName}». No reemplaza nada.`
      : 'Reemplaza todas las canciones y setlists de este navegador.',
    { title: '¿Importar la copia?', ok: 'Importar', danger: !bandName },
  );
  if (!ok) return;
  try {
    await lib.importAll(JSON.parse(await file.text()));
  } catch (e) {
    await tell(e instanceof Error ? e.message : 'No se pudo importar el archivo.');
  }
}

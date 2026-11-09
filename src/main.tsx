import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { renameSpeedKeys } from './app/autoscroll';
import { CloudProvider } from './cloud/CloudProvider';
import { LiveProvider } from './live/LiveProvider';
import { LibraryContext } from './app/hooks';
import { Library } from './data/library';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css';
import '@fontsource/tinos/latin-400.css';
import '@fontsource/tinos/latin-400-italic.css';
import '@fontsource/tinos/latin-700.css';
import '@fontsource/tinos/latin-700-italic.css';
import './styles.css';

// Ask the browser not to clear the library when space runs low.
// Installed apps usually get it; elsewhere it may be refused, which is fine.
navigator.storage?.persist?.().catch(() => {});

const root = createRoot(document.getElementById('root')!);

Library.open()
  .then(async (lib) => {
    const upgraded = await lib.takeUpgradedSongIds();
    if (upgraded) renameSpeedKeys(upgraded);
    await lib.seedIfEmpty();
    root.render(
      <StrictMode>
        <LibraryContext.Provider value={lib}>
          <CloudProvider>
            <LiveProvider>
              <App />
            </LiveProvider>
          </CloudProvider>
        </LibraryContext.Provider>
      </StrictMode>,
    );
  })
  .catch((e) => {
    console.error(e);
    root.render(
      <p className="empty">
        No se pudo abrir el almacenamiento del navegador. Probá fuera del modo incógnito o con otro navegador.
      </p>,
    );
  });

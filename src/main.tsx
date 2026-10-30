import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LibraryContext } from './app/hooks';
import { Library } from './data/library';
import '@fontsource-variable/inter';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

Library.open()
  .then(async (lib) => {
    await lib.seedIfEmpty();
    root.render(
      <StrictMode>
        <LibraryContext.Provider value={lib}>
          <App />
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

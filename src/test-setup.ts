import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Node 25+ trae su propio localStorage (vacío sin --localstorage-file),
// que tapa el de jsdom. Usamos el de jsdom.
const { jsdom } = globalThis as unknown as { jsdom?: { window: Window } };
if (jsdom && typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdom.window.localStorage,
    configurable: true,
    writable: true,
  });
}

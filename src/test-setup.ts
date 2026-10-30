import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Node 25+ trae su propio localStorage (vacío sin --localstorage-file),
// que tapa el de jsdom. Usamos el de jsdom.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const { jsdom } = globalThis as unknown as { jsdom: { window: Window } };
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdom.window.localStorage,
    configurable: true,
    writable: true,
  });
}

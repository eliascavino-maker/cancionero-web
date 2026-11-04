import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker and tells the user when the app works offline
 * or a new version is ready. The new version is installed only when they
 * tap "Actualizar": the page never reloads by itself.
 *
 * `hidden` keeps it out of the way on stage; it shows again afterwards.
 */
export function UpdatePrompt({ hidden }: { hidden: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // An app left open for days still finds out about new versions.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), HOUR);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (hidden || (!needRefresh && !offlineReady)) return null;

  return (
    <div className="update-prompt" role="status">
      <span className="update-prompt__text">
        {needRefresh ? 'Hay una versión nueva.' : 'Lista para usar sin conexión.'}
      </span>
      {needRefresh && (
        <button type="button" className="btn btn--primary" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {needRefresh ? 'Después' : 'Cerrar'}
      </button>
    </div>
  );
}

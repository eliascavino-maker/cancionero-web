import { useEffect } from 'react';

/**
 * Reading a song: scrolling down hides the bottom bar and the song controls
 * (class `chrome-away` on <html>), scrolling up or reaching the top or the end
 * brings them back. Off while `on` is false.
 */
export function useHideOnScroll(on: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (!on) {
      root.classList.remove('chrome-away');
      return;
    }
    let last = window.scrollY;
    let frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
      if (y < 80 || atEnd) root.classList.remove('chrome-away');
      else if (y > last + 6) root.classList.add('chrome-away');
      else if (y < last - 6) root.classList.remove('chrome-away');
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove('chrome-away');
    };
  }, [on]);
}

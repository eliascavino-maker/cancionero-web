// Small stroke icons, 24×24 grid. Color follows `currentColor`.

const PATHS = {
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5h2.5v14H8zM13.5 5H16v14h-2.5z',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  prev: 'M17 6l-8 6 8 6zM7 6v12',
  next: 'M7 6l8 6-8 6zM17 6v12',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM20 20l-4.8-4.8',
  music: 'M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  shrink: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  left: 'M19 12H5M11 6l-6 6 6 6',
  right: 'M5 12h14M13 6l6 6-6 6',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  band: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.5c1.9.8 3 2.8 3 5.5',
  check: 'M5 12.5l4.5 4.5L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  textSmaller: 'M4 18l4-10 4 10M5.5 14.5h5M15 13h6',
  textLarger: 'M3 19l5-13 5 13M5 15h6M18 10v6M15 13h6',
  speed: 'M12 20a8 8 0 1 1 8-8M12 12l4-4',
  stage: 'M4 5h16v11H4zM8 20h8M12 16v4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const filled = name === 'play' || name === 'pause' || name === 'prev' || name === 'next';
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

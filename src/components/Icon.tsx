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
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.8 9.6a4.5 4.5 0 0 1-.8 8.9z',
  cloudOff: 'M7 18.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.8 9.6a4.5 4.5 0 0 1-.8 8.9zM4 4l16 16',
  history: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7M12 8v4.2l2.8 1.8',
  restore: 'M9 14l-5-5 5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  share: 'M12 15V4M8 8l4-4 4 4M6 12v8h12v-8',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  metronome: 'M9.5 3h5l3.5 17H6zM12 16l5-9M8 16h8',
  signal: 'M4 10v4h3l7 4V6l-7 4zM17.5 9.5a3.5 3.5 0 0 1 0 5',
  map: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14',
  cue: 'M6 21V4M6 4h11.5l-2.5 4 2.5 4H6',
  // Three strings with a capo across them.
  capo: 'M7 3v18M12 3v18M17 3v18M4 9h16v3H4z',
  print: 'M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  // A point with waves on both sides: on air.
  live: 'M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
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

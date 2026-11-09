// The band's EC shield: the E mirrored on top, the C below, sharing the stem.
// Placeholder until the band's SVG arrives: replace SHIELD and LETTERS (and
// public/icon.svg, made from the same paths), keep the component's API.

export const SHIELD = 'M128 80H384V264A128 128 0 0 1 128 264Z';
export const LETTERS =
  'M236 120h30v200h-30zM166 120h100v18h-100zM196 162h70v16h-70zM166 202h100v18h-100zM166 120h12v28h-12zM166 192h12v28h-12zM236 220h100v18h-100zM236 302h100v18h-100zM324 220h12v30h-12zM324 290h12v30h-12z';

export function BrandMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={(size * 330) / 274}
      viewBox="119 71 274 330"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={SHIELD} fill="none" stroke="currentColor" strokeWidth="18" />
      <path d={LETTERS} fill="currentColor" />
    </svg>
  );
}

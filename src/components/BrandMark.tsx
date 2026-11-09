// The band's EC shield: E mirrored on top, C below, joined at the stem, serif bold.
// Placeholder until the band's SVG arrives: swap the <svg> body, keep the API.

export function BrandMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size * 1.2}
      viewBox="0 0 40 48"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M2 2h36v26a18 18 0 0 1-36 0z" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <text
        x="20"
        y="22"
        textAnchor="middle"
        transform="translate(40 0) scale(-1 1)"
        fill="currentColor"
        fontFamily="Tinos, 'Liberation Serif', serif"
        fontWeight="700"
        fontSize="19"
      >
        E
      </text>
      <text x="23" y="38" textAnchor="middle" fill="currentColor" fontFamily="Tinos, 'Liberation Serif', serif" fontWeight="700" fontSize="19">
        C
      </text>
    </svg>
  );
}

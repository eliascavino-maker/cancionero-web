import { matchNote } from '../music/chord';

/**
 * A chord set like a printed lead sheet: the root at full size, the quality
 * and extensions smaller and raised, the bass after the slash.
 * "C#m7/G#" → C# ᵐ⁷ /G#. Anything that is not a chord is shown as is.
 */
export function ChordName({ chord }: { chord: string }) {
  const root = matchNote(chord);
  if (!root) return <>{chord}</>;
  const [, rootLen] = root;
  let rest = chord.slice(rootLen);
  let bass = '';
  const slash = rest.lastIndexOf('/');
  if (slash !== -1) {
    const tail = rest.slice(slash + 1);
    const note = matchNote(tail);
    if (note && note[1] === tail.length) {
      bass = rest.slice(slash);
      rest = rest.slice(0, slash);
    }
  }
  return (
    <>
      {chord.slice(0, rootLen)}
      {rest && <sup className="chord__ext">{rest}</sup>}
      {bass && <span className="chord__bass">{bass}</span>}
    </>
  );
}

import { useRef } from 'react';

/** Which way the last move went, for the slide-in of the new song. */
export function useMoveDirection(index: number): 'fwd' | 'back' {
  const last = useRef({ index, dir: 'fwd' as 'fwd' | 'back' });
  if (last.current.index !== index) last.current = { index, dir: index < last.current.index ? 'back' : 'fwd' };
  return last.current.dir;
}

import { bpmFromTaps, parseBpm, setTempo } from './tempo';

describe('parseBpm', () => {
  it.each([
    ['120', 120],
    ['120 bpm', 120],
    ['92,5', 93],
    [undefined, null],
    ['Allegro', null],
  ])('%s → %s', (text, bpm) => expect(parseBpm(text)).toBe(bpm));
});

describe('setTempo', () => {
  it('replaces the existing {tempo}', () => {
    expect(setTempo('{title: X}\n{tempo: 90}\n[C]la\n', 120)).toBe('{title: X}\n{tempo: 120}\n[C]la\n');
  });

  it('adds it after the header directives', () => {
    expect(setTempo('{title: X}\n# nota\n{key: G}\n\n{start_of_verse}\n[C]la', 100)).toBe(
      '{title: X}\n# nota\n{key: G}\n{tempo: 100}\n\n{start_of_verse}\n[C]la',
    );
  });

  it('adds it at the top when there is no header, keeping CRLF', () => {
    expect(setTempo('[C]la\r\nle', 80)).toBe('{tempo: 80}\r\n[C]la\r\nle');
  });
});

describe('bpmFromTaps', () => {
  it('needs two taps', () => expect(bpmFromTaps([0])).toBeNull());
  it('averages the intervals', () => expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120));
  it('a long pause starts over', () => expect(bpmFromTaps([0, 400, 5000, 5600])).toBe(100));
});

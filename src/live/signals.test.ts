import { DEFAULT_SIGNALS, MAX_SIGNALS, bandSignals, countBeats, inkOn, signalsProblem, toSignal } from './signals';

it('the band list, or the factory one if there is none or it is broken', () => {
  expect(bandSignals(null)).toBe(DEFAULT_SIGNALS);
  expect(bandSignals([])).toBe(DEFAULT_SIGNALS);
  expect(bandSignals([{ text: 'Ya', color: 'red' }])).toBe(DEFAULT_SIGNALS);
  expect(bandSignals([{ text: ' Ya ', color: '#ABCDEF' }])).toEqual([{ text: 'Ya', color: '#abcdef', vibrate: false }]);
});

it('one signal: text 1 to 24 letters, #rrggbb color', () => {
  expect(toSignal({ text: 'x'.repeat(25), color: '#000000' })).toBeNull();
  expect(toSignal({ text: 'Cortar', color: '#f0565a', vibrate: true })).toEqual({ text: 'Cortar', color: '#f0565a', vibrate: true });
  expect(toSignal('Cortar')).toBeNull();
});

it('what is wrong before saving', () => {
  expect(signalsProblem(DEFAULT_SIGNALS)).toBeNull();
  expect(signalsProblem([])).toMatch(/al menos una/);
  expect(signalsProblem([{ text: ' ', color: '#000000', vibrate: false }])).toMatch(/texto/);
  expect(signalsProblem(Array(MAX_SIGNALS + 1).fill(DEFAULT_SIGNALS[0]))).toMatch(/Hasta 12/);
});

it('ink: black on light colors, white on dark ones', () => {
  expect(inkOn('#ffaf3a')).toBe('#000');
  expect(inkOn('#1e3a8a')).toBe('#fff');
});

it('beats to count from {time}', () => {
  expect(countBeats(undefined)).toBe(4);
  expect(countBeats('3/4')).toBe(3);
  expect(countBeats('6/8')).toBe(6);
  expect(countBeats('12/8')).toBe(4);
});

import { accountStep, musicianIdFor, stageStep } from '../cloud/account';
import { BAND } from '../data/band';
import { getPrefs, resetPrefsForTests } from './hooks';
import { type MeState, type Musician, chooseMe, getMe, litSinger, resetMeForTests } from './me';

const byName = (name: string) => BAND.find((m) => m.name === name)!;

beforeEach(() => {
  localStorage.clear();
  resetMeForTests();
  resetPrefsForTests();
});

describe('chooseMe', () => {
  it.each([
    ['Sergio', true, true],
    ['Leo', true, true],
    ['Leandro', true, true],
    ['Angel', false, true],
    ['Elias', true, false],
  ])('%s starts in %s (Acordes) with lines lit: %s', (name, chords, lit) => {
    chooseMe(byName(name));
    expect(getPrefs().showChords).toBe(chords);
    expect(getMe()).toMatchObject({ chosen: true, highlight: lit });
    expect(litSinger(getMe())).toBe(lit ? name : undefined);
  });

  it('"Nadie en particular" keeps the view as it is', () => {
    chooseMe(byName('Angel'));
    chooseMe(null);
    expect(getPrefs().showChords).toBe(false);
    expect(getMe()).toEqual({ chosen: true, me: null, highlight: false });
  });

  it('is remembered in this browser', () => {
    chooseMe(byName('Leo'));
    resetMeForTests();
    expect(getMe().me?.name).toBe('Leo');
  });
});

describe('accountStep', () => {
  const roster: Musician[] = BAND.map((m, i) => ({ ...m, id: `id-${i}` }));
  const leo = roster[1];
  const none: MeState = { chosen: false, me: null, highlight: false };

  it('nobody chosen anywhere: nothing (the app asks)', () => {
    expect(accountStep(none, true, { musicianId: null, prefs: {} }, roster)).toEqual({ kind: 'none' });
  });

  it('a new device takes what the account chose', () => {
    const step = accountStep(none, true, { musicianId: leo.id!, prefs: { chosen: true, view: 'lyrics', highlight: false } }, roster);
    expect(step).toEqual({ kind: 'adopt', me: { chosen: true, me: leo, highlight: false }, showChords: false });
  });

  it('the device choice is saved to the account, with the band musician id', () => {
    const local: MeState = { chosen: true, me: byName('Leo'), highlight: true };
    expect(accountStep(local, true, { musicianId: null, prefs: {} }, roster)).toEqual({
      kind: 'save',
      musicianId: leo.id,
      prefs: { chosen: true, view: 'chords', highlight: true },
    });
  });

  it('nothing to save when the account already has it', () => {
    const local: MeState = { chosen: true, me: leo, highlight: true };
    const account = { musicianId: leo.id!, prefs: { chosen: true, view: 'chords' as const, highlight: true } };
    expect(accountStep(local, true, account, roster)).toEqual({ kind: 'none' });
    // Switching to Letra on this device is saved too.
    expect(accountStep(local, false, account, roster)).toMatchObject({ kind: 'save', prefs: { view: 'lyrics' } });
  });

  it('a name the band does not have goes as no musician', () => {
    expect(musicianIdFor({ name: 'Otro', sings: true, color: '#000000' }, roster)).toBeNull();
  });
});

describe('stageStep (modo escenario with the account)', () => {
  it("a device that never chose takes the account's", () => {
    expect(stageStep(undefined, true)).toEqual({ kind: 'adopt', on: true });
    expect(stageStep(undefined, false)).toEqual({ kind: 'adopt', on: false });
    expect(stageStep(undefined, undefined)).toEqual({ kind: 'none' });
  });

  it('a choice made here goes to the account', () => {
    expect(stageStep(true, undefined)).toEqual({ kind: 'save', on: true });
    expect(stageStep(false, true)).toEqual({ kind: 'save', on: false });
    expect(stageStep(true, true)).toEqual({ kind: 'none' });
  });
});

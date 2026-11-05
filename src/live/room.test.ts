import { FakeHub } from './fakeHub';
import { LeaderChanged, LiveRoom, type Place } from './room';

const flush = () => new Promise((r) => setTimeout(r, 0));
const place = (index: number, part: number, transpose = 0): Place => ({
  setlistId: 'L',
  index,
  songId: `s${index}`,
  part,
  transpose,
});

async function setup() {
  const hub = new FakeHub();
  const room = (id: string, name: string) => {
    const r = new LiveRoom(hub.server(id, name), 'band', { userId: id, name });
    r.start();
    r.enter();
    return r;
  };
  const sergio = room('u-sergio', 'Sergio');
  const leo = room('u-leo', 'Leo');
  await flush();
  await sergio.open('L');
  await flush();
  return { hub, room, sergio, leo };
}

describe('LiveRoom', () => {
  it('opening the room makes nobody the leader', async () => {
    const { sergio, leo } = await setup();
    expect(sergio.getState().session).toEqual({ setlistId: 'L', leaderId: null, leaderName: '' });
    expect(leo.getState().session?.leaderId).toBeNull();
    expect(leo.getState().peers.map((p) => p.name).sort()).toEqual(['Leo', 'Sergio']);
  });

  it('without a leader nobody sends where they are', async () => {
    const { hub, sergio, leo } = await setup();
    sergio.sendPos(place(2, 1));
    await flush();
    expect(hub.sent.filter((m) => m.event === 'pos')).toEqual([]);
    expect(leo.getState().leaderPos).toBeNull();
  });

  it('"Ser director": everyone sees who leads and goes where they are', async () => {
    const { sergio, leo } = await setup();
    sergio.sendPos(place(3, 0));
    await sergio.takeLead(null);
    await flush();
    expect(leo.getState().session).toMatchObject({ leaderId: 'u-sergio', leaderName: 'Sergio' });
    expect(leo.getState().leaderPos).toMatchObject({ index: 3, part: 0, from: 'u-sergio' });
    sergio.sendPos(place(3, 1, 2));
    await flush();
    expect(leo.getState().leaderPos).toMatchObject({ index: 3, part: 1, transpose: 2 });
  });

  it('the second one to tap gets LeaderChanged and sees who leads', async () => {
    const { sergio, leo } = await setup();
    await sergio.takeLead(null);
    await expect(leo.takeLead(null)).rejects.toBeInstanceOf(LeaderChanged);
    expect(leo.getState().session?.leaderId).toBe('u-sergio');
    // "Tomar la dirección", knowing who it is taken from.
    await leo.takeLead('u-sergio');
    await flush();
    expect(sergio.getState().session).toMatchObject({ leaderId: 'u-leo', leaderName: 'Leo' });
  });

  it('only the current leader is followed; old and foreign messages are dropped', async () => {
    const { hub, sergio, leo } = await setup();
    await sergio.takeLead(null);
    sergio.sendPos(place(1, 2));
    sergio.sendPos(place(1, 3));
    await flush();
    const latest = leo.getState().leaderPos!;
    expect(latest.part).toBe(3);
    // An older message arriving late.
    hub.subs.get('u-leo')!.onMessage('pos', { ...latest, seq: latest.seq - 1, part: 2 });
    expect(leo.getState().leaderPos?.part).toBe(3);
    // Someone who doesn't lead.
    hub.subs.get('u-leo')!.onMessage('pos', { ...latest, seq: 99, from: 'u-angel', part: 0 });
    expect(leo.getState().leaderPos?.part).toBe(3);
  });

  it('someone arriving late asks (hello) and the leader says again where they are', async () => {
    const { room, sergio } = await setup();
    await sergio.takeLead(null);
    sergio.sendPos(place(4, 2));
    await flush();
    const angel = room('u-angel', 'Angel');
    await flush();
    expect(angel.getState().leaderPos).toMatchObject({ index: 4, part: 2 });
  });

  it('"Dejar de dirigir": the room stays open without a leader, and the place is forgotten', async () => {
    const { sergio, leo } = await setup();
    await sergio.takeLead(null);
    sergio.sendPos(place(1, 1));
    await sergio.leaveLead();
    await flush();
    expect(leo.getState().session).toEqual({ setlistId: 'L', leaderId: null, leaderName: '' });
    expect(leo.getState().leaderPos).toBeNull();
    sergio.sendPos(place(2, 0));
    await flush();
    expect(leo.getState().leaderPos).toBeNull();
  });

  it('closing the room reaches everyone', async () => {
    const { sergio, leo } = await setup();
    await leo.close();
    await flush();
    expect(sergio.getState().session).toBeNull();
  });
});

it('a read of the room answering late does not bring back the old leader', async () => {
  const { hub, sergio, leo } = await setup();
  await sergio.takeLead(null);
  await flush();
  // Sergio starts reading the room; the answer is slow and says Sergio leads.
  let answer!: (s: typeof hub.session) => void;
  const server = (sergio as unknown as { server: { fetchSession: () => Promise<unknown> } }).server;
  const real = server.fetchSession;
  server.fetchSession = () => new Promise((r) => (answer = r as typeof answer));
  const slow = sergio.refresh();
  const stale = { ...hub.session! };
  server.fetchSession = real;
  // Meanwhile Leo takes the lead (Sergio hears it and reads again).
  await leo.takeLead('u-sergio');
  await flush();
  expect(sergio.getState().session?.leaderId).toBe('u-leo');
  answer(stale);
  await slow;
  expect(sergio.getState().session?.leaderId).toBe('u-leo');
});

it('moving never touches Presence (Supabase limits it and closes the channel past it)', async () => {
  const { hub, sergio } = await setup();
  await sergio.takeLead(null);
  const before = hub.tracks.get('u-sergio');
  for (let p = 0; p < 50; p++) sergio.sendPos(place(0, p));
  await flush();
  expect(hub.sent.filter((m) => m.event === 'pos')).toHaveLength(50);
  expect(hub.tracks.get('u-sergio')).toBe(before);
  expect(Object.keys(hub.presence.get('u-sergio')!)).toEqual(['userId', 'name']);
});

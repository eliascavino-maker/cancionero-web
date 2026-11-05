/**
 * Sala en vivo: quién dirige (en la base) y dónde está (por broadcast, sin
 * pasar por la base). Solo miembros de la banda.
 *
 * Presence dice solo quién está en la sala: Supabase limita cuántas veces se
 * actualiza y cierra el canal si se pasa. Por eso la posición nunca va ahí:
 * quien llega tarde la pide con "hello" y el director la manda de nuevo.
 */

/** Where the leader is. */
export interface LivePos {
  /** Goes up with every message of the same leader: older ones are dropped. */
  seq: number;
  /** Who sent it. Only the current leader's messages count. */
  from: string;
  setlistId: string;
  /** Position in the setlist. */
  index: number;
  songId: string;
  /** Part of the song: index in `stageSlides`. */
  part: number;
  transpose: number;
}

export type Place = Omit<LivePos, 'seq' | 'from'>;

/** The open room, from `live_sessions`. */
export interface LiveSession {
  setlistId: string;
  /** null: nobody leads; everyone moves on their own. */
  leaderId: string | null;
  leaderName: string;
}

/** Someone on the live page now. */
export interface Peer {
  userId: string;
  name: string;
}

export interface LiveState {
  /** The room was read from the server at least once. */
  loaded: boolean;
  /** null: no room open. */
  session: LiveSession | null;
  /** Last place sent by the current leader. */
  leaderPos: LivePos | null;
  peers: Peer[];
  connected: boolean;
}

/** What each one keeps in Presence. */
export type PresenceMeta = Peer;

export interface LiveHandlers {
  onMessage(event: string, payload: Record<string, unknown>): void;
  onPresence(metas: PresenceMeta[]): void;
  /** `live_sessions` changed (postgres_changes). */
  onSessionChange(): void;
  onStatus(connected: boolean): void;
}

export interface LiveConnection {
  send(event: string, payload: Record<string, unknown>): Promise<void>;
  /** null: not on the live page anymore. */
  track(meta: PresenceMeta | null): Promise<void>;
  close(): void;
}

/** Someone else took the lead first. */
export class LeaderChanged extends Error {}

/** What the room needs from the server: Supabase in `supabaseLive`, a fake in tests. */
export interface LiveServer {
  fetchSession(bandId: string): Promise<LiveSession | null>;
  open(bandId: string, setlistId: string): Promise<void>;
  close(bandId: string): Promise<void>;
  /** "Ser director" (expected = null) or "Tomar la dirección". Throws `LeaderChanged`. */
  takeLead(bandId: string, expected: string | null): Promise<string>;
  leaveLead(bandId: string): Promise<void>;
  connect(bandId: string, userId: string, handlers: LiveHandlers): LiveConnection;
}

export class LiveRoom {
  private state: LiveState = { loaded: false, session: null, leaderPos: null, peers: [], connected: false };
  private listeners = new Set<(s: LiveState) => void>();
  private conn: LiveConnection | null = null;
  private seq = 0;
  private here = false;
  private last: Place | null = null;
  /** Reads of the room in flight: only the last one counts. */
  private reads = 0;

  constructor(
    private server: LiveServer,
    readonly bandId: string,
    readonly me: Peer,
  ) {}

  getState = () => this.state;

  subscribe(listener: (s: LiveState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private send(event: string, payload: Record<string, unknown> = {}) {
    void this.conn?.send(event, payload).catch(() => {});
  }

  start() {
    this.conn = this.server.connect(this.bandId, this.me.userId, {
      onMessage: (event, payload) => this.receive(event, payload),
      onPresence: (metas) => {
        const peers = new Map(metas.map((m) => [m.userId, { userId: m.userId, name: m.name }]));
        this.set({ peers: [...peers.values()] });
      },
      onSessionChange: () => void this.refresh(),
      onStatus: (connected) => {
        this.set({ connected });
        // Back after a cut: read the room again, say we're here, ask where the leader is.
        if (connected) {
          void this.refresh().then(() => this.askWhere());
          if (this.here) void this.conn?.track(this.me).catch(() => {});
        }
      },
    });
    void this.refresh();
  }

  stop() {
    this.conn?.close();
    this.conn = null;
  }

  /** Reads the room from the server. */
  async refresh() {
    const read = ++this.reads;
    let session: LiveSession | null;
    try {
      session = await this.server.fetchSession(this.bandId);
    } catch {
      return; // Offline: keep what we know.
    }
    // An older read answering late would bring back the leader before the change.
    if (read === this.reads) this.setSession(session);
  }

  private setSession(session: LiveSession | null) {
    const before = this.state.session?.leaderId ?? null;
    const now = session?.leaderId ?? null;
    const leaderPos = now && now === before ? this.state.leaderPos : null;
    this.set({ loaded: true, session, leaderPos });
  }

  /** Someone else leads and we don't know where they are: ask. */
  private askWhere() {
    const leader = this.state.session?.leaderId;
    if (leader && leader !== this.me.userId && !this.state.leaderPos) this.send('hello');
  }

  private newer(pos: LivePos): boolean {
    const leader = this.state.session?.leaderId;
    const cur = this.state.leaderPos;
    return pos.from === leader && (!cur || cur.from !== pos.from || pos.seq > cur.seq);
  }

  private receive(event: string, payload: Record<string, unknown>) {
    if (event === 'pos') {
      const pos = payload as unknown as LivePos;
      if (this.newer(pos)) this.set({ leaderPos: pos });
    } else if (event === 'hello') {
      // Someone arrived: the leader says again where they are.
      if (this.leading() && this.last) this.sendPos(this.last);
    } else if (event === 'lead') {
      // Fast path; the server's row confirms it.
      const session = this.state.session;
      if (session) {
        this.setSession({
          ...session,
          leaderId: (payload.leaderId as string | null) ?? null,
          leaderName: String(payload.leaderName ?? ''),
        });
      }
      void this.refresh();
    } else if (event === 'session') {
      void this.refresh().then(() => this.askWhere());
    }
  }

  private leading() {
    return this.state.session?.leaderId === this.me.userId;
  }

  // ----- the live page

  /** On the live page: others see us in the room. */
  enter() {
    this.here = true;
    void this.conn?.track(this.me).catch(() => {});
    this.askWhere();
  }

  leave() {
    this.here = false;
    void this.conn?.track(null).catch(() => {});
  }

  // ----- actions

  async open(setlistId: string) {
    await this.server.open(this.bandId, setlistId);
    await this.refresh();
    this.send('session');
  }

  async close() {
    await this.server.close(this.bandId);
    this.setSession(null);
    this.send('session');
  }

  /** Throws `LeaderChanged` if someone else leads now (the room is read again). */
  async takeLead(expected: string | null) {
    let name: string;
    try {
      name = await this.server.takeLead(this.bandId, expected);
    } catch (e) {
      if (e instanceof LeaderChanged) await this.refresh();
      throw e;
    }
    const session = this.state.session;
    if (session) this.setSession({ ...session, leaderId: this.me.userId, leaderName: name });
    this.send('lead', { leaderId: this.me.userId, leaderName: name });
    // Everyone goes to where the new leader is.
    if (this.last) this.sendPos(this.last);
  }

  async leaveLead() {
    await this.server.leaveLead(this.bandId);
    const session = this.state.session;
    if (session) this.setSession({ ...session, leaderId: null, leaderName: '' });
    this.send('lead', { leaderId: null, leaderName: '' });
  }

  /** Where this device is. Sent only while leading; kept to send when taking the lead. */
  sendPos(place: Place) {
    this.last = place;
    if (!this.leading()) return;
    const pos: LivePos = { ...place, seq: ++this.seq, from: this.me.userId };
    this.send('pos', pos as unknown as Record<string, unknown>);
  }
}

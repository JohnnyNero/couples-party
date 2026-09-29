// A stand-in for Playroom, for tests only: any number of phones in rooms on one pretend
// server, each with its own copy of the room's state, and every message between them
// taking `latency` ms (driven by vitest's fake timers). It does what playroom.ts relies
// on — joining by room code, one host at a time (the first in; the next in line when the
// host goes), room and player state, RPCs to the host, host transfer, leaving — so two
// real copies of playroom.ts can be raced against each other.

type Dict = Record<string, unknown>
type QuitCb = (p: FakePlayer) => void
type RpcFn = (payload: unknown, sender: FakePlayer, mode: number) => Promise<unknown>

export class FakePlayer {
  state: Dict = {}
  quitCbs: QuitCb[] = []
  constructor(readonly id: string, readonly client: FakeClient, readonly owner: FakeClient) {}
  getState(k: string) { return this.state[k] }
  // Only your own player: the change goes to everyone else after the latency.
  setState(k: string, v: unknown) {
    this.state[k] = v
    this.owner.server.broadcast(this.owner, (c) => { const p = c.players.get(this.id); if (p) p.state[k] = v })
  }
  getProfile() { return { name: `P-${this.id}`, color: { hexString: '#000' }, photo: '' } }
  onQuit(cb: QuitCb) { this.quitCbs.push(cb) }
  kick() {}
  leaveRoom() {}
}

export class FakeClient {
  id: string
  room: FakeRoom | null = null
  state: Dict = {}
  hostId: string | null = null
  players = new Map<string, FakePlayer>()
  joinCbs: ((p: FakePlayer) => void)[] = []
  rpc = new Map<string, RpcFn>()
  gone = false
  // Messages this phone won't get (to lose a particular one on purpose).
  drop: ((what: string, payload: unknown) => boolean) | null = null

  constructor(readonly server: FakeServer, n: number) { this.id = `pr${n}` }

  player(id: string): FakePlayer {
    let p = this.players.get(id)
    if (!p) {
      const owner = this.server.clients.find((c) => c.id === id)!
      p = new FakePlayer(id, this, owner)
      this.players.set(id, p)
    }
    return p
  }

  // What the app imports as 'playroomkit'.
  api() {
    const self = this
    return {
      insertCoin: async (opts: { roomCode?: string }) => self.server.join(self, opts.roomCode ?? 'LOBBY'),
      isHost: () => !self.gone && self.hostId === self.id,
      myPlayer: () => self.player(self.id),
      onPlayerJoin: (cb: (p: FakePlayer) => void) => {
        self.joinCbs.push(cb)
        for (const p of [...self.players.values()]) cb(p)
        return () => {}
      },
      useMultiplayerState: () => { throw new Error('not in tests') },
      getState: (k: string) => self.state[k],
      setState: (k: string, v: unknown) => {
        if (self.gone) return
        self.state[k] = v
        self.server.broadcast(self, (c) => { c.state[k] = v })
      },
      transferHost: async (id: string) => { self.server.setHost(self.room!, id) },
      RPC: {
        Mode: { ALL: 0, OTHERS: 1, HOST: 2 },
        register: (name: string, fn: RpcFn) => { self.rpc.set(name, fn); return () => {} },
        call: async (name: string, payload: unknown) => {
          if (self.gone) return
          self.server.later(() => {
            const room = self.room
            if (!room) return
            const host = room.clients.find((c) => c.id === room.hostId)
            if (!host || host.gone) return
            if (host.drop?.(name, payload)) return
            void host.rpc.get(name)?.(structuredClone(payload), host.player(self.id), 2)
          })
        },
      },
    }
  }
}

export class FakeRoom {
  clients: FakeClient[] = []
  state: Dict = {}
  hostId: string | null = null
  constructor(readonly code: string) {}
}

export class FakeServer {
  rooms = new Map<string, FakeRoom>()
  clients: FakeClient[] = []
  private n = 0
  // When on, a phone that found the room empty as it set off thinks it's the host until
  // the server's answer catches up — so two arriving together can both act as host for a
  // moment (Playroom promises nothing about this, so the app mustn't depend on it).
  splitBrain = false
  constructor(public latency = 60) {}

  later(fn: () => void, ms = this.latency) { setTimeout(fn, ms) }

  client(): FakeClient {
    const c = new FakeClient(this, ++this.n)
    this.clients.push(c)
    return c
  }

  // Into the room: it's yours to host if it was empty, and you arrive with a copy of its
  // state as the server has it — then everyone already there hears about you.
  async join(c: FakeClient, code: string) {
    const emptyAtStart = !this.rooms.get(code)?.clients.length
    await new Promise((r) => setTimeout(r, this.latency))
    let room = this.rooms.get(code)
    if (!room) { room = new FakeRoom(code); this.rooms.set(code, room) }
    room.clients.push(c)
    c.room = room
    if (!room.hostId || !room.clients.some((x) => x.id === room!.hostId)) room.hostId = c.id
    c.hostId = room.hostId
    if (this.splitBrain && emptyAtStart && room.hostId !== c.id) {
      c.hostId = c.id
      const r = room
      this.later(() => { c.hostId = r.hostId }, this.latency * 4)
    }
    c.state = structuredClone(room.state)
    for (const other of room.clients) {
      const p = c.player(other.id)
      if (other !== c) Object.assign(p.state, structuredClone(other.player(other.id).state))
    }
    for (const other of room.clients) {
      if (other === c) continue
      this.later(() => {
        if (other.gone) return
        const p = other.player(c.id)
        Object.assign(p.state, structuredClone(c.player(c.id).state))
        for (const cb of other.joinCbs) cb(p)
      })
    }
  }

  // A change from `from`: into the server's copy now, and every other phone's after the
  // latency.
  broadcast(from: FakeClient, apply: (c: FakeClient) => void) {
    const room = from.room
    if (!room) return
    const snapshot = structuredClone(from.state)
    room.state = { ...room.state, ...snapshot }
    for (const c of room.clients) {
      if (c === from) continue
      this.later(() => { if (!c.gone) apply(c) })
    }
  }

  setHost(room: FakeRoom, id: string) {
    room.hostId = id
    for (const c of room.clients) this.later(() => { c.hostId = id })
  }

  // A phone gone: out of the room, the next one in hosts if it was the host, and the rest
  // hear it has quit.
  leave(c: FakeClient) {
    const room = c.room
    c.gone = true
    if (!room) return
    room.clients = room.clients.filter((x) => x !== c)
    if (room.hostId === c.id) room.hostId = room.clients[0]?.id ?? null
    for (const other of room.clients) {
      this.later(() => {
        other.hostId = room.hostId
        const p = other.players.get(c.id)
        if (!p) return
        other.players.delete(c.id)
        for (const cb of p.quitCbs) cb(p)
      })
    }
    if (room.clients.length === 0) this.rooms.delete(room.code)
  }
}

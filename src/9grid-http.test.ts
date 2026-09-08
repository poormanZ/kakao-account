import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { handleNineGridSession } from "./9grid-http";

class FakeDb {
  private stateJson: string | null = null;
  private version = 1;
  private conflict = false;
  private lastActionId: string | null = null;
  private lastActionResponseJson: string | null = null;
  prepare(query: string) { return new FakeStatement(this, query); }
  getState(): string | null { return this.stateJson; }
  setState(value: string): void { this.stateJson = value; }
  setConflict(value: boolean): void { this.conflict = value; }
  shouldConflict(): boolean { return this.conflict; }
  getVersion(): number { return this.version; }
  setVersion(value: number): void { this.version = value; }
  clearState(): void { this.stateJson = null; }
  getLastActionId(): string | null { return this.lastActionId; }
  setLastAction(id: string | null, response: string | null): void { this.lastActionId = id; this.lastActionResponseJson = response; }
  getLastActionResponseJson(): string | null { return this.lastActionResponseJson; }
}
class FakeStatement {
  constructor(private readonly db: FakeDb, private readonly query: string) {}
  bind(...values: unknown[]): FakeStatementBound { return new FakeStatementBound(this.db, this.query, values); }
}
class FakeStatementBound {
  constructor(private readonly db: FakeDb, private readonly query: string, private readonly values: unknown[]) {}
  async first<T>(): Promise<T | null> {
    if (!this.query.startsWith("SELECT")) return null;
    const stateJson = this.db.getState();
    return stateJson === null ? null : ({ state_json: stateJson, version: this.db.getVersion(), last_action_id: this.db.getLastActionId(), last_action_response_json: this.db.getLastActionResponseJson() } as T);
  }
  async run(): Promise<{ success: true; meta: { changes: number } }> {
    if (this.query.startsWith("INSERT")) {
      this.db.setState(String(this.values[1]));
      this.db.setVersion(1);
      this.db.setLastAction(String(this.values[2]), String(this.values[3]));
      return { success: true, meta: { changes: 1 } };
    }
    if (this.query.startsWith("UPDATE")) {
      if (this.db.shouldConflict()) return { success: true, meta: { changes: 0 } };
      this.db.setState(String(this.values[0]));
      this.db.setVersion(Number(this.values[1]));
      this.db.setLastAction(String(this.values[2]), String(this.values[3]));
      return { success: true, meta: { changes: 1 } };
    }
    if (this.query.startsWith("DELETE")) this.db.clearState();
    return { success: true, meta: { changes: 1 } };
  }
}

const createEnv = (db: FakeDb) => ({ DB: db as unknown as D1Database, NINEGRID_MONSTER_ATTACK: "0" });
let nextAction = 0;
const post = (body: Record<string, unknown>) => new Request("https://example.com/api/games/9grid/session/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ actionId: `test-action-${String(++nextAction).padStart(8, "0")}`, ...body }),
});

describe("9Grid HTTP session", () => {
  it("starts and persists a session for the authenticated internal user", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(post({ type: "start" }), createEnv(db), 7, "action");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: ReturnType<typeof createInitialState> };
    expect(body.state.round.phase).toBe("reroll");
    expect(body.state.round.candidates.cards).toHaveLength(3);
    expect(db.getState()).not.toBeNull();
    expect(db.getVersion()).toBe(1);
  });
  it("replays the persisted response for a duplicate action id", async () => {
    const db = new FakeDb();
    const env = createEnv(db);
    const actionId = "duplicate-action-123456";
    const makeRequest = () => new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, type: "start" }) });
    const first = await handleNineGridSession(makeRequest(), env, 7, "action");
    const firstBody = await first.json() as { state: ReturnType<typeof createInitialState>; monsterAttack: number; actionId: string; version: number };
    const version = db.getVersion();
    const replay = await handleNineGridSession(makeRequest(), env, 7, "action");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ...firstBody, version });
    expect(db.getVersion()).toBe(version);
  });
  it("rejects actions when a session does not exist", async () => {
    const response = await handleNineGridSession(post({ type: "combat" }), createEnv(new FakeDb()), 7, "action");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "9Grid session not found" });
  });
  it("rejects non-JSON and malformed action requests", async () => {
    const db = new FakeDb();
    const env = createEnv(db);
    const wrongContentType = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "start" }), env, 7, "action");
    expect(wrongContentType.status).toBe(400);
    db.setState(JSON.stringify(createInitialState()));
    const malformed = await handleNineGridSession(post({ type: "place", boardIndex: 99 }), env, 7, "action");
    expect(malformed.status).toBe(400);
  });
  it("rejects cross-site action requests", async () => {
    const request = new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ actionId: "cross-site-action-123456", type: "start" }) });
    const response = await handleNineGridSession(request, createEnv(new FakeDb()), 7, "action");
    expect(response.status).toBe(403);
  });
  it("returns 409 when an action loses an optimistic-lock race", async () => {
    const db = new FakeDb();
    const env = createEnv(db);
    expect((await handleNineGridSession(post({ type: "start" }), env, 7, "action")).status).toBe(200);
    expect((await handleNineGridSession(post({ type: "reroll" }), env, 7, "action")).status).toBe(200);
    const storedState = JSON.parse(db.getState() ?? "null") as ReturnType<typeof createInitialState>;
    const cardId = storedState.round.candidates.cards[0]?.id;
    expect(cardId).toBeDefined();
    const versionAfterReroll = db.getVersion();
    db.setConflict(true);
    const response = await handleNineGridSession(post({ type: "select", cardId }), env, 7, "action");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "9Grid session changed; retry the action" });
    expect(db.getVersion()).toBe(versionAfterReroll);
  });
  it("accepts legacy clients without an action id and returns one", async () => {
    const response = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "start" }) }), createEnv(new FakeDb()), 7, "action");
    expect(response.status).toBe(200);
    const body = await response.json() as { actionId: string };
    expect(body.actionId).toEqual(expect.any(String));
  });
  it("enforces GET-only access for the session endpoint", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(post({ type: "start" }), createEnv(db), 7, "session");
    expect(response.status).toBe(405);
    expect(db.getState()).toBeNull();
  });
  it("loads the persisted state through GET", async () => {
    const db = new FakeDb();
    db.setState(JSON.stringify(createInitialState()));
    const response = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session", { method: "GET" }), createEnv(db), 7, "session");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: ReturnType<typeof createInitialState> };
    expect(body.state.round.round).toBe(1);
    expect(body.state.round.turn).toBe(1);
  });
  it("rejects invalid user ids before touching storage", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(post({ type: "start" }), createEnv(db), 0, "action");
    expect(response.status).toBe(401);
    expect(db.getState()).toBeNull();
  });
});

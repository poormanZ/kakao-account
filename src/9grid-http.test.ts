import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { handleNineGridSession } from "./9grid-http";

class FakeDb {
  private stateJson: string | null = null;
  private version = 1;
  private conflict = false;
  prepare(query: string) { return new FakeStatement(this, query); }
  getState(): string | null { return this.stateJson; }
  setState(value: string): void { this.stateJson = value; }
  setConflict(value: boolean): void { this.conflict = value; }
  getVersion(): number { return this.version; }
  setVersion(value: number): void { this.version = value; }
  clearState(): void { this.stateJson = null; }
  shouldConflict(): boolean { return this.conflict; }
}
class FakeStatement {
  constructor(private readonly db: FakeDb, private readonly query: string) {}
  bind(...values: unknown[]): FakeStatementBound { return new FakeStatementBound(this.db, this.query, values); }
}
class FakeStatementBound {
  constructor(private readonly db: FakeDb, private readonly query: string, private readonly values: unknown[]) {}
  async first<T>(): Promise<T | null> {
    if (this.query.startsWith("SELECT")) {
      const stateJson = this.db.getState();
      return stateJson === null ? null : ({ state_json: stateJson, version: this.db.getVersion() } as T);
    }
    return null;
  }
  async run(): Promise<{ success: true; meta: { changes: number } }> {
    if (this.query.startsWith("INSERT")) { this.db.setState(String(this.values[1])); this.db.setVersion(1); return { success: true, meta: { changes: 1 } }; }
    if (this.query.startsWith("UPDATE")) { if (this.db.shouldConflict()) return { success: true, meta: { changes: 0 } }; this.db.setState(String(this.values[0])); this.db.setVersion(Number(this.values[1])); return { success: true, meta: { changes: 1 } }; }
    if (this.query.startsWith("DELETE")) this.db.clearState();
    return { success: true, meta: { changes: 1 } };
  }
}
const createEnv = (db: FakeDb) => ({ DB: db as unknown as D1Database, NINEGRID_MONSTER_ATTACK: "0" });
const post = (body: unknown) => new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("9Grid HTTP session", () => {
  it("starts and persists a session for the authenticated internal user", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(post({ type: "start" }), createEnv(db), 7, "action");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: ReturnType<typeof createInitialState> };
    expect(body.state.round.phase).toBe("select");
    expect(body.state.round.candidates.cards).toHaveLength(3);
    expect(db.getState()).not.toBeNull();
    expect(db.getVersion()).toBe(1);
  });
  it("rejects actions when a session does not exist", async () => { const response = await handleNineGridSession(post({ type: "combat" }), createEnv(new FakeDb()), 7, "action"); expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "9Grid session not found" }); });
  it("rejects non-JSON and malformed action requests", async () => {
    const db = new FakeDb(); const env = createEnv(db);
    const wrongContentType = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "start" }), env, 7, "action");
    expect(wrongContentType.status).toBe(400); db.setState(JSON.stringify(createInitialState()));
    const malformed = await handleNineGridSession(post({ type: "place", boardIndex: 99 }), env, 7, "action"); expect(malformed.status).toBe(400);
  });
  it("rejects cross-site action requests", async () => { const request = new Request("https://example.com/api/games/9grid/session/action", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ type: "start" }) }); const response = await handleNineGridSession(request, createEnv(new FakeDb()), 7, "action"); expect(response.status).toBe(403); });
  it("returns 409 when an action loses an optimistic-lock race", async () => {
    const db = new FakeDb(); const env = createEnv(db); const started = await handleNineGridSession(post({ type: "start" }), env, 7, "action"); expect(started.status).toBe(200);
    const storedState = JSON.parse(db.getState() ?? "null") as ReturnType<typeof createInitialState>; const cardId = storedState.round.candidates.cards[0]?.id; expect(cardId).toBeDefined(); db.setConflict(true);
    const response = await handleNineGridSession(post({ type: "select", cardId }), env, 7, "action"); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "9Grid session changed; retry the action" }); expect(db.getVersion()).toBe(1);
  });
  it("enforces GET-only access for the session endpoint", async () => { const db = new FakeDb(); const response = await handleNineGridSession(post({ type: "start" }), createEnv(db), 7, "session"); expect(response.status).toBe(405); expect(db.getState()).toBeNull(); });
  it("loads the persisted state through GET", async () => {
    const db = new FakeDb(); db.setState(JSON.stringify(createInitialState()));
    const response = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session", { method: "GET" }), createEnv(db), 7, "session");
    expect(response.status).toBe(200); const body = (await response.json()) as { state: ReturnType<typeof createInitialState> }; expect(body.state.playerStats.attack).toBe(2); expect(body.state.round.playerHp).toBe(80);
  });
  it("rejects invalid user ids before touching storage", async () => { const db = new FakeDb(); const response = await handleNineGridSession(new Request("https://example.com/api/games/9grid/session", { method: "GET" }), createEnv(db), 0, "session"); expect(response.status).toBe(401); expect(db.getState()).toBeNull(); });
});

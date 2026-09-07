import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { handleNineGridSession } from "./9grid-http";

class FakeDb {
  private stateJson: string | null = null;

  prepare(query: string) {
    return new FakeStatement(this, query);
  }

  getState(): string | null {
    return this.stateJson;
  }

  setState(value: string): void {
    this.stateJson = value;
  }

  clearState(): void {
    this.stateJson = null;
  }
}

class FakeStatement {
  constructor(private readonly db: FakeDb, private readonly query: string) {}

  bind(...values: unknown[]): FakeStatementBound {
    return new FakeStatementBound(this.db, this.query, values);
  }
}

class FakeStatementBound {
  constructor(
    private readonly db: FakeDb,
    private readonly query: string,
    private readonly values: unknown[],
  ) {}

  async first<T>(): Promise<T | null> {
    if (this.query.startsWith("SELECT")) {
      const stateJson = this.db.getState();
      return stateJson === null ? null : ({ state_json: stateJson } as T);
    }
    return null;
  }

  async run(): Promise<{ success: true }> {
    if (this.query.startsWith("INSERT")) {
      this.db.setState(String(this.values[1]));
    } else if (this.query.startsWith("DELETE")) {
      this.db.clearState();
    }
    return { success: true };
  }
}

const createEnv = (db: FakeDb) =>
  ({ DB: db as unknown as D1Database, NINEGRID_MONSTER_ATTACK: "0" });

const post = (body: unknown) =>
  new Request("https://example.com/api/games/9grid/session/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("9Grid HTTP session", () => {
  it("starts and persists a session for the authenticated internal user", async () => {
    const db = new FakeDb();
    const env = createEnv(db);

    const response = await handleNineGridSession(post({ type: "start" }), env, 7);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: ReturnType<typeof createInitialState> };

    expect(body.state.round.phase).toBe("reroll");
    expect(body.state.round.candidates.cards).toHaveLength(3);
    expect(db.getState()).not.toBeNull();
  });

  it("rejects actions when a session does not exist", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(
      post({ type: "combat" }),
      createEnv(db),
      7,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "9Grid session not found" });
  });

  it("rejects non-JSON and malformed action requests", async () => {
    const db = new FakeDb();
    const env = createEnv(db);

    const wrongContentType = await handleNineGridSession(
      new Request("https://example.com/api/games/9grid/session/action", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "start",
      }),
      env,
      7,
    );
    expect(wrongContentType.status).toBe(400);

    const malformed = await handleNineGridSession(
      post({ type: "place", boardIndex: 99 }),
      env,
      7,
    );
    expect(malformed.status).toBe(400);
  });

  it("loads the persisted state through GET", async () => {
    const db = new FakeDb();
    db.setState(JSON.stringify(createInitialState()));

    const response = await handleNineGridSession(
      new Request("https://example.com/api/games/9grid/session", { method: "GET" }),
      createEnv(db),
      7,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: ReturnType<typeof createInitialState> };
    expect(body.state.playerStats.attack).toBe(1);
    expect(body.state.round.playerHp).toBe(100);
  });

  it("rejects invalid user ids before touching storage", async () => {
    const db = new FakeDb();
    const response = await handleNineGridSession(
      new Request("https://example.com/api/games/9grid/session", { method: "GET" }),
      createEnv(db),
      0,
    );

    expect(response.status).toBe(401);
  });
});

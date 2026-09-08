import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { calculate9GridScore, save9GridScore } from "./9grid-score";
import type { AuthUser } from "./auth";

class FakeDb {
  stateJson: string | null = null;
  insertedValues: unknown[] | null = null;

  prepare(query: string) {
    return new FakeStatement(this, query);
  }

  setState(stateJson: string): void {
    this.stateJson = stateJson;
  }
}

class FakeStatement {
  constructor(
    private readonly db: FakeDb,
    private readonly query: string,
  ) {}

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
    if (!this.query.startsWith("SELECT")) return null;
    const stateJson = this.db.stateJson;
    return stateJson === null
      ? null
      : ({ state_json: stateJson, version: 1 } as T);
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    if (this.query.startsWith("INSERT") && this.query.includes('"9grid_scores"')) {
      this.db.insertedValues = this.values;
    }
    return { success: true, meta: { changes: 1 } };
  }
}

const createEnv = (db: FakeDb) => ({ DB: db as unknown as D1Database });
const user: AuthUser = { id: 7, nickname: null, profile_image_url: null };

describe("9Grid score persistence", () => {
  it("calculates score only from cleared rounds", () => {
    expect(calculate9GridScore(0)).toBe(0);
    expect(calculate9GridScore(1)).toBe(1000);
    expect(calculate9GridScore(5)).toBe(5000);
  });

  it("rejects saving when no server session exists", async () => {
    const db = new FakeDb();
    const response = await save9GridScore(new Request("https://example.com"), createEnv(db), user);

    expect(response.status).toBe(404);
    expect(db.insertedValues).toBeNull();
  });

  it("rejects saving before the server session reaches game over", async () => {
    const db = new FakeDb();
    db.setState(JSON.stringify(createInitialState()));

    const response = await save9GridScore(new Request("https://example.com"), createEnv(db), user);

    expect(response.status).toBe(409);
    expect(db.insertedValues).toBeNull();
  });

  it("persists the round-based score from authoritative server state", async () => {
    const db = new FakeDb();
    const state = createInitialState();
    state.maxClearedRound = 4;
    state.lastRoundClearTurn = 7;
    state.lastRoundClearAt = "2026-09-08T08:00:00.000Z";
    state.round.playerHp = 63;
    state.round.phase = "game_over";
    state.gameOver = true;
    db.setState(JSON.stringify(state));

    const forgedRequest = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ score: 999999, max_round: 999 }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await save9GridScore(forgedRequest, createEnv(db), user);
    const body = (await response.json()) as {
      saved: boolean;
      score: {
        score: number;
        max_round: number;
        last_round_clear_at: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      saved: true,
      score: {
        score: 4000,
        max_round: 4,
        last_round_clear_at: "2026-09-08T08:00:00.000Z",
      },
    });
    expect(db.insertedValues).toEqual([7, 4, 7, 63, 4000, "2026-09-08T08:00:00.000Z"]);
  });
});

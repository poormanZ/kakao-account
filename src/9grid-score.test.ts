import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { save9GridScore } from "./9grid-score";
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
    return stateJson === null ? null : ({ state_json: stateJson } as T);
  }

  async run(): Promise<{ success: true }> {
    if (this.query.startsWith("INSERT") && this.query.includes('"9grid_scores"')) {
      this.db.insertedValues = this.values;
    }
    return { success: true };
  }
}

const createEnv = (db: FakeDb) => ({ DB: db as unknown as D1Database });
const user: AuthUser = { id: 7, nickname: null, profile_image_url: null };

describe("9Grid score persistence", () => {
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

  it("persists score values from server state instead of request data", async () => {
    const db = new FakeDb();
    const state = createInitialState();
    state.maxClearedRound = 4;
    state.lastRoundClearTurn = 7;
    state.round.playerHp = 63;
    state.round.phase = "game_over";
    state.gameOver = true;
    db.setState(JSON.stringify(state));

    const forgedRequest = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        max_round: 999,
        last_round_clear_turn: 1,
        remaining_hp: 999,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await save9GridScore(forgedRequest, createEnv(db), user);
    const body = (await response.json()) as {
      saved: boolean;
      score: {
        max_round: number;
        last_round_clear_turn: number;
        remaining_hp: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      saved: true,
      score: {
        max_round: 4,
        last_round_clear_turn: 7,
        remaining_hp: 63,
      },
    });
    expect(db.insertedValues).toEqual([7, 4, 7, 63]);
  });
});

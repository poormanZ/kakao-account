import { describe, expect, it } from "vitest";
import { createInitialState } from "./9grid";
import { getJobBaseStatValue, getMonsterAttack, getMonsterMaxHp, INITIAL_PLAYER_STATS, JOB_BASE_STAT_VALUES, MONSTER_ATTACK_BY_ROUND, MONSTER_MAX_HP_BY_ROUND } from "./9grid-balance";

describe("9Grid balance", () => {
  it("uses the tuned player baseline", () => {
    const state = createInitialState();
    expect(state.playerStats).toEqual(INITIAL_PLAYER_STATS);
    expect(INITIAL_PLAYER_STATS).toEqual({ attack: 2, defense: 2, maxHp: 80, mana: 1 });
  });

  it("uses tuned permanent job gains", () => {
    expect(JOB_BASE_STAT_VALUES).toEqual({ warrior: 2, tank: 2, healer: 6, mage: 1 });
    expect(getJobBaseStatValue("warrior")).toBe(2);
    expect(getJobBaseStatValue("tank")).toBe(2);
    expect(getJobBaseStatValue("healer")).toBe(6);
    expect(getJobBaseStatValue("mage")).toBe(1);
  });

  it("uses the round-by-round monster curve", () => {
    expect(MONSTER_MAX_HP_BY_ROUND).toEqual([100, 180, 300, 500, 800, 1100, 1500, 2050, 2800, 3800]);
    expect(MONSTER_ATTACK_BY_ROUND).toEqual([10, 14, 18, 22, 26, 30, 34, 38, 42, 46]);
    expect(getMonsterMaxHp(1)).toBe(100);
    expect(getMonsterMaxHp(10)).toBe(3800);
    expect(getMonsterMaxHp(11)).toBe(5130);
    expect(getMonsterAttack(1)).toBe(10);
    expect(getMonsterAttack(10)).toBe(46);
    expect(getMonsterAttack(11)).toBe(50);
  });

  it("rejects invalid balance round inputs", () => {
    expect(() => getMonsterMaxHp(0)).toThrow("Invalid round");
    expect(() => getMonsterAttack(0)).toThrow("Invalid round");
  });
});

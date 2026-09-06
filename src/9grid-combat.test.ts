import { describe, expect, it } from "vitest";
import { createCard, findBoardSynergy } from "./9grid";
import { calculateCombat, calculateCombatStats } from "./9grid-combat";

const line = (element: "fire" | "water" | "wind" | "earth", job: "tank" | "warrior" | "healer" | "mage") =>
  Array.from({ length: 3 }, (_, index) => createCard(`${element}-${job}-${index}`, element, job));

describe("9Grid combat", () => {
  it("converts each active element/job line into combat stats", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const synergy = findBoardSynergy(board);
    const stats = calculateCombatStats(synergy);

    expect(synergy.elements.fire).toBe(1);
    expect(synergy.jobs.warrior).toBe(1);
    expect(stats.attack).toBe(24);
    expect(stats.critChance).toBeCloseTo(0.15);
  });

  it("applies crit damage when the deterministic roll is below crit chance", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 100,
      critRoll: 0,
    });

    expect(result.playerDamage).toBe(48);
    expect(result.monsterHpAfter).toBe(52);
  });

  it("ends the exchange immediately when the monster is defeated", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 50,
      playerMaxHp: 100,
      monsterHp: 20,
      critRoll: 1,
    });

    expect(result.monsterDefeated).toBe(true);
    expect(result.monsterDamage).toBe(0);
  });

  it("applies water/tank mitigation and healing without exceeding max hp", () => {
    const board = [...line("water", "tank"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 95,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 20,
      critRoll: 1,
    });

    expect(result.playerStats.damageReduction).toBeCloseTo(0.2);
    expect(result.playerStats.defense).toBe(10);
    expect(result.healing).toBe(20);
    expect(result.shieldGained).toBe(12);
    expect(result.playerHpAfter).toBe(100);
  });

  it("marks game defeat when the post-combat hp reaches zero", () => {
    const synergy = { lines: [], elements: {}, jobs: {} };
    const result = calculateCombat({
      synergy,
      playerHp: 5,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 20,
    });

    expect(result.playerHpAfter).toBe(0);
    expect(result.playerDefeated).toBe(true);
  });
});

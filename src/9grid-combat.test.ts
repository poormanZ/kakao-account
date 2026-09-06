import { describe, expect, it } from "vitest";
import { findBoardSynergy } from "./9grid";
import { calculateCombat } from "./9grid-combat";

function line(element: "fire" | "water" | "wind" | "earth", job: "tank" | "warrior" | "healer" | "mage") {
  return [
    { id: "1", element, job },
    { id: "2", element, job },
    { id: "3", element, job },
  ];
}

describe("9Grid combat", () => {
  it("converts each active element/job line into combat stats", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 20,
      critRoll: 1,
    });

    expect(result.playerStats.attack).toBe(24);
    expect(result.playerStats.critChance).toBeCloseTo(0.15);
    expect(result.playerStats.skillDamage).toBe(3);
  });

  it("applies crit damage to attack and skill damage when the roll is below crit chance", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 0,
      critRoll: 0.1,
    });

    expect(result.playerDamage).toBe(54);
    expect(result.monsterHpAfter).toBe(46);
  });

  it("ends the exchange immediately when the monster is defeated", () => {
    const board = [...line("fire", "warrior"), ...Array(6).fill(null)];
    const result = calculateCombat({
      synergy: findBoardSynergy(board),
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 10,
      monsterAttack: 20,
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
    expect(result.playerStats.defense).toBe(6);
    expect(result.healing).toBe(8);
    expect(result.shieldGained).toBe(12);
    expect(result.playerHpAfter).toBe(93);
  });

  it("marks game defeat when the post-combat hp reaches zero", () => {
    const synergy = { lines: [], elements: {}, jobs: {} };
    const result = calculateCombat({
      synergy,
      playerHp: 5,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 20,
      critRoll: 1,
    });

    expect(result.playerHpAfter).toBe(0);
    expect(result.playerDefeated).toBe(true);
  });
});

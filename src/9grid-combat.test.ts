import { describe, expect, it } from "vitest";
import { createCard, createEmptyBoard, findBoardSynergy } from "./9grid";
import { calculateCombat, calculateCombatStats } from "./9grid-combat";

const line = (
  race: "goblin" | "elf" | "dwarf" | "dragon",
  job: "tank" | "warrior" | "healer" | "mage",
) => [
  createCard("1", race, job),
  createCard("2", race, job),
  createCard("3", race, job),
];

describe("9Grid combat", () => {
  it("uses Warrior synergy level for multiplied attack", () => {
    const result = calculateCombatStats({
      lines: [],
      races: {},
      jobs: { warrior: 1 },
    });

    expect(result.attack).toBe(4);
  });

  it("uses Tank synergy level for multiplied defense", () => {
    const result = calculateCombatStats({
      lines: [],
      races: {},
      jobs: { tank: 2 },
    });

    expect(result.defense).toBe(6);
  });

  it("uses Healer count and synergy for recovery", () => {
    const synergy = findBoardSynergy(line("goblin", "healer"));
    const result = calculateCombatStats(synergy);

    expect(result.heal).toBe(6);
  });

  it("counts placed Healer cards even without a Healer synergy line", () => {
    const board = createEmptyBoard();
    board[0] = createCard("1", "goblin", "healer");
    board[1] = createCard("2", "elf", "healer");
    const synergy = findBoardSynergy(board);
    const result = calculateCombatStats(synergy, board);

    expect(result.heal).toBe(2);
  });

  it("uses Mage synergy level for mana-based combat power", () => {
    const result = calculateCombatStats({
      lines: [],
      races: {},
      jobs: { mage: 3 },
    });

    expect(result.skillDamage).toBe(4);
  });

  it("uses Elf synergy level as additional attacks", () => {
    const synergy = findBoardSynergy(line("elf", "warrior"));
    const result = calculateCombatStats(synergy);

    expect(result.extraAttacks).toBe(1);
  });

  it("combines job and race effects during combat", () => {
    const synergy = findBoardSynergy(line("elf", "warrior"));
    const result = calculateCombat({
      synergy,
      playerHp: 100,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 1,
    });

    expect(result.playerDamage).toBe(10);
    expect(result.playerHpAfter).toBe(100);
  });

  it("marks game defeat when post-combat HP reaches zero", () => {
    const result = calculateCombat({
      synergy: { lines: [], races: {}, jobs: {} },
      playerHp: 5,
      playerMaxHp: 100,
      monsterHp: 100,
      monsterAttack: 20,
    });

    expect(result.playerHpAfter).toBe(0);
    expect(result.playerDefeated).toBe(true);
  });
});

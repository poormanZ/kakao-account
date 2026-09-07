import { describe, expect, it } from "vitest";
import {
  calculateDragonScore,
  calculateHealerRecovery,
  calculateMagePower,
  calculateTankDefense,
  calculateWarriorDamage,
  getDwarfPlacementStatBonus,
  getElfAttackCountBonus,
  getGoblinRerollBonus,
} from "./9grid-effects";

describe("9Grid effects", () => {
  it("multiplies Warrior damage by synergy level", () => {
    expect(calculateWarriorDamage(2, 0)).toBe(2);
    expect(calculateWarriorDamage(2, 5)).toBe(12);
  });

  it("multiplies Tank defense by synergy level", () => {
    expect(calculateTankDefense(3, 0)).toBe(3);
    expect(calculateTankDefense(3, 5)).toBe(18);
  });

  it("multiplies Healer recovery by synergy level", () => {
    expect(calculateHealerRecovery(3, 0)).toBe(3);
    expect(calculateHealerRecovery(3, 5)).toBe(18);
  });

  it("multiplies Mage power by synergy level", () => {
    expect(calculateMagePower(2, 0)).toBe(2);
    expect(calculateMagePower(2, 5)).toBe(12);
  });

  it("uses synergy level as Goblin reroll bonus", () => {
    expect(getGoblinRerollBonus(0)).toBe(0);
    expect(getGoblinRerollBonus(5)).toBe(5);
  });

  it("uses synergy level as Elf attack bonus", () => {
    expect(getElfAttackCountBonus(0)).toBe(0);
    expect(getElfAttackCountBonus(5)).toBe(5);
  });

  it("uses synergy level as Dwarf placement bonus", () => {
    expect(getDwarfPlacementStatBonus(0)).toBe(0);
    expect(getDwarfPlacementStatBonus(5)).toBe(5);
  });

  it("calculates Dragon score as round times synergy level", () => {
    expect(calculateDragonScore(3, 0)).toBe(0);
    expect(calculateDragonScore(3, 5)).toBe(15);
  });

  it("clamps effect synergy to the supported range", () => {
    expect(calculateWarriorDamage(2, -1)).toBe(2);
    expect(calculateWarriorDamage(2, 99)).toBe(12);
    expect(calculateDragonScore(3, 99)).toBe(15);
  });
});

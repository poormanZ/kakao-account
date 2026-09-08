import { describe, expect, it } from "vitest";
import {
  FORGE_MAX_ENHANCEMENT,
  createInitialForgeState,
  getBaseSuccessRate,
  getGreatSuccessRate,
  getSellPrice,
  getUpgradeCost,
  getUpgradeSuccessRate,
  getWeaponDamage,
  resolveUpgrade,
} from "./forge";

describe("forge game rules", () => {
  it("creates the documented initial state", () => {
    const state = createInitialForgeState();

    expect(state.gold).toBe(10);
    expect(state.currentWeapon.enhancementLevel).toBe(0);
    expect(getWeaponDamage(state.currentWeapon)).toBe(1);
  });

  it("doubles weapon damage for each enhancement level", () => {
    const state = createInitialForgeState();

    for (let level = 0; level <= FORGE_MAX_ENHANCEMENT; level += 1) {
      const weapon = { ...state.currentWeapon, enhancementLevel: level };
      expect(getWeaponDamage(weapon)).toBe(2 ** level);
    }
  });

  it("uses the current enhancement level as the upgrade cost", () => {
    expect(getUpgradeCost(0)).toBe(0);
    expect(getUpgradeCost(1)).toBe(1);
    expect(getUpgradeCost(5)).toBe(5);
    expect(getUpgradeCost(FORGE_MAX_ENHANCEMENT)).toBe(0);
  });

  it("applies the decreasing base success rates", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(getBaseSuccessRate)).toEqual([
      90, 80, 70, 60, 50, 40, 30, 20, 10, 5,
    ]);
  });

  it("adds enhancement skill bonuses as percentage points", () => {
    expect(getUpgradeSuccessRate(4, {
      enhancementBonusLevel: 0,
      greatSuccessLevel: 0,
      sellBonusLevel: 0,
    })).toBe(50);
    expect(getUpgradeSuccessRate(4, {
      enhancementBonusLevel: 3,
      greatSuccessLevel: 0,
      sellBonusLevel: 0,
    })).toBe(53);
  });

  it("calculates sell price from damage and sell skill bonus", () => {
    const state = createInitialForgeState();
    const weapon = { ...state.currentWeapon, enhancementLevel: 5 };

    expect(getSellPrice(weapon, {
      enhancementBonusLevel: 0,
      greatSuccessLevel: 0,
      sellBonusLevel: 0,
    })).toBe(32);
    expect(getSellPrice(weapon, {
      enhancementBonusLevel: 0,
      greatSuccessLevel: 0,
      sellBonusLevel: 5,
    })).toBe(33);
  });

  it("resolves a normal successful upgrade", () => {
    const state = createInitialForgeState();
    const result = resolveUpgrade(state, 0.1, 0.99);

    expect(result).toEqual({
      kind: "success",
      weapon: { ...state.currentWeapon, enhancementLevel: 1 },
      cost: 0,
    });
  });

  it("resolves a great success as two levels", () => {
    const state = createInitialForgeState();
    state.skills.greatSuccessLevel = 1;

    const result = resolveUpgrade(state, 0.1, 0);

    expect(result.kind).toBe("great_success");
    expect(result.weapon?.enhancementLevel).toBe(2);
  });

  it("destroys the weapon when enhancement fails", () => {
    const state = createInitialForgeState();
    state.currentWeapon.enhancementLevel = 3;
    state.gold = 10;

    const result = resolveUpgrade(state, 0.61, 0);

    expect(result).toEqual({ kind: "failed", weapon: null, cost: 3 });
  });

  it("rejects an upgrade when there is not enough gold", () => {
    const state = createInitialForgeState();
    state.currentWeapon.enhancementLevel = 5;
    state.gold = 4;

    expect(() => resolveUpgrade(state, 0, 0)).toThrow("Upgrade unavailable");
  });

  it("caps great success at the maximum enhancement level", () => {
    const state = createInitialForgeState();
    state.currentWeapon.enhancementLevel = FORGE_MAX_ENHANCEMENT - 1;
    state.skills.greatSuccessLevel = 100;

    const result = resolveUpgrade(state, 0, 0);

    expect(result.weapon?.enhancementLevel).toBe(FORGE_MAX_ENHANCEMENT);
    expect(getGreatSuccessRate(state.skills)).toBe(100);
  });
});

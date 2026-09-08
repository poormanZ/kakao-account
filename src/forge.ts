export const FORGE_MAX_ENHANCEMENT = 10;

const BASE_SUCCESS_RATES = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5] as const;

export type ForgeRarity = "common";

export type ForgeWeapon = {
  id: string;
  name: string;
  baseDamage: number;
  enhancementLevel: number;
  rarity: ForgeRarity;
};

export type ForgeSkills = {
  enhancementBonusLevel: number;
  greatSuccessLevel: number;
  sellBonusLevel: number;
};

export type ForgeGameState = {
  gold: number;
  currentWeapon: ForgeWeapon;
  skills: ForgeSkills;
};

export type UpgradeResult =
  | { kind: "success"; weapon: ForgeWeapon; cost: number }
  | { kind: "great_success"; weapon: ForgeWeapon; cost: number }
  | { kind: "failed"; weapon: null; cost: number };

export const createInitialForgeWeapon = (): ForgeWeapon => ({
  id: "common-sword",
  name: "일반검",
  baseDamage: 1,
  enhancementLevel: 0,
  rarity: "common",
});

export const createInitialForgeState = (): ForgeGameState => ({
  gold: 10,
  currentWeapon: createInitialForgeWeapon(),
  skills: {
    enhancementBonusLevel: 0,
    greatSuccessLevel: 0,
    sellBonusLevel: 0,
  },
});

const assertNonNegativeInteger = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}`);
  }
};

export const getWeaponDamage = (weapon: ForgeWeapon): number => {
  assertNonNegativeInteger(weapon.baseDamage, "base damage");
  assertNonNegativeInteger(weapon.enhancementLevel, "enhancement level");
  return weapon.baseDamage * 2 ** weapon.enhancementLevel;
};

export const getUpgradeCost = (enhancementLevel: number): number => {
  assertNonNegativeInteger(enhancementLevel, "enhancement level");
  if (enhancementLevel >= FORGE_MAX_ENHANCEMENT) return 0;
  return enhancementLevel;
};

export const getBaseSuccessRate = (enhancementLevel: number): number => {
  assertNonNegativeInteger(enhancementLevel, "enhancement level");
  if (enhancementLevel >= FORGE_MAX_ENHANCEMENT) return 0;
  return BASE_SUCCESS_RATES[enhancementLevel] ?? 5;
};

export const getUpgradeSuccessRate = (
  enhancementLevel: number,
  skills: ForgeSkills,
): number => {
  assertNonNegativeInteger(skills.enhancementBonusLevel, "enhancement bonus level");
  const baseRate = getBaseSuccessRate(enhancementLevel);
  return Math.min(100, baseRate + skills.enhancementBonusLevel);
};

export const getGreatSuccessRate = (skills: ForgeSkills): number => {
  assertNonNegativeInteger(skills.greatSuccessLevel, "great success level");
  return Math.min(100, skills.greatSuccessLevel);
};

export const getSellPrice = (
  weapon: ForgeWeapon,
  skills: ForgeSkills,
): number => {
  assertNonNegativeInteger(skills.sellBonusLevel, "sell bonus level");
  const damage = getWeaponDamage(weapon);
  return Math.floor(damage * (100 + skills.sellBonusLevel) / 100);
};

export const resolveUpgrade = (
  state: ForgeGameState,
  successRoll: number,
  greatSuccessRoll: number,
): UpgradeResult => {
  if (!Number.isFinite(successRoll) || successRoll < 0 || successRoll >= 1) {
    throw new Error("Invalid success roll");
  }
  if (!Number.isFinite(greatSuccessRoll) || greatSuccessRoll < 0 || greatSuccessRoll >= 1) {
    throw new Error("Invalid great success roll");
  }

  const { currentWeapon: weapon, skills } = state;
  const level = weapon.enhancementLevel;
  const cost = getUpgradeCost(level);

  if (level >= FORGE_MAX_ENHANCEMENT || state.gold < cost) {
    throw new Error("Upgrade unavailable");
  }

  const successRate = getUpgradeSuccessRate(level, skills);
  if (successRoll >= successRate / 100) {
    return { kind: "failed", weapon: null, cost };
  }

  const isGreatSuccess = greatSuccessRoll < getGreatSuccessRate(skills) / 100;
  const levelIncrease = isGreatSuccess ? 2 : 1;
  const nextLevel = Math.min(FORGE_MAX_ENHANCEMENT, level + levelIncrease);

  return {
    kind: isGreatSuccess ? "great_success" : "success",
    weapon: { ...weapon, enhancementLevel: nextLevel },
    cost,
  };
};

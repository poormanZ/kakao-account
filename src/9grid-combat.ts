import type { Job, Race, SynergyResult } from "./9grid";

export interface CombatStats {
  attack: number;
  defense: number;
  maxHp: number;
  heal: number;
  shield: number;
  critChance: number;
  damageReduction: number;
  extraAttacks: number;
  skillDamage: number;
}

export interface CombatResult {
  playerStats: CombatStats;
  playerDamage: number;
  monsterDamage: number;
  healing: number;
  shieldGained: number;
  shieldAbsorbed: number;
  playerHpAfter: number;
  monsterHpAfter: number;
  monsterDefeated: boolean;
  playerDefeated: boolean;
}

const getSynergyLevel = <T extends string>(
  values: Partial<Record<T, number>>,
  key: T,
): number => Math.min(5, Math.max(0, values[key] ?? 0));

export const calculateJobEffect = (job: Job, baseValue: number, synergyLevel: number): number => {
  const level = getSynergyLevel({ value: synergyLevel }, "value");
  return baseValue * (level + 1);
};

export const calculateRaceEffect = (race: Race, synergyLevel: number): number => {
  const level = getSynergyLevel({ value: synergyLevel }, "value");
  switch (race) {
    case "goblin":
      return level;
    case "elf":
      return level;
    case "dwarf":
      return level;
    case "dragon":
      return level;
  }
};

export const calculateCombatStats = (synergy: SynergyResult): CombatStats => {
  const warriorLevel = getSynergyLevel(synergy.jobs, "warrior");
  const tankLevel = getSynergyLevel(synergy.jobs, "tank");
  const healerLevel = getSynergyLevel(synergy.jobs, "healer");
  const mageLevel = getSynergyLevel(synergy.jobs, "mage");
  const elfLevel = getSynergyLevel(synergy.races, "elf");
  const healerCount = synergy.lines.filter((line) => line.job === "healer").length * 3;

  return {
    attack: calculateJobEffect("warrior", 1, warriorLevel),
    defense: calculateJobEffect("tank", 1, tankLevel),
    maxHp: 10 + calculateJobEffect("healer", healerCount, healerLevel),
    heal: calculateJobEffect("healer", healerCount, healerLevel),
    shield: 0,
    critChance: 0,
    damageReduction: 0,
    extraAttacks: calculateRaceEffect("elf", elfLevel),
    skillDamage: calculateJobEffect("mage", 1, mageLevel),
  };
};

export const calculateCombat = ({
  synergy,
  playerHp,
  playerMaxHp,
  monsterHp,
  monsterAttack = 8,
}: {
  synergy: SynergyResult;
  playerHp: number;
  playerMaxHp: number;
  monsterHp: number;
  monsterAttack?: number;
  critRoll?: number;
}): CombatResult => {
  const playerStats = calculateCombatStats(synergy);
  const effectiveMaxHp = Math.max(playerMaxHp, playerStats.maxHp);
  const attacks = 1 + playerStats.extraAttacks;
  const playerDamage = Math.max(0, Math.floor((playerStats.attack + playerStats.skillDamage) * attacks));
  const monsterHpAfter = Math.max(0, monsterHp - playerDamage);
  const healing = playerStats.heal;
  const shieldGained = playerStats.shield;

  if (monsterHpAfter === 0) {
    return {
      playerStats,
      playerDamage,
      monsterDamage: 0,
      healing,
      shieldGained,
      shieldAbsorbed: 0,
      playerHpAfter: Math.min(effectiveMaxHp, playerHp + healing),
      monsterHpAfter,
      monsterDefeated: true,
      playerDefeated: false,
    };
  }

  const monsterDamage = Math.max(0, Math.floor(monsterAttack - playerStats.defense));
  const shieldAbsorbed = Math.min(shieldGained, monsterDamage);
  const hpDamage = monsterDamage - shieldAbsorbed;
  const hpAfterDefense = Math.max(0, playerHp + healing - hpDamage);
  const playerHpAfter = Math.min(effectiveMaxHp, hpAfterDefense);

  return {
    playerStats,
    playerDamage,
    monsterDamage,
    healing,
    shieldGained,
    shieldAbsorbed,
    playerHpAfter,
    monsterHpAfter,
    monsterDefeated: false,
    playerDefeated: playerHpAfter <= 0,
  };
};

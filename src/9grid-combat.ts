import type { Element, Job, SynergyResult } from "./9grid";

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
  playerHpAfter: number;
  monsterHpAfter: number;
  monsterDefeated: boolean;
  playerDefeated: boolean;
}

const ELEMENT_EFFECTS: Record<Element, Partial<CombatStats>> = {
  fire: { attack: 6, critChance: 0.1, skillDamage: 3 },
  water: { heal: 8, damageReduction: 0.1, shield: 4 },
  wind: { extraAttacks: 1, critChance: 0.05 },
  earth: { maxHp: 10, defense: 4, damageReduction: 0.05 },
};

const JOB_EFFECTS: Record<Job, Partial<CombatStats>> = {
  tank: { defense: 6, shield: 8, damageReduction: 0.1 },
  warrior: { attack: 8, critChance: 0.05 },
  healer: { heal: 12 },
  mage: { skillDamage: 10, attack: 3 },
};

export const calculateCombatStats = (synergy: SynergyResult): CombatStats => {
  const stats: CombatStats = {
    attack: 10,
    defense: 0,
    maxHp: 100,
    heal: 0,
    shield: 0,
    critChance: 0,
    damageReduction: 0,
    extraAttacks: 0,
    skillDamage: 0,
  };

  for (const [element, count] of Object.entries(synergy.elements) as Array<[Element, number]>) {
    const effect = ELEMENT_EFFECTS[element];
    for (const [key, value] of Object.entries(effect) as Array<[keyof CombatStats, number]>) {
      stats[key] += value * count;
    }
  }

  for (const [job, count] of Object.entries(synergy.jobs) as Array<[Job, number]>) {
    const effect = JOB_EFFECTS[job];
    for (const [key, value] of Object.entries(effect) as Array<[keyof CombatStats, number]>) {
      stats[key] += value * count;
    }
  }

  stats.damageReduction = Math.min(stats.damageReduction, 0.75);
  stats.critChance = Math.min(stats.critChance, 1);
  return stats;
};

export const calculateCombat = ({
  synergy,
  playerHp,
  playerMaxHp,
  monsterHp,
  monsterAttack = 8,
  critRoll = 1,
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
  const critMultiplier = critRoll < playerStats.critChance ? 2 : 1;
  const attacks = 1 + playerStats.extraAttacks;
  const playerDamage = Math.max(0, Math.floor((playerStats.attack + playerStats.skillDamage) * attacks * critMultiplier));
  const monsterHpAfter = Math.max(0, monsterHp - playerDamage);

  if (monsterHpAfter === 0) {
    return {
      playerStats,
      playerDamage,
      monsterDamage: 0,
      healing: playerStats.heal,
      shieldGained: playerStats.shield,
      playerHpAfter: Math.min(effectiveMaxHp, playerHp + playerStats.heal),
      monsterHpAfter,
      monsterDefeated: true,
      playerDefeated: false,
    };
  }

  const monsterDamage = Math.max(0, Math.floor(monsterAttack * (1 - playerStats.damageReduction) - playerStats.defense));
  const healing = playerStats.heal;
  const shieldGained = playerStats.shield;
  const hpAfterDefense = Math.max(0, playerHp + healing - monsterDamage);
  const playerHpAfter = Math.min(effectiveMaxHp, hpAfterDefense);

  return {
    playerStats,
    playerDamage,
    monsterDamage,
    healing,
    shieldGained,
    playerHpAfter,
    monsterHpAfter,
    monsterDefeated: false,
    playerDefeated: playerHpAfter <= 0,
  };
};

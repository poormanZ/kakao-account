import type { Board, Job, PlayerStats, Race, SynergyResult } from "./9grid";
import {
  calculateHealerRecovery,
  calculateMagePower,
  calculateTankDefense,
  calculateWarriorDamage,
  getElfAttackCountBonus,
} from "./9grid-effects";

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

const getSynergyLevel = <T extends string>(values: Partial<Record<T, number>>, key: T): number =>
  Math.min(5, Math.max(0, values[key] ?? 0));

export const calculateJobEffect = (job: Job, baseValue: number, synergyLevel: number): number => {
  const level = getSynergyLevel({ value: synergyLevel }, "value");
  switch (job) {
    case "warrior": return calculateWarriorDamage(baseValue, level);
    case "tank": return calculateTankDefense(baseValue, level);
    case "healer": return calculateHealerRecovery(baseValue, level);
    case "mage": return calculateMagePower(baseValue, level);
  }
};

export const calculateRaceEffect = (race: Race, synergyLevel: number): number => {
  const level = getSynergyLevel({ value: synergyLevel }, "value");
  switch (race) {
    case "goblin":
    case "dwarf":
    case "dragon": return level;
    case "elf": return getElfAttackCountBonus(level);
  }
};

const countPlacedHealers = (board: Board): number =>
  board.reduce((count, card) => count + (card?.job === "healer" ? 1 : 0), 0);

const defaultPlayerStats: PlayerStats = { attack: 1, defense: 1, maxHp: 100, mana: 1 };

export const calculateCombatStats = (
  synergy: SynergyResult,
  board?: Board,
  playerStats: PlayerStats = defaultPlayerStats,
): CombatStats => {
  const warriorLevel = getSynergyLevel(synergy.jobs, "warrior");
  const tankLevel = getSynergyLevel(synergy.jobs, "tank");
  const healerLevel = getSynergyLevel(synergy.jobs, "healer");
  const mageLevel = getSynergyLevel(synergy.jobs, "mage");
  const elfLevel = getSynergyLevel(synergy.races, "elf");
  const healerCount = board
    ? countPlacedHealers(board)
    : synergy.lines.filter((line) => line.job === "healer").length * 3;

  const attack = calculateWarriorDamage(playerStats.attack, warriorLevel);
  const defense = calculateTankDefense(playerStats.defense, tankLevel);
  const heal = calculateHealerRecovery(healerCount, healerLevel);
  const skillDamage = calculateMagePower(playerStats.mana, mageLevel);

  return {
    attack,
    defense,
    maxHp: playerStats.maxHp,
    heal,
    shield: 0,
    critChance: 0,
    damageReduction: 0,
    extraAttacks: getElfAttackCountBonus(elfLevel),
    skillDamage,
  };
};

export const calculateCombat = ({
  synergy,
  board,
  playerStats = defaultPlayerStats,
  playerHp,
  playerMaxHp,
  monsterHp,
  monsterAttack = 8,
}: {
  synergy: SynergyResult;
  board?: Board;
  playerStats?: PlayerStats;
  playerHp: number;
  playerMaxHp: number;
  monsterHp: number;
  monsterAttack?: number;
  critRoll?: number;
}): CombatResult => {
  const stats = calculateCombatStats(synergy, board, playerStats);
  const effectiveMaxHp = Math.max(playerMaxHp, stats.maxHp);
  const attacks = 1 + stats.extraAttacks;
  const playerDamage = Math.max(0, Math.floor((stats.attack + stats.skillDamage) * attacks));
  const monsterHpAfter = Math.max(0, monsterHp - playerDamage);
  const healing = stats.heal;
  const shieldGained = stats.shield;

  if (monsterHpAfter === 0) {
    return {
      playerStats: stats,
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

  const monsterDamage = Math.max(0, Math.floor(monsterAttack - stats.defense));
  const shieldAbsorbed = Math.min(shieldGained, monsterDamage);
  const hpDamage = monsterDamage - shieldAbsorbed;
  const hpAfterDefense = Math.max(0, playerHp + healing - hpDamage);
  const playerHpAfter = Math.min(effectiveMaxHp, hpAfterDefense);

  return {
    playerStats: stats,
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

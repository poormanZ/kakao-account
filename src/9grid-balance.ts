import type { Job, PlayerStats } from "./9grid";

export const INITIAL_PLAYER_STATS: PlayerStats = {
  attack: 2,
  defense: 2,
  maxHp: 80,
  mana: 1,
};

export const JOB_BASE_STAT_VALUES: Record<Job, number> = {
  warrior: 2,
  tank: 2,
  healer: 6,
  mage: 1,
};

export const MONSTER_MAX_HP_BY_ROUND = [
  100, 180, 300, 500, 800,
  1100, 1500, 2050, 2800, 3800,
] as const;

export const MONSTER_ATTACK_BY_ROUND = [
  10, 14, 18, 22, 26,
  30, 34, 38, 42, 46,
] as const;

export const getMonsterMaxHp = (round: number): number => {
  if (!Number.isInteger(round) || round < 1) throw new Error("Invalid round");
  const index = Math.min(round, MONSTER_MAX_HP_BY_ROUND.length) - 1;
  const last = MONSTER_MAX_HP_BY_ROUND[MONSTER_MAX_HP_BY_ROUND.length - 1];
  if (round <= MONSTER_MAX_HP_BY_ROUND.length) return MONSTER_MAX_HP_BY_ROUND[index];
  return Math.ceil(last * Math.pow(1.35, round - MONSTER_MAX_HP_BY_ROUND.length));
};

export const getMonsterAttack = (round: number): number => {
  if (!Number.isInteger(round) || round < 1) throw new Error("Invalid round");
  const index = Math.min(round, MONSTER_ATTACK_BY_ROUND.length) - 1;
  const last = MONSTER_ATTACK_BY_ROUND[MONSTER_ATTACK_BY_ROUND.length - 1];
  if (round <= MONSTER_ATTACK_BY_ROUND.length) return MONSTER_ATTACK_BY_ROUND[index];
  return last + (round - MONSTER_ATTACK_BY_ROUND.length) * 4;
};

export const getJobBaseStatValue = (job: Job): number => JOB_BASE_STAT_VALUES[job];

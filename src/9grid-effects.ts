import { MAX_SYNERGY_LEVEL } from "./9grid";

const clampSynergyLevel = (synergyLevel: number): number =>
  Math.min(MAX_SYNERGY_LEVEL, Math.max(0, synergyLevel));

export const calculateWarriorDamage = (attack: number, synergyLevel: number): number =>
  attack * (clampSynergyLevel(synergyLevel) + 1);

export const calculateTankDefense = (defense: number, synergyLevel: number): number =>
  defense * (clampSynergyLevel(synergyLevel) + 1);

export const calculateHealerRecovery = (healerCount: number, synergyLevel: number): number =>
  healerCount * (clampSynergyLevel(synergyLevel) + 1);

export const calculateMagePower = (mana: number, synergyLevel: number): number =>
  mana * (clampSynergyLevel(synergyLevel) + 1);

export const getGoblinRerollBonus = (synergyLevel: number): number =>
  clampSynergyLevel(synergyLevel);

export const getElfAttackCountBonus = (synergyLevel: number): number =>
  clampSynergyLevel(synergyLevel);

export const getDwarfPlacementStatBonus = (synergyLevel: number): number =>
  clampSynergyLevel(synergyLevel);

export const calculateDragonScore = (round: number, synergyLevel: number): number =>
  round * clampSynergyLevel(synergyLevel);

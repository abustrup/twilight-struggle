// ============================================================================
// coup.ts — Coup attempts (rule 6.3).
// ============================================================================

import type { GameState } from '../state/types';
import type { Side } from '../data/cards';
import { getCountry, canCoupInRegion } from '../data/map';
import { addInfluence, removeInfluence, influence } from '../core/control';
import { addMilOps, degradeDefcon, log } from '../core/effects';
import { RNG } from '../core/rng';
import { opponent } from '../core/effects';

export interface CoupInput {
  countryId: string;
  ops: number;
  side: Side;
  free?: boolean; // free coup (event): ignores DEFCON geography, but BG still drops DEFCON
}

export interface CoupResult {
  roll: number;
  total: number;
  success: boolean;
  removed: number;
  added: number;
  defconDropped: boolean;
}

export function canCoup(state: GameState, countryId: string, side: Side, free = false): boolean {
  const def = getCountry(countryId);
  const opp = opponent(side);
  // Need opposing influence in target (6.3.1), unless free coup from event
  if (!free && influence(state.countries[countryId], opp) <= 0) return false;
  // DEFCON geography (6.3, 8.1.5) unless free coup
  if (!free && !canCoupInRegion(state.defcon, def.region)) return false;
  return true;
}

export function performCoup(state: GameState, input: CoupInput): CoupResult {
  const def = getCountry(input.countryId);
  const rng = new RNG(state.rngState);
  const roll = rng.die();
  state.rngState = rng.getState();

  const total = roll + input.ops;
  const threshold = def.stability * 2;
  const success = total > threshold;

  let removed = 0;
  let added = 0;

  if (success) {
    const diff = total - threshold;
    const opp = opponent(input.side);
    const oppInf = influence(state.countries[input.countryId], opp);
    removed = Math.min(oppInf, diff);
    state.countries[input.countryId] = removeInfluence(state.countries[input.countryId], opp, diff).inf;
    const leftover = diff - removed;
    added = Math.max(0, leftover);
    if (added > 0) {
      state.countries[input.countryId] = addInfluence(state.countries[input.countryId], input.side, added);
    }
  }

  // DEFCON: battleground coup degrades 1 (6.3.4)
  let defconDropped = false;
  if (def.battleground) {
    defconDropped = degradeDefcon(state, 1);
  }

  // Mil ops: coups count (8.2). Free coups do NOT count (8.2.5).
  if (!input.free) addMilOps(state, input.side, input.ops);

  log(
    state,
    `${input.side} coup in ${def.name}: roll ${roll} + ${input.ops} ops = ${total} vs ${threshold} (${success ? 'success' : 'fail'})`,
    input.side,
    roll,
  );

  return { roll, total, success, removed, added, defconDropped };
}

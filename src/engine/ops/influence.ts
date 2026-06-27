// ============================================================================
// influence.ts — Influence placement (rule 6.1).
// ============================================================================

import type { GameState } from '../state/types';
import type { Side } from '../data/cards';
import { COUNTRIES } from '../data/map';
import { canPlaceInfluence, placementCost, isControlled } from '../core/control';
import { opponent } from '../core/effects';

export interface Placement {
  country: string;
  amount: number;
}

// Validate a full set of placements against a total ops budget and adjacency
// at action start. Returns the total cost or throws an error.
export function validatePlacements(
  state: GameState,
  side: Side,
  placements: Placement[],
  opsBudget: number,
  startInfluence: Record<string, { us: number; ussr: number }>,
): { cost: number } {
  let cost = 0;
  // work on a working copy of influence to handle cost re-pricing on control flip
  const working: Record<string, { us: number; ussr: number }> = {};
  for (const id of Object.keys(state.countries)) {
    working[id] = { ...state.countries[id] };
  }
  const enemy = opponent(side);
  for (const p of placements) {
    if (!COUNTRIES[p.country]) throw new Error(`Invalid country: ${p.country}`);
    if (!canPlaceInfluence(working, p.country, side, startInfluence)) {
      throw new Error(`Cannot place influence in ${p.country}: not adjacent to friendly influence`);
    }
    for (let i = 0; i < p.amount; i++) {
      const c = placementCost(p.country, working[p.country], side);
      cost += c;
      if (cost > opsBudget) throw new Error(`Exceeds ops budget (${cost} > ${opsBudget})`);
      if (side === 'US') working[p.country].us += 1;
      else working[p.country].ussr += 1;
    }
  }
  return { cost };
}

export function applyPlacements(
  state: GameState,
  side: Side,
  placements: Placement[],
): void {
  for (const p of placements) {
    if (side === 'US') state.countries[p.country].us += p.amount;
    else state.countries[p.country].ussr += p.amount;
  }
}

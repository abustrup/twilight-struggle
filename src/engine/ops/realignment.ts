// ============================================================================
// realignment.ts – Realignment rolls (rule 6.2).
// ============================================================================

import type { GameState } from '../state/types';
import type { Side } from '../data/cards';
import { getCountry, COUNTRIES, canCoupInRegion } from '../data/map';
import { influence, removeInfluence } from '../core/control';
import { RNG } from '../core/rng';
import { log, opponent } from '../core/effects';

export function canRealign(state: GameState, countryId: string, side: Side): boolean {
  const def = getCountry(countryId);
  // DEFCON geography applies to realignments too (8.1.5)
  if (!canCoupInRegion(state.defcon, def.region)) return false;
  return true;
}

export function realignmentModifiers(state: GameState, countryId: string, side: Side): number {
  const def = COUNTRIES[countryId];
  let mod = 0;
  const opp = opponent(side);
  // +1 per adjacent controlled country
  for (const n of def.adj) {
    if (!COUNTRIES[n]) continue;
    const ninf = state.countries[n];
    const ctrlUs = (side === 'US' ? ninf.us >= getCountry(n).stability && ninf.us - ninf.ussr >= getCountry(n).stability : ninf.ussr >= getCountry(n).stability && ninf.ussr - ninf.us >= getCountry(n).stability);
    if (ctrlUs) mod += 1;
  }
  // +1 if more influence in target
  if (influence(state.countries[countryId], side) > influence(state.countries[countryId], opp)) mod += 1;
  // +1 if superpower adjacent
  if (side === 'US' && def.adjUS) mod += 1;
  if (side === 'USSR' && def.adjUSSR) mod += 1;
  return mod;
}

export interface RealignResult {
  rollUs: number;
  rollUssr: number;
  diff: number;
  removed: number;
}

export function performRealign(state: GameState, countryId: string, side: Side): RealignResult {
  const rng = new RNG(state.rngState);
  const rollUsBase = rng.die();
  const rollUssrBase = rng.die();
  state.rngState = rng.getState();

  const usMod = realignmentModifiers(state, countryId, 'US');
  const ussrMod = realignmentModifiers(state, countryId, 'USSR');
  const rollUs = rollUsBase + usMod;
  const rollUssr = rollUssrBase + ussrMod;
  const diff = Math.abs(rollUs - rollUssr);

  let removed = 0;
  if (rollUs !== rollUssr) {
    const winner: Side = rollUs > rollUssr ? 'US' : 'USSR';
    const loser: Side = opponent(winner);
    removed = removeInfluence(state.countries[countryId], loser, diff).removed;
    const r = removeInfluence(state.countries[countryId], loser, diff);
    state.countries[countryId] = r.inf;
    removed = r.removed;
    log(state, `${side} realigned ${getCountry(countryId).name}: US ${rollUs} vs USSR ${rollUssr}, ${winner} removes ${removed}`, side);
  } else {
    log(state, `${side} realigned ${getCountry(countryId).name}: tie (${rollUs} vs ${rollUssr})`, side);
  }

  return { rollUs, rollUssr, diff, removed };
}

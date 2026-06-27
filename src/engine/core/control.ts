// ============================================================================
// control.ts — Influence control logic (rules 2.1.7, 6.1).
// ============================================================================

import type { Side } from '../data/cards';
import { COUNTRIES, getCountry } from '../data/map';

export type ControlStatus = 'US' | 'USSR' | 'none';

export function influence(state: { us: number; ussr: number }, side: Side): number {
  return side === 'US' ? state.us : state.ussr;
}

export function isControlled(countryId: string, inf: { us: number; ussr: number }, side: Side): boolean {
  const def = getCountry(countryId);
  const mine = side === 'US' ? inf.us : inf.ussr;
  const theirs = side === 'US' ? inf.ussr : inf.us;
  return mine >= def.stability && mine - theirs >= def.stability;
}

export function controller(countryId: string, inf: { us: number; ussr: number }): ControlStatus {
  if (isControlled(countryId, inf, 'US')) return 'US';
  if (isControlled(countryId, inf, 'USSR')) return 'USSR';
  return 'none';
}

export function sideControls(countryId: string, inf: { us: number; ussr: number }, side: Side): boolean {
  return controller(countryId, inf) === side;
}

// Cost to place 1 influence in a country (rule 6.1.2): 2 if enemy-controlled,
// 1 otherwise.
export function placementCost(countryId: string, inf: { us: number; ussr: number }, side: Side): number {
  const enemy: Side = side === 'US' ? 'USSR' : 'US';
  return isControlled(countryId, inf, enemy) ? 2 : 1;
}

// Adjacency used for influence placement (rule 6.1.1, 6.1.4):
// may place adjacent to friendly influence already present at action start,
// OR adjacent to own superpower.
export function canPlaceInfluence(
  state: Record<string, { us: number; ussr: number }>,
  countryId: string,
  side: Side,
  startInfluence: Record<string, { us: number; ussr: number }>,
): boolean {
  const def = COUNTRIES[countryId];
  if (!def) return false;
  // own superpower adjacency (6.1.4)
  if (side === 'US' && def.adjUS) return true;
  if (side === 'USSR' && def.adjUSSR) return true;
  // adjacency to friendly influence present at action start (6.1.1)
  for (const neighborId of def.adj) {
    const n = startInfluence[neighborId];
    if (n && influence(n, side) > 0) return true;
  }
  return false;
}

export function addInfluence(
  inf: { us: number; ussr: number },
  side: Side,
  amount: number,
): { us: number; ussr: number } {
  if (amount === 0) return inf;
  return side === 'US' ? { ...inf, us: inf.us + amount } : { ...inf, ussr: inf.ussr + amount };
}

// Remove influence from a side, never going below zero; returns amount removed.
export function removeInfluence(
  inf: { us: number; ussr: number },
  side: Side,
  amount: number,
): { inf: { us: number; ussr: number }; removed: number } {
  if (side === 'US') {
    const removed = Math.min(inf.us, amount);
    return { inf: { ...inf, us: inf.us - removed }, removed };
  }
  const removed = Math.min(inf.ussr, amount);
  return { inf: { ...inf, ussr: inf.ussr - removed }, removed };
}

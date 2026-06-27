// ============================================================================
// effects.ts — Small pure helpers shared by the reducer and events.
// ============================================================================

import type { GameState } from '../state/types';
import type { Side } from '../data/cards';
import { removeInfluence, addInfluence } from './control';

export function gainVP(state: GameState, side: Side, amount: number): void {
  // VP track: positive = US. "side gains N VP" moves marker N toward that side.
  if (amount === 0) return;
  if (side === 'US') state.vp += amount;
  else state.vp -= amount;
}

export function improveDefcon(state: GameState, amount: number): void {
  state.defcon = Math.min(5, state.defcon + amount);
}

// Degrade DEFCON. Returns true if DEFCON reached 1 (nuclear war) — caller must
// then end the game (rule 8.1.3): phasing player loses.
export function degradeDefcon(state: GameState, amount: number): boolean {
  state.defcon = Math.max(1, state.defcon - amount);
  return state.defcon === 1;
}

export function addMilOps(state: GameState, side: Side, amount: number): void {
  state.milOps[side] += amount;
}

export function setCountryInfluence(
  state: GameState,
  countryId: string,
  side: Side,
  amount: number,
): void {
  if (amount >= 0) {
    state.countries[countryId] = addInfluence(state.countries[countryId], side, amount);
  } else {
    const r = removeInfluence(state.countries[countryId], side, -amount);
    state.countries[countryId] = r.inf;
  }
}

export function removeCountryInfluence(
  state: GameState,
  countryId: string,
  side: Side,
  amount: number,
): number {
  const r = removeInfluence(state.countries[countryId], side, amount);
  state.countries[countryId] = r.inf;
  return r.removed;
}

export function opponent(side: Side): Side {
  return side === 'US' ? 'USSR' : 'US';
}

export function log(state: GameState, text: string, side?: Side, roll?: number): void {
  state.log.push({ text, side, roll, ts: state.log.length });
}

// Check auto-victory at ±20 (rule 10.3.1).
export function checkAutoVictory(state: GameState): void {
  if (state.over) return;
  if (state.vp >= 20) state.over = { winner: 'US', reason: 'Automatic Victory (20 VP)' };
  else if (state.vp <= -20) state.over = { winner: 'USSR', reason: 'Automatic Victory (20 VP)' };
}

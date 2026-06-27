// ============================================================================
// spacerace.ts — Space Race track (rule 6.4).
// ============================================================================

import type { GameState, SpaceBoxId } from '../state/types';
import type { Side } from '../data/cards';
import { RNG } from '../core/rng';
import { gainVP, log } from '../core/effects';

interface BoxDef {
  id: SpaceBoxId;
  name: string;
  cost: number; // min ops to attempt
  rollRange: [number, number]; // die values that succeed
  vpFirst?: number;
  vpSecond?: number;
  ability?: string;
}

// Space race boxes in order (rule 6.4.3 + 6.4.4)
const BOXES: BoxDef[] = [
  { id: 'satellite', name: 'Earth Satellite', cost: 2, rollRange: [3, 6], vpFirst: 2, vpSecond: 0 },
  { id: 'animal', name: 'Animal in Space', cost: 2, rollRange: [4, 6], vpFirst: 2, vpSecond: 0, ability: 'twoSpaceCards' },
  { id: 'maninspace', name: 'Man in Space', cost: 2, rollRange: [4, 6], vpFirst: 2, vpSecond: 0 },
  { id: 'manearthorbit', name: 'Man in Earth Orbit', cost: 3, rollRange: [3, 6], vpFirst: 2, vpSecond: 0, ability: 'headlinePeek' },
  { id: 'lunarorbit', name: 'Lunar Orbit', cost: 3, rollRange: [4, 6], vpFirst: 3, vpSecond: 1 },
  { id: 'eagle', name: 'Eagle/Bear has Landed', cost: 3, rollRange: [3, 6], vpFirst: 4, vpSecond: 2, ability: 'discardHeldCard' },
  { id: 'spacestation', name: 'Space Station', cost: 4, rollRange: [4, 6], vpFirst: 2, vpSecond: 0, ability: 'eightActionRounds' },
  { id: 'intersolar', name: 'Interplanetary / Shuttle', cost: 4, rollRange: [3, 6], vpFirst: 2, vpSecond: 0 },
];

export function boxIndex(id: SpaceBoxId): number {
  if (id === 'none') return -1;
  return BOXES.findIndex((b) => b.id === id);
}

export function canAttemptSpace(state: GameState, side: Side): boolean {
  const s = state.space[side];
  if (s.box === 'intersolar') return false; // final box (6.4.6)
  const max = s.abilities.has('twoSpaceCards') ? 2 : 1;
  return state.spaceThisTurn[side] < max;
}

export interface SpaceResult {
  roll: number;
  success: boolean;
  advanced: boolean;
}

export function attemptSpace(state: GameState, side: Side, ops: number): SpaceResult {
  const s = state.space[side];
  const idx = boxIndex(s.box);
  const target = BOXES[idx + 1];
  if (!target) return { roll: 0, success: false, advanced: false };
  if (ops < target.cost) return { roll: 0, success: false, advanced: false };

  const rng = new RNG(state.rngState);
  const roll = rng.die();
  state.rngState = rng.getState();
  state.spaceThisTurn[side] += 1;
  s.attemptsThisTurn += 1;

  const success = roll >= target.rollRange[0] && roll <= target.rollRange[1];
  if (success) {
    s.box = target.id;
    // VP: first vs second to reach
    const otherSide: Side = side === 'US' ? 'USSR' : 'US';
    const reachedFirst = boxIndex(state.space[otherSide].box) < idx + 1;
    const vp = reachedFirst ? target.vpFirst ?? 0 : target.vpSecond ?? 0;
    if (vp) gainVP(state, side, vp);
    if (target.ability && reachedFirst) s.abilities.add(target.ability);
  }
  log(state, `${side} Space Race attempt toward ${target.name}: roll ${roll} (${success ? 'success' : 'fail'})`, side, roll);
  return { roll, success, advanced: success };
}

export function boxName(id: SpaceBoxId): string {
  const b = BOXES.find((x) => x.id === id);
  return b ? b.name : 'Off Track';
}

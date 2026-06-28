import { describe, it, expect } from 'vitest';
import { createGame } from '../state/create';
import { reduce } from '../core/reducer';
import { botAction } from '../ai/bot';
import type { Side } from '../data/cards';
import type { GameState } from '../state/types';

// Autoplay a full game using two bots; assert it completes to gameOver.
function autoplay(seed: number, maxSteps = 4000): GameState {
  let state = createGame(seed);
  for (let i = 0; i < maxSteps; i++) {
    if (state.over) return state;
    const side = state.awaiting as Side | null;
    if (!side) break;
    const action = botAction(state, side);
    if (!action) {
      // nothing to do; nudge with ok or break
      break;
    }
    state = reduce(state, action);
  }
  return state;
}

describe('engine', () => {
  it('completes a full game to gameOver', () => {
    const end = autoplay(42);
    expect(end.over).not.toBeNull();
    expect(['US', 'USSR']).toContain(end.over!.winner);
  }, 30000);

  it('completes multiple seeds', () => {
    for (const seed of [1, 7, 99, 1234]) {
      const end = autoplay(seed);
      expect(end.over, `seed ${seed}`).not.toBeNull();
    }
  }, 60000);

  it('completes a broader seeded playthrough sweep', () => {
    const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
    for (const seed of seeds) {
      const end = autoplay(seed);
      expect(end.over, `seed ${seed}`).not.toBeNull();
      for (const [countryId, inf] of Object.entries(end.countries)) {
        expect(inf.us, `${seed} ${countryId} US influence`).toBeGreaterThanOrEqual(0);
        expect(inf.ussr, `${seed} ${countryId} USSR influence`).toBeGreaterThanOrEqual(0);
      }
      expect(Math.abs(end.vp), `seed ${seed} VP`).toBeLessThanOrEqual(20);
      expect(end.defcon, `seed ${seed} DEFCON low`).toBeGreaterThanOrEqual(1);
      expect(end.defcon, `seed ${seed} DEFCON high`).toBeLessThanOrEqual(5);
    }
  }, 60000);

  it('respects VP bounds and DEFCON range throughout', () => {
    const end = autoplay(5);
    expect(Math.abs(end.vp)).toBeLessThanOrEqual(20);
    expect(end.defcon).toBeGreaterThanOrEqual(1);
    expect(end.defcon).toBeLessThanOrEqual(5);
  });
});

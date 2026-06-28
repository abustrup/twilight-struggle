import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/state/create';
import { createSaveRecord, restoreSaveRecord } from './persistence';

describe('local save serialization', () => {
  it('round-trips game state without losing Set-backed space abilities', () => {
    const state = createGame(99);
    state.space.US.abilities.add('two-space-cards');
    state.space.USSR.abilities.add('headline-reveal');

    const save = createSaveRecord(state, 'vsAI', 'US');
    const restored = restoreSaveRecord(JSON.parse(JSON.stringify(save)));

    expect(restored.state.space.US.abilities.has('two-space-cards')).toBe(true);
    expect(restored.state.space.USSR.abilities.has('headline-reveal')).toBe(true);
    expect(restored.mode).toBe('vsAI');
    expect(restored.humanSide).toBe('US');
  });
});

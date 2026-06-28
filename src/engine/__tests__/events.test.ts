import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CHINA_CARD_ID, isScoring } from '../data/cards';
import { EVENTS, NO_EFFECT_EVENTS } from '../events';

describe('card event registry', () => {
  it('has a registered event path for every non-scoring card', () => {
    const missing = ALL_CARDS
      .filter((card) => card.id !== CHINA_CARD_ID)
      .filter((card) => !isScoring(card.id))
      .filter((card) => !EVENTS[card.impl] && !NO_EFFECT_EVENTS.has(card.impl))
      .map((card) => `${card.number} ${card.name} -> ${card.impl}`);

    expect(missing).toEqual([]);
  });

  it('keeps explicit no-effect cards narrow and auditable', () => {
    expect([...NO_EFFECT_EVENTS].sort()).toEqual([
      'noop',
    ]);
  });
});

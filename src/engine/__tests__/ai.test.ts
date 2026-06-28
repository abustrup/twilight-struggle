import { describe, expect, it } from 'vitest';
import { createGame } from '../state/create';
import { botAction } from '../ai/bot';
import { CHINA_CARD_ID } from '../data/cards';

describe('AI legal action generation', () => {
  it('plays The China Card when it has no hand cards but China is available', () => {
    const state = createGame(123);
    state.phase = 'actionRound';
    state.turn = 5;
    state.actionRound = 5;
    state.phasing = 'US';
    state.awaiting = 'US';
    state.pending = { kind: 'playCard', side: 'US' };
    state.hands.US = [];
    state.chinaCard = { holder: 'US', faceDown: false };

    expect(botAction(state, 'US')).toEqual({
      type: 'playCard',
      side: 'US',
      cardId: CHINA_CARD_ID,
      mode: 'ops',
    });
  });
});

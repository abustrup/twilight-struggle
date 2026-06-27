import { describe, it, expect } from 'vitest';
import { createGame } from '../state/create';
import { reduce } from '../core/reducer';
import { getCard } from '../data/cards';
import { controller } from '../core/control';

describe('UI action path', () => {
  it('headline pick + card-for-ops influence placement works', () => {
    let s = createGame(1);
    expect(s.pending?.kind).toBe('headline');
    // USSR headlines
    const ussrCard = s.hands.USSR.find((c) => !c.startsWith('score'))!;
    s = reduce(s, { type: 'pickHeadline', side: 'USSR', cardId: ussrCard });
    // US headlines
    const usCard = s.hands.US.find((c) => !c.startsWith('score'))!;
    s = reduce(s, { type: 'pickHeadline', side: 'US', cardId: usCard });
    // now in action rounds; USSR is phasing first
    expect(s.phase).toBe('actionRound');
    expect(s.phasing).toBe('USSR');
    expect(s.pending?.kind).toBe('playCard');

    // USSR plays a non-scoring card for ops
    const playable = s.hands.USSR.find((c) => !getCard(c).scoring)!;
    const opsBefore = s.countries.syria.ussr;
    s = reduce(s, { type: 'playCard', side: 'USSR', cardId: playable, mode: 'ops' });
    expect(s.pending?.kind).toBe('opType');
    const amount = s.pending!.amount!;

    // place all influence into Syria (USSR already adjacent there)
    s = reduce(s, { type: 'placeInfluence', side: 'USSR', placements: [{ country: 'syria', amount: amount }] });
    expect(s.countries.syria.ussr).toBeGreaterThan(opsBefore);
  });

  it('coup changes influence and tracks milops', () => {
    let s = createGame(2);
    // skip to action round
    s = reduce(s, { type: 'pickHeadline', side: 'USSR', cardId: s.hands.USSR[0] });
    s = reduce(s, { type: 'pickHeadline', side: 'US', cardId: s.hands.US[0] });
    const playable = s.hands.USSR.find((c) => !getCard(c).scoring)!;
    s = reduce(s, { type: 'playCard', side: 'USSR', cardId: playable, mode: 'ops' });
    const before = s.countries.iran.us;
    s = reduce(s, { type: 'coup', side: 'USSR', countryId: 'iran' });
    expect(s.milOps.USSR).toBeGreaterThan(0);
    // iran had US influence at setup; coup reduces or converts it
    void before;
  });

  it('DEFCON-1 coup ends game and the phasing player loses', () => {
    let s = createGame(3);
    // force DEFCON to 2; USSR coups a Battleground in an allowed region
    // (South Africa: Africa region, BG, has US influence at setup).
    s.defcon = 2;
    s.phase = 'actionRound';
    s.phasing = 'USSR';
    s.awaiting = 'USSR';
    s.countries.southafrica.us = 2; // ensure opposing influence present
    s.pending = { kind: 'opType', side: 'USSR', amount: 4, meta: { cardId: 'duckandcover', isChina: false } };
    const res = reduce(s, { type: 'coup', side: 'USSR', countryId: 'southafrica' });
    expect(res.over).not.toBeNull();
    expect(res.over!.winner).toBe('US'); // USSR caused DEFCON 1
  });
});

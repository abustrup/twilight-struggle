import { describe, expect, it } from 'vitest';
import { createGame } from '../state/create';
import { reduce } from '../core/reducer';
import { CHINA_CARD_ID } from '../data/cards';
import { scoreRegion, scoreSoutheastAsia } from '../scoring/scoring';
import { EVENTS } from '../events';
import { attemptSpace } from '../ops/spacerace';

describe('core rule fidelity', () => {
  it('blocks The China Card when playing it would leave a scoring card held', () => {
    let state = createGame(10);
    state.phase = 'actionRound';
    state.turn = 1;
    state.actionRound = 6;
    state.phasing = 'USSR';
    state.awaiting = 'USSR';
    state.pending = { kind: 'playCard', side: 'USSR' };
    state.hands.USSR = ['asiascoring'];
    state.chinaCard = { holder: 'USSR', faceDown: false };

    state = reduce(state, { type: 'playCard', side: 'USSR', cardId: CHINA_CARD_ID, mode: 'ops' });

    expect(state.pending?.kind).toBe('playCard');
    expect(state.chinaCard.holder).toBe('USSR');
    expect(state.log.at(-1)?.text).toContain('China Card cannot be played');
  });

  it('gives The China Card a fifth operation when all operations are spent in Asia', () => {
    let state = createGame(11);
    state.phase = 'actionRound';
    state.turn = 1;
    state.actionRound = 1;
    state.phasing = 'US';
    state.awaiting = 'US';
    state.pending = { kind: 'playCard', side: 'US' };
    state.chinaCard = { holder: 'US', faceDown: false };
    state.countries.japan.us = 4;

    state = reduce(state, { type: 'playCard', side: 'US', cardId: CHINA_CARD_ID, mode: 'ops' });
    expect(state.pending?.amount).toBe(5);

    state = reduce(state, { type: 'placeInfluence', side: 'US', placements: [{ country: 'japan', amount: 5 }] });

    expect(state.countries.japan.us).toBe(9);
    expect(state.chinaCard).toEqual({ holder: 'USSR', faceDown: true });
  });

  it('lets Defectors cancel the USSR headline event', () => {
    let state = createGame(12);
    state.hands.US = ['defectors'];
    state.hands.USSR = ['duckandcover'];
    state.defcon = 5;
    state.vp = 0;

    state = reduce(state, { type: 'pickHeadline', side: 'USSR', cardId: 'duckandcover' });
    state = reduce(state, { type: 'pickHeadline', side: 'US', cardId: 'defectors' });

    expect(state.defcon).toBe(5);
    expect(state.vp).toBe(0);
    expect(state.decks.discard).toContain('duckandcover');
  });

  it('discards resolved non-starred headline cards', () => {
    let state = createGame(13);
    state.hands.US = ['duckandcover'];
    state.hands.USSR = ['olympicgames'];

    state = reduce(state, { type: 'pickHeadline', side: 'USSR', cardId: 'olympicgames' });
    state = reduce(state, { type: 'pickHeadline', side: 'US', cardId: 'duckandcover' });

    expect(state.decks.discard).toContain('duckandcover');
    expect(state.decks.discard).toContain('olympicgames');
  });

  it('removes starred headline events from the game', () => {
    let state = createGame(14);
    state.hands.US = ['capturednazi'];
    state.hands.USSR = ['romanianabdication'];

    state = reduce(state, { type: 'pickHeadline', side: 'USSR', cardId: 'romanianabdication' });
    state = reduce(state, { type: 'pickHeadline', side: 'US', cardId: 'capturednazi' });

    expect(state.decks.removed).toContain('capturednazi');
    expect(state.decks.removed).toContain('romanianabdication');
  });

  it('uses the correct 5 VP domination value for South America scoring', () => {
    const state = createGame(15);
    for (const inf of Object.values(state.countries)) {
      inf.us = 0;
      inf.ussr = 0;
    }
    state.countries.venezuela.us = 2;
    state.countries.colombia.us = 1;

    const scored = scoreRegion(state, 'SouthAmerica');

    expect(scored.usLevel).toBe('domination');
    expect(scored.usRaw).toBe(6);
  });

  it('scores Southeast Asia as one VP per listed country and two for Thailand', () => {
    const state = createGame(16);
    for (const inf of Object.values(state.countries)) {
      inf.us = 0;
      inf.ussr = 0;
    }
    state.countries.malaysia.us = 2;
    state.countries.indonesia.us = 1;
    state.countries.vietnam.ussr = 1;
    state.countries.thailand.ussr = 2;

    expect(scoreSoutheastAsia(state)).toBe(-1);
  });

  it('war events do not add influence when no opponent influence is at risk', () => {
    const state = createGame(17);
    for (const inf of Object.values(state.countries)) {
      inf.us = 0;
      inf.ussr = 0;
    }
    state.rngState = 1;

    EVENTS.koreanwar(state, 'USSR');

    expect(state.vp).toBe(-2);
    expect(state.milOps.USSR).toBe(2);
    expect(state.countries.skorea).toEqual({ us: 0, ussr: 0 });
  });

  it('Nuclear Test Ban scores from DEFCON before improving it', () => {
    const state = createGame(18);
    state.defcon = 3;
    state.vp = 0;

    EVENTS.nucleartestban(state, 'US');

    expect(state.vp).toBe(1);
    expect(state.defcon).toBe(5);
  });

  it('Arms Race compares Military Operations, not Space Race progress', () => {
    const state = createGame(19);
    state.defcon = 3;
    state.vp = 0;
    state.milOps.US = 3;
    state.milOps.USSR = 1;
    state.space.US.box = 'none';
    state.space.USSR.box = 'spacestation';

    EVENTS.armsrace(state, 'US');

    expect(state.vp).toBe(3);
  });

  it('How I Learned to Stop Worrying sets DEFCON and adds 5 Military Ops without VP', () => {
    const state = createGame(20);
    state.defcon = 3;
    state.vp = 0;
    state.milOps.US = 0;

    EVENTS.worrying(state, 'US');

    expect(state.defcon).toBe(5);
    expect(state.milOps.US).toBe(5);
    expect(state.vp).toBe(0);
  });

  it('Nasser removes half rounded up of US influence in Egypt', () => {
    const state = createGame(21);
    state.countries.egypt = { us: 5, ussr: 0 };

    EVENTS.nasser(state, 'USSR');

    expect(state.countries.egypt).toEqual({ us: 2, ussr: 2 });
  });

  it('Sadat removes all USSR influence from Egypt', () => {
    const state = createGame(22);
    state.countries.egypt = { us: 0, ussr: 5 };

    EVENTS.sadatexpels(state, 'US');

    expect(state.countries.egypt).toEqual({ us: 1, ussr: 0 });
  });

  it('Suez Crisis removes a total of 4 US influence, maximum 2 per listed country', () => {
    const state = createGame(23);
    state.countries.france.us = 4;
    state.countries.uk.us = 4;
    state.countries.israel.us = 4;

    EVENTS.suezcrisis(state, 'USSR');

    const removed =
      (4 - state.countries.france.us) +
      (4 - state.countries.uk.us) +
      (4 - state.countries.israel.us);
    expect(removed).toBe(4);
    expect(4 - state.countries.france.us).toBeLessThanOrEqual(2);
    expect(4 - state.countries.uk.us).toBeLessThanOrEqual(2);
    expect(4 - state.countries.israel.us).toBeLessThanOrEqual(2);
  });

  it('Voice of America removes no more than 4 USSR influence outside Europe', () => {
    const state = createGame(24);
    for (const inf of Object.values(state.countries)) {
      inf.us = 0;
      inf.ussr = 0;
    }
    for (const id of ['iran', 'iraq', 'egypt', 'libya']) {
      state.countries[id].ussr = 2;
    }

    EVENTS.voiceofamerica(state, 'US');

    const remaining = ['iran', 'iraq', 'egypt', 'libya'].reduce((sum, id) => sum + state.countries[id].ussr, 0);
    expect(remaining).toBe(4);
  });

  it('blocks Space Race attempts when the card Ops are below the target box cost', () => {
    let state = createGame(25);
    state.phase = 'actionRound';
    state.turn = 4;
    state.actionRound = 1;
    state.phasing = 'US';
    state.awaiting = 'US';
    state.hands.US = ['socialistgovs'];
    state.space.US.box = 'maninspace';
    state.pending = { kind: 'opType', side: 'US', amount: 2, meta: { cardId: 'socialistgovs' } };

    state = reduce(state, { type: 'space', side: 'US' });

    expect(state.pending?.kind).toBe('opType');
    expect(state.space.US.box).toBe('maninspace');
    expect(state.spaceThisTurn.US).toBe(0);
    expect(state.hands.US).toContain('socialistgovs');
  });

  it('cancels a Space Race special ability when the second player reaches that box', () => {
    const state = createGame(26);
    state.space.US.box = 'animal';
    state.space.US.abilities.add('twoSpaceCards');
    state.space.USSR.box = 'satellite';
    state.rngState = 1;

    attemptSpace(state, 'USSR', 2);

    expect(state.space.USSR.box).toBe('animal');
    expect(state.space.US.abilities.has('twoSpaceCards')).toBe(false);
    expect(state.space.USSR.abilities.has('twoSpaceCards')).toBe(false);
  });
});

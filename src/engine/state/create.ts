// ============================================================================
// create.ts – Build the initial GameState and run automated setup.
// ============================================================================

import type { GameState, GameOptions } from './types';
import { RNG } from '../core/rng';
import { CARDS, CHINA_CARD_ID } from '../data/cards';
import { COUNTRY_IDS } from '../data/map';
import {
  USSR_FIXED_SETUP,
  US_FIXED_SETUP,
  USSR_DEFAULT_FLEX,
  US_DEFAULT_FLEX,
} from '../data/setup';

export function createGame(seed = Date.now(), options: GameOptions = {
  chineseCivilWar: false,
  optionalCards: false,
}): GameState {
  const rng = new RNG(seed);
  const early = CARDS.filter((c) => c.war === 'Early' && !c.scoring);
  const scoring = CARDS.filter((c) => c.war === 'Early' && c.scoring);
  const mid = CARDS.filter((c) => c.war === 'Mid');
  const late = CARDS.filter((c) => c.war === 'Late');

  const earlyIds = early.map((c) => c.id);
  const scoringIds = scoring.map((c) => c.id);
  const shuffled = rng.shuffle([...earlyIds, ...scoringIds]);

  const countries: GameState['countries'] = {};
  for (const id of COUNTRY_IDS) countries[id] = { us: 0, ussr: 0 };

  for (const e of [...USSR_FIXED_SETUP, ...USSR_DEFAULT_FLEX]) {
    countries[e.country][e.side === 'US' ? 'us' : 'ussr'] += e.amount;
  }
  for (const e of [...US_FIXED_SETUP, ...US_DEFAULT_FLEX]) {
    countries[e.country][e.side === 'US' ? 'us' : 'ussr'] += e.amount;
  }

  const state: GameState = {
    turn: 1,
    phase: 'headlinePick',
    actionRound: 1,
    phasing: 'USSR',
    defcon: 5,
    vp: 0,
    milOps: { US: 0, USSR: 0 },
    space: {
      US: { box: 'none', attemptsThisTurn: 0, abilities: new Set() },
      USSR: { box: 'none', attemptsThisTurn: 0, abilities: new Set() },
    },
    chinaCard: { holder: 'USSR', faceDown: false },
    countries,
    decks: {
      draw: shuffled,
      discard: [],
      removed: [],
      pendingMid: mid.map((c) => c.id),
      pendingLate: late.map((c) => c.id),
    },
    hands: { US: [], USSR: [] },
    headline: { US: null, USSR: null, orderResolved: [] },
    events: [],
    opMod: { US: 0, USSR: 0 },
    spaceThisTurn: { US: 0, USSR: 0 },
    pending: { kind: 'headline', side: 'USSR', description: 'Choose your headline card' },
    awaiting: 'USSR',
    log: [],
    rngState: rng.getState(),
    over: null,
    firstActionRoundResolved: { US: false, USSR: false },
    options,
  };

  dealCards(state);
  return state;
}

// Deal to hand size (8 in early war). USSR is dealt first (tournament 11.1.3).
export function dealCards(state: GameState): void {
  const size = state.turn <= 3 ? 8 : 9;
  const order: ('US' | 'USSR')[] = state.turn === 1 ? ['USSR', 'US'] : ['USSR', 'US'];
  for (let i = 0; i < size; i++) {
    for (const side of order) {
      while (state.hands[side].length < size) {
        if (state.decks.draw.length === 0) reshuffleDiscard(state);
        if (state.decks.draw.length === 0) return; // exhausted
        const card = state.decks.draw.pop()!;
        state.hands[side].push(card);
      }
    }
  }
  // truncate to size
  state.hands.US = state.hands.US.slice(0, size);
  state.hands.USSR = state.hands.USSR.slice(0, size);
}

export function reshuffleDiscard(state: GameState): void {
  if (state.decks.discard.length === 0) return;
  const rng = new RNG(state.rngState);
  const reshuffled = rng.shuffle(state.decks.discard);
  state.decks.draw = reshuffled;
  state.decks.discard = [];
  state.rngState = rng.getState();
}

// Merge the mid/late war piles into the draw deck at the appropriate turn end.
export function mergeWarDeck(state: GameState, war: 'Mid' | 'Late'): void {
  const pile = war === 'Mid' ? state.decks.pendingMid : state.decks.pendingLate;
  if (war === 'Mid') state.decks.pendingMid = [];
  else state.decks.pendingLate = [];
  const rng = new RNG(state.rngState);
  state.decks.draw = rng.shuffle([...state.decks.draw, ...pile]);
  state.rngState = rng.getState();
}

export { CHINA_CARD_ID };

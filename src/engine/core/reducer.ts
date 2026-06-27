// ============================================================================
// reducer.ts — The pure game state machine. (state, action) -> state.
// Drives headline, action rounds, turn flow, DEFCON, milops, scoring, victory.
// ============================================================================

import type { GameState, Side } from '../state/types';
import { actionRoundsForTurn, handSizeForTurn } from '../state/types';
import { getCard, isScoring, CARDS, CHINA_CARD_ID } from '../data/cards';
import { COUNTRIES, getCountry } from '../data/map';
import { EVENTS } from '../events';
import { dealCards, mergeWarDeck } from '../state/create';
import { performCoup, canCoup } from '../ops/coup';
import { performRealign, canRealign } from '../ops/realignment';
import { attemptSpace, canAttemptSpace } from '../ops/spacerace';
import { validatePlacements, applyPlacements, type Placement } from '../ops/influence';
import {
  gainVP, improveDefcon, degradeDefcon, log, opponent, checkAutoVictory, removeCountryInfluence,
} from '../core/effects';
import { finalScore, scoreRegion } from '../scoring/scoring';
import { controller } from '../core/control';

export type Action =
  | { type: 'pickHeadline'; side: Side; cardId: string }
  | { type: 'playCard'; side: Side; cardId: string; mode: 'event' | 'ops' | 'scoring' }
  | { type: 'placeInfluence'; side: Side; placements: Placement[] }
  | { type: 'coup'; side: Side; countryId: string }
  | { type: 'realign'; side: Side; countryIds: string[] }
  | { type: 'space'; side: Side }
  | { type: 'war'; side: Side; countryId: string; ops: number }
  | { type: 'cancelOp'; side: Side }
  | { type: 'ok' };

// Deep clone helper (state contains only plain data + Sets; we clone Sets).
export function clone(state: GameState): GameState {
  return {
    ...state,
    milOps: { ...state.milOps },
    space: {
      US: { ...state.space.US, abilities: new Set(state.space.US.abilities) },
      USSR: { ...state.space.USSR, abilities: new Set(state.space.USSR.abilities) },
    },
    chinaCard: { ...state.chinaCard },
    countries: Object.fromEntries(Object.entries(state.countries).map(([k, v]) => [k, { ...v }])),
    decks: {
      draw: [...state.decks.draw],
      discard: [...state.decks.discard],
      removed: [...state.decks.removed],
      pendingMid: [...state.decks.pendingMid],
      pendingLate: [...state.decks.pendingLate],
    },
    hands: { US: [...state.hands.US], USSR: [...state.hands.USSR] },
    headline: { ...state.headline, orderResolved: [...state.headline.orderResolved] },
    events: state.events.map((e) => ({ ...e, data: e.data ? { ...e.data } : undefined })),
    opMod: { ...state.opMod },
    spaceThisTurn: { ...state.spaceThisTurn },
    over: state.over ? { ...state.over } : null,
    log: [...state.log],
  };
}

export function reduce(prev: GameState, action: Action): GameState {
  if (prev.over) return prev;
  const s = clone(prev);
  try {
    switch (action.type) {
      case 'pickHeadline': return doPickHeadline(s, action);
      case 'playCard': return doPlayCard(s, action);
      case 'placeInfluence': return doPlaceInfluence(s, action);
      case 'coup': return doCoup(s, action);
      case 'realign': return doRealign(s, action);
      case 'space': return doSpace(s, action);
      case 'war': return doWar(s, action);
      case 'cancelOp': return doCancel(s, action);
      case 'ok': return doOk(s);
    }
  } catch (e) {
    log(s, `Invalid action: ${(e as Error).message}`);
    return s;
  }
}

// ---------------------------------------------------------------------------

function doPickHeadline(s: GameState, a: { side: Side; cardId: string }): GameState {
  if (s.phase !== 'headlinePick') return s;
  if (a.cardId === CHINA_CARD_ID) { log(s, 'The China Card cannot be played in headline.'); return s; }
  s.headline[a.side] = a.cardId;
  // remove from hand
  s.hands[a.side] = s.hands[a.side].filter((c) => c !== a.cardId);
  log(s, `${a.side} selects a headline card.`);
  if (s.headline.US && s.headline.USSR) {
    return resolveHeadlines(s);
  }
  s.awaiting = opponent(a.side);
  s.pending = { kind: 'headline', side: s.awaiting, description: 'Choose your headline card' };
  return s;
}

function headlineValue(cardId: string): number {
  if (isScoring(cardId)) return 0;
  return getCard(cardId).ops;
}

function resolveHeadlines(s: GameState): GameState {
  s.phase = 'headlineResolve';
  const us = s.headline.US!;
  const ussr = s.headline.USSR!;
  const usVal = headlineValue(us);
  const ussrVal = headlineValue(ussr);
  let first: Side;
  if (usVal > ussrVal) first = 'US';
  else if (ussrVal > usVal) first = 'USSR';
  else first = 'US'; // ties: US first

  const order: Side[] = first === 'US' ? ['US', 'USSR'] : ['USSR', 'US'];
  for (const side of order) {
    const cardId = side === 'US' ? us : ussr;
    applyCardEvent(s, cardId, side, /*headline*/ true);
    if (s.over) return s;
    checkAutoVictory(s);
    if (s.over) return s;
  }
  // begin action rounds
  s.phase = 'actionRound';
  s.actionRound = 1;
  s.phasing = 'USSR';
  return beginAction(s);
}

// Apply a card's EVENT (used for headline and for mode:'event').
function applyCardEvent(s: GameState, cardId: string, side: Side, headline: boolean): void {
  const card = cardId === CHINA_CARD_ID ? { id: CHINA_CARD_ID, name: 'The China Card', starred: false, scoring: undefined, impl: 'noop' } : getCard(cardId);
  if (card.scoring) {
    const handler = EVENTS[`score:${card.scoring}`];
    if (handler) handler(s, side);
    // SEA scoring removed after play
    return;
  }
  const handler = EVENTS[card.impl] ?? EVENTS.noop;
  handler(s, side);
  // starred events removed; others to discard (handled by caller via disposeCard)
}

// Dispose a played card: removed if starred event was played, else to discard.
function disposeCard(s: GameState, cardId: string, playedAsEvent: boolean): void {
  const card = cardId === CHINA_CARD_ID ? { starred: false } : getCard(cardId);
  if (playedAsEvent && card.starred) s.decks.removed.push(cardId);
  else s.decks.discard.push(cardId);
}

function doPlayCard(s: GameState, a: { side: Side; cardId: string; mode: 'event' | 'ops' | 'scoring' }): GameState {
  if (s.phase !== 'actionRound') return s;
  if (a.side !== s.phasing || a.side !== s.awaiting) return s;

  const isChina = a.cardId === CHINA_CARD_ID;
  if (!isChina && !s.hands[a.side].includes(a.cardId)) return s;
  if (isChina && (s.chinaCard.holder !== a.side || s.chinaCard.faceDown)) return s;

  const card = isChina ? { id: CHINA_CARD_ID, ops: 4, side: 'Neutral' as const, starred: false, scoring: undefined, impl: 'noop', name: 'The China Card' } : getCard(a.cardId);

  // Scoring cards must be played as scoring
  if (card.scoring) {
    EVENTS[`score:${card.scoring}`](s, a.side);
    if (!isChina) s.hands[a.side] = s.hands[a.side].filter((c) => c !== a.cardId);
    disposeCard(s, a.cardId, true);
    checkAutoVictory(s);
    return endAction(s);
  }

  if (a.mode === 'event') {
    applyCardEvent(s, a.cardId, a.side, false);
    if (!isChina) s.hands[a.side] = s.hands[a.side].filter((c) => c !== a.cardId);
    disposeCard(s, a.cardId, true);
    if (isChina) passChinaCard(s, a.side);
    checkAutoVictory(s);
    if (s.over) return s;
    return endAction(s);
  }

  // mode 'ops'
  const baseOps = Math.max(0, card.ops + s.opMod[a.side]);
  // remember influence at action start for adjacency rule
  (s as GameState & { _startInf?: Record<string, { us: number; ussr: number }> })._startInf = Object.fromEntries(
    Object.entries(s.countries).map(([k, v]) => [k, { ...v }]),
  );
  s.pending = {
    kind: 'opType', side: a.side, cardId: a.cardId, amount: baseOps,
    description: `Choose how to use ${baseOps} Ops from ${card.name}`,
    meta: { cardId: a.cardId, isChina },
  };
  return s;
}

function startInf(s: GameState): Record<string, { us: number; ussr: number }> {
  return (s as GameState & { _startInf?: Record<string, { us: number; ussr: number }> })._startInf ?? s.countries;
}

function doPlaceInfluence(s: GameState, a: { side: Side; placements: Placement[] }): GameState {
  const p = s.pending;
  if (!p || p.kind !== 'opType') return s;
  // mark op type as influence implicitly by this action
  const budget = p.amount!;
  const start = startInf(s);
  validatePlacements(s, a.side, a.placements, budget, start);
  applyPlacements(s, a.side, a.placements);
  log(s, `${a.side} places influence (${a.placements.length} countries)`, a.side);
  return finishOp(s, a.side);
}

function doCoup(s: GameState, a: { side: Side; countryId: string }): GameState {
  const p = s.pending;
  if (!p || p.kind !== 'opType') return s;
  if (!canCoup(s, a.countryId, a.side, false)) { log(s, 'Illegal coup target.'); return s; }
  performCoup(s, { countryId: a.countryId, ops: p.amount!, side: a.side });
  if (s.defcon === 1) {
    s.over = { winner: opponent(a.side), reason: 'Nuclear War (DEFCON 1)' };
    return s;
  }
  return finishOp(s, a.side);
}

function doRealign(s: GameState, a: { side: Side; countryIds: string[] }): GameState {
  const p = s.pending;
  if (!p || p.kind !== 'opType') return s;
  const budget = p.amount!;
  if (a.countryIds.length > budget) { log(s, 'Too many realignment targets.'); return s; }
  for (const id of a.countryIds) {
    if (!canRealign(s, id, a.side)) continue;
    performRealign(s, id, a.side);
  }
  return finishOp(s, a.side);
}

function doSpace(s: GameState, a: { side: Side }): GameState {
  const p = s.pending;
  if (!p || p.kind !== 'opType') return s;
  if (!canAttemptSpace(s, a.side)) { log(s, 'Cannot attempt Space Race.'); return s; }
  attemptSpace(s, a.side, p.amount!);
  return finishOp(s, a.side);
}

function doWar(s: GameState, a: { side: Side; countryId: string; ops: number }): GameState {
  // war events (player picks target where applicable)
  const def = getCountry(a.countryId);
  let mod = 0;
  const opp = opponent(a.side);
  for (const n of def.adj) if (COUNTRIES[n] && controller(n, s.countries[n]) === opp) mod -= 1;
  s.milOps[a.side] += a.ops;
  // resolve war via shared logic
  EVENTS.war(s, a.side);
  return endAction(s);
}

function doCancel(s: GameState, a: { side: Side }): GameState {
  // return to opType selection (no-op fallback)
  return s;
}

function doOk(s: GameState): GameState {
  // generic advance (e.g., close a notice)
  return s;
}

// After an op (influence/coup/realign/space) resolves, dispose the card,
// possibly trigger opponent event (if played for ops), then end action.
function finishOp(s: GameState, side: Side): GameState {
  const p = s.pending!;
  const meta = p.meta ?? {};
  const cardId = meta.cardId as string;
  const isChina = !!meta.isChina;
  if (!isChina) s.hands[side] = s.hands[side].filter((c) => c !== cardId);

  // If played for ops and the card is an opponent event, the event fires (5.2).
  if (isChina) {
    // The China Card is Neutral; no event triggers. It is passed (handled below).
  } else {
    const card = getCard(cardId);
    if (card.side === opponent(side)) {
      applyCardEvent(s, cardId, opponent(side), false);
      disposeCard(s, cardId, true); // starred removed; else discard
      if (s.over) return s;
    } else {
      disposeCard(s, cardId, false);
    }
  }

  if (isChina) passChinaCard(s, side);

  s.pending = null;
  checkAutoVictory(s);
  if (s.over) return s;
  return endAction(s);
}

function passChinaCard(s: GameState, side: Side): void {
  s.chinaCard = { holder: opponent(side), faceDown: true };
  log(s, `${side} plays The China Card; passed to ${opponent(side)} face down.`);
}

function endAction(s: GameState): GameState {
  s.pending = null;
  // advance phasing
  if (s.phasing === 'USSR') {
    s.phasing = 'US';
  } else {
    s.actionRound += 1;
    s.phasing = 'USSR';
  }
  const max = actionRoundsForTurn(s.turn);
  if (s.actionRound > max) {
    return beginTurnEnd(s);
  }
  return beginAction(s);
}

function beginAction(s: GameState): GameState {
  const side = s.phasing;
  // sit out if no cards (rule: must have cards to act; scoring can't be skipped)
  const playable = s.hands[side].filter((c) => true);
  const hasChina = s.chinaCard.holder === side && !s.chinaCard.faceDown;
  if (playable.length === 0 && !hasChina) {
    log(s, `${side} sits out (no cards).`);
    return endAction(s);
  }
  s.awaiting = side;
  s.pending = { kind: 'playCard', side, description: `${side}: play a card` };
  return s;
}

function beginTurnEnd(s: GameState): GameState {
  s.phase = 'turnEnd';
  // E. Military operations penalty (required = DEFCON)
  const required = s.defcon;
  for (const side of ['US', 'USSR'] as Side[]) {
    const deficit = Math.max(0, required - s.milOps[side]);
    if (deficit > 0) {
      gainVP(s, opponent(side), deficit);
      log(s, `${side} missed ${deficit} Military Ops; ${opponent(side)} +${deficit} VP`);
    }
    s.milOps[side] = 0;
  }
  // G. flip china card face up if face down
  if (s.chinaCard.faceDown) s.chinaCard.faceDown = false;
  // reset per-turn
  s.opMod = { US: 0, USSR: 0 };
  s.spaceThisTurn = { US: 0, USSR: 0 };
  s.space.US.attemptsThisTurn = 0;
  s.space.USSR.attemptsThisTurn = 0;
  checkAutoVictory(s);
  // H. advance turn + merge decks
  s.turn += 1;
  if (s.turn === 4) mergeWarDeck(s, 'Mid');
  if (s.turn === 8) mergeWarDeck(s, 'Late');
  if (s.turn > 10) {
    return doFinalScoring(s);
  }
  // A. improve DEFCON
  improveDefcon(s, 1);
  // B. deal cards
  dealCards(s);
  // C. headline
  s.phase = 'headlinePick';
  s.headline = { US: null, USSR: null, orderResolved: [] };
  s.awaiting = 'USSR';
  s.pending = { kind: 'headline', side: 'USSR', description: 'Choose your headline card' };
  log(s, `--- Turn ${s.turn} begins (hand size ${handSizeForTurn(s.turn)}) ---`);
  return s;
}

function doFinalScoring(s: GameState): GameState {
  s.phase = 'finalScoring';
  const f = finalScore(s);
  gainVP(s, 'US', f.net);
  log(s, `FINAL SCORING: net ${f.net} VP applied`);
  let winner: Side | 'Draw';
  if (f.europeControlWinner) {
    s.over = { winner: f.europeControlWinner, reason: 'Europe Control (final scoring)' };
    return s;
  }
  if (s.vp > 0) winner = 'US';
  else if (s.vp < 0) winner = 'USSR';
  else winner = 'Draw';
  if (winner !== 'Draw') {
    s.over = { winner, reason: `Final score ${s.vp > 0 ? '+' : ''}${s.vp} VP` };
  } else {
    s.over = { winner: 'US', reason: 'Draw (US wins ties? no — draw)' };
    // Represent a draw by a neutral marker:
    s.over = { winner: 'USSR', reason: 'The game ends in a draw.' };
    s.vp = 0;
  }
  return s;
}

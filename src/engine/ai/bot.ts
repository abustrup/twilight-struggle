// ============================================================================
// bot.ts — Heuristic bot. Given a state with a pending choice for the bot's
// side, returns a legal Action. Used for vs-AI and for the autoplay test.
// ============================================================================

import type { GameState, PendingChoice } from '../state/types';
import type { Side } from '../data/cards';
import { getCard, isScoring, CHINA_CARD_ID } from '../data/cards';
import { COUNTRIES, countriesInRegion, canCoupInRegion } from '../data/map';
import type { Action } from '../core/reducer';
import { canCoup } from '../ops/coup';
import { canRealign } from '../ops/realignment';
import { canAttemptSpace } from '../ops/spacerace';
import { canPlaceInfluence, controller } from '../core/control';
import { opponent } from '../core/effects';
import type { Placement } from '../ops/influence';

export interface BotOptions {
  randomness: number; // 0..1
}

// Snapshot of influence at action start is stashed on state by the reducer.
function startInf(s: GameState): Record<string, { us: number; ussr: number }> {
  return (s as GameState & { _startInf?: Record<string, { us: number; ussr: number }> })._startInf ?? s.countries;
}

export function botAction(state: GameState, side: Side, _opts: BotOptions = { randomness: 0.2 }): Action | null {
  const p = state.pending;
  if (!p) return null;
  if (state.awaiting !== side) return null;

  switch (p.kind) {
    case 'headline':
      return chooseHeadline(state, side);
    case 'playCard':
      return chooseCard(state, side);
    case 'opType':
      return chooseOp(state, side, p);
    default:
      return null;
  }
}

function chooseHeadline(state: GameState, side: Side): Action {
  const hand = state.hands[side];
  // prefer own-side starred/high-ops events; avoid opponent events if possible
  const ranked = [...hand].sort((a, b) => scoreCardForHeadline(state, b, side) - scoreCardForHeadline(state, a, side));
  return { type: 'pickHeadline', side, cardId: ranked[0] };
}

function scoreCardForHeadline(state: GameState, cardId: string, side: Side): number {
  const c = getCard(cardId);
  if (isScoring(cardId)) return -5; // avoid headlining scoring
  let s = c.ops;
  if (c.side === side) s += 5;
  if (c.side === opponent(side)) s -= 10;
  if (c.starred) s += 1;
  return s;
}

function chooseCard(state: GameState, side: Side): Action {
  const hand = state.hands[side];
  // Play a scoring card if held (must be played this turn).
  const scoring = hand.find((c) => isScoring(c));
  if (scoring) return { type: 'playCard', side, cardId: scoring, mode: 'scoring' };

  // Prefer own-side or neutral cards played for ops/events.
  const ownOrNeutral = hand.filter((c) => getCard(c).side !== opponent(side));
  const pool = ownOrNeutral.length ? ownOrNeutral : hand;
  const cardId = pool.sort((a, b) => getCard(b).ops - getCard(a).ops)[0];
  const card = getCard(cardId);
  // If it's our own event with a strong effect, play as event sometimes; else ops.
  const mode: 'event' | 'ops' = card.side === side && state.options ? 'ops' : 'ops';
  return { type: 'playCard', side, cardId, mode };
}

function chooseOp(state: GameState, side: Side, p: PendingChoice): Action | null {
  const ops = p.amount ?? getCard((p.meta?.cardId as string) ?? '').ops;
  const start = startInf(state);
  const cardId = p.meta?.cardId as string;
  const card = cardId === CHINA_CARD_ID ? { side: 'Neutral' as const, ops: 4, starred: false } : getCard(cardId);
  const isOppEvent = card.side === opponent(side);

  // 0) Avoid triggering an opponent event at low DEFCON (DEFCON trap): dump it
  //    on the Space Race instead.
  if (isOppEvent && state.defcon <= 2 && canAttemptSpace(state, side) && card.ops >= 2) {
    return { type: 'space', side };
  }

  // 1) Coups. Never coup a Battleground if it would drop DEFCON to 1
  //    (Battleground coup lowers DEFCON; unsafe when DEFCON <= 2).
  const allCoup = Object.keys(COUNTRIES).filter((id) => canCoup(state, id, side, false));
  const safeCoup = allCoup.filter((id) => !COUNTRIES[id].battleground || state.defcon > 2);
  if (safeCoup.length) {
    const bg = safeCoup
      .filter((id) => COUNTRIES[id].battleground)
      .sort((a, b) => COUNTRIES[b].stability - COUNTRIES[a].stability);
    const nonBg = safeCoup.filter((id) => !COUNTRIES[id].battleground);
    const target = bg[0] ?? nonBg.sort((a, b) => COUNTRIES[a].stability - COUNTRIES[b].stability)[0];
    return { type: 'coup', side, countryId: target };
  }

  // 2) Space race dump for any opponent event
  if (isOppEvent && canAttemptSpace(state, side) && card.ops >= 2) {
    return { type: 'space', side };
  }

  // 3) Realignments in a contested region
  const realignTargets = Object.keys(COUNTRIES).filter((id) => canRealign(state, id, side));
  if (realignTargets.length && ops >= 1) {
    return { type: 'realign', side, countryIds: realignTargets.slice(0, ops) };
  }

  // 4) Influence placement — distribute across cheapest valid targets
  const placements = planInfluence(state, side, ops, start);
  if (placements.length) {
    return { type: 'placeInfluence', side, placements };
  }

  // 5) Space race as fallback if possible
  if (canAttemptSpace(state, side) && card.ops >= 2) {
    return { type: 'space', side };
  }

  // 6) Last resort: empty influence placement (e.g. 0 ops) to dispose the card
  return { type: 'placeInfluence', side, placements: [] };
}

function planInfluence(
  state: GameState, side: Side, ops: number, start: Record<string, { us: number; ussr: number }>,
): Placement[] {
  if (ops <= 0) return [];
  const enemy = opponent(side);
  const valid = Object.keys(COUNTRIES).filter((id) => canPlaceInfluence(start, id, side, start));
  if (!valid.length) return [];
  // prefer enemy-controlled (to break control, worth it) then uncontrolled battlegrounds
  const scored = valid.map((id) => {
    const def = COUNTRIES[id];
    const inf = state.countries[id];
    let pr = 0;
    if (controller(id, inf) === enemy) pr += 5;
    else if (controller(id, inf) === 'none') pr += 3;
    if (def.battleground) pr += 3;
    pr += (4 - def.stability);
    return { id, pr };
  }).sort((a, b) => b.pr - a.pr);

  const placements: Placement[] = [];
  let budget = ops;
  // place 1 at a time into top targets; cost 2 if enemy-controlled
  for (const { id } of scored) {
    if (budget <= 0) break;
    const inf = state.countries[id];
    const cost = controller(id, inf) === enemy ? 2 : 1;
    if (cost > budget) continue;
    placements.push({ country: id, amount: 1 });
    budget -= cost;
  }
  return placements;
}

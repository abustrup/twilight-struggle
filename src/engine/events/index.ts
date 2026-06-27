// ============================================================================
// events — Card event handlers. Each handler mutates state. Many auto-resolve
// reasonable targets; the player still chooses for Operations (coups/
// influence/space). This is a working v1; events can be made interactive later.
// ============================================================================

import type { GameState } from '../state/types';
import type { Side } from '../data/cards';
import { COUNTRIES, countriesInRegion, getCountry } from '../data/map';
import { controller, removeInfluence, addInfluence } from '../core/control';
import {
  gainVP, improveDefcon, degradeDefcon, log, opponent, removeCountryInfluence, setCountryInfluence,
} from '../core/effects';
import { scoreRegion, scoreSoutheastAsia } from '../scoring/scoring';
import { performCoup } from '../ops/coup';
import { attemptSpace, boxIndex } from '../ops/spacerace';

export type EventHandler = (state: GameState, side: Side) => void;

// ---- shared helpers --------------------------------------------------------

function setControl(state: GameState, countryId: string, side: Side): void {
  const def = COUNTRIES[countryId];
  const opp = opponent(side);
  // clear opponent influence, set own to control threshold
  state.countries[countryId] = { us: 0, ussr: 0 };
  setCountryInfluence(state, countryId, opp, -999);
  setCountryInfluence(state, countryId, side, def.stability);
}

function addInfluenceRegion(
  state: GameState, side: Side, region: string[] | 'EasternEurope' | 'WesternEurope' | 'SoutheastAsia',
  total: number, maxPerCountry = 99, requireUncontrolled = false,
): void {
  const candidates = Object.keys(COUNTRIES).filter((id) => {
    const def = COUNTRIES[id];
    if (region === 'EasternEurope') return def.region === 'Europe' && def.subregion === 'EasternEurope';
    if (region === 'WesternEurope') return def.region === 'Europe' && def.subregion === 'WesternEurope';
    if (region === 'SoutheastAsia') return def.subregion === 'SoutheastAsia';
    return (region as string[]).includes(def.region);
  });
  let placed = 0;
  for (const id of candidates) {
    if (placed >= total) break;
    const ctrl = controller(id, state.countries[id]);
    if (requireUncontrolled && ctrl !== 'none') continue;
    if (state.countries[id][side === 'US' ? 'us' : 'ussr'] >= maxPerCountry) continue;
    const amount = Math.min(total - placed, 1);
    setCountryInfluence(state, id, side, amount);
    placed += amount;
  }
}

function removeEnemyInfluence(
  state: GameState, actorSide: Side, region: 'Europe' | 'MiddleEast' | 'EasternEurope' | 'Asia' | 'Africa',
  total: number, maxPerCountry = 2,
): void {
  const target = opponent(actorSide);
  const candidates = Object.keys(COUNTRIES).filter((id) => {
    const def = COUNTRIES[id];
    if (region === 'EasternEurope') return def.region === 'Europe' && def.subregion === 'EasternEurope';
    return def.region === region;
  }).filter((id) => state.countries[id][target === 'US' ? 'us' : 'ussr'] > 0);
  let remaining = total;
  for (const id of candidates) {
    if (remaining <= 0) break;
    const here = state.countries[id][target === 'US' ? 'us' : 'ussr'];
    const take = Math.min(remaining, maxPerCountry, here);
    removeCountryInfluence(state, id, target, take);
    remaining -= take;
  }
}

function warEvent(state: GameState, side: Side, targetId: string): void {
  const def = getCountry(targetId);
  const opp = opponent(side);
  // modifiers: -1 per opp-controlled adjacent country
  let mod = 0;
  for (const n of def.adj) {
    if (COUNTRIES[n] && controller(n, state.countries[n]) === opp) mod -= 1;
  }
  const { roll: raw } = rollDie(state);
  const roll = raw + mod;
  log(state, `${side} war vs ${def.name}: roll ${raw}${mod ? ` (mod ${mod})` : ''} = ${roll}`, side, raw);
  state.milOps[side] += 2;
  if (roll >= 4) {
    // success: +2 VP, replace opponent influence
    gainVP(state, side, 2);
    const removed = removeCountryInfluence(state, targetId, opp, 999);
    setCountryInfluence(state, targetId, side, removed > 0 ? removed : def.stability);
    log(state, `${side} wins war in ${def.name}: +2 VP, gains influence`);
  } else {
    log(state, `${side} loses war in ${def.name}`);
  }
}

import { RNG } from '../core/rng';
function rollDie(state: GameState): { roll: number } {
  const rng = new RNG(state.rngState);
  const roll = rng.die();
  state.rngState = rng.getState();
  return { roll };
}

// ---- registry --------------------------------------------------------------

export const EVENTS: Record<string, EventHandler> = {
  noop: () => {},

  'score:Europe': (s, side) => applyScoring(s, side, 'Europe'),
  'score:Asia': (s, side) => applyScoring(s, side, 'Asia'),
  'score:MiddleEast': (s, side) => applyScoring(s, side, 'MiddleEast'),
  'score:Africa': (s, side) => applyScoring(s, side, 'Africa'),
  'score:CentralAmerica': (s, side) => applyScoring(s, side, 'CentralAmerica'),
  'score:SouthAmerica': (s, side) => applyScoring(s, side, 'SouthAmerica'),
  'score:SoutheastAsia': (s, side) => {
    const net = scoreSoutheastAsia(s);
    gainVP(s, 'US', net);
    log(s, `${side} plays Southeast Asia Scoring: net ${net} VP`, side);
  },

  duckandcover: (s, side) => {
    degradeDefcon(s, 1);
    gainVP(s, 'US', 5 - s.defcon);
  },
  nasser: (s) => {
    setCountryInfluence(s, 'egypt', 'USSR', 2);
    removeCountryInfluence(s, 'egypt', 'US', 1);
  },
  fidel: (s) => setControl(s, 'cuba', 'USSR'),
  vietnamrevolts: (s) => {
    setCountryInfluence(s, 'vietnam', 'USSR', 2);
    s.opMod.USSR += 1; // approximation: +1 to all USSR ops this turn (should be SE Asia only)
  },
  romanianabdication: (s) => setControl(s, 'romania', 'USSR'),
  comecon: (s) => addInfluenceRegion(s, 'USSR', 'EasternEurope', 4, 1, false),
  warsawpact: (s) => addInfluenceRegion(s, 'USSR', 'EasternEurope', 5, 2, false),
  degaulle: (s) => {
    removeCountryInfluence(s, 'france', 'US', 2);
    setCountryInfluence(s, 'france', 'USSR', 1);
    setPersistent(s, 'degaulle');
  },
  trumandoctrine: (s, side) => {
    // remove all USSR influence from one uncontrolled Europe country
    const target = Object.keys(COUNTRIES).find(
      (id) => COUNTRIES[id].region === 'Europe' && controller(id, s.countries[id]) === 'USSR' && s.countries[id].ussr > 0,
    );
    if (target) removeCountryInfluence(s, target, 'USSR', 999);
  },
  nato: (s) => setPersistent(s, 'nato'),
  independentreds: (s) => {
    for (const id of ['yugoslavia', 'romania', 'bulgaria', 'hungary', 'czech']) {
      const def = COUNTRIES[id];
      s.countries[id].us = Math.max(s.countries[id].us, def.stability);
    }
  },
  marshallplan: (s) => addInfluenceRegion(s, 'US', 'WesternEurope', 7, 1, false),
  containment: (s) => { s.opMod.US += 1; },
  brezhnev: (s) => { s.opMod.USSR += 1; },
  redscare: (s, side) => { s.opMod[opponent(side)] -= 1; },
  nucleartestban: (s, side) => {
    improveDefcon(s, 2);
    gainVP(s, side, s.defcon - 2);
  },
  defcon: (s, side) => {
    improveDefcon(s, 2);
    gainVP(s, side === 'USSR' ? 'USSR' : 'US', 1);
  },
  usjapan: (s) => { setControl(s, 'japan', 'US'); setPersistent(s, 'usjapan'); },
  opec: (s) => {
    const targets = ['egypt', 'iran', 'libya', 'saudi', 'gulf', 'venezuela', 'iraq'];
    let vp = 0;
    for (const id of targets) if (controller(id, s.countries[id]) === 'USSR') vp++;
    gainVP(s, 'USSR', vp);
    setPersistent(s, 'opec');
  },
  u2incident: (s) => gainVP(s, 'USSR', 1),
  kitchendebates: (s) => {
    const usBG = Object.keys(COUNTRIES).filter((id) => COUNTRIES[id].battleground && controller(id, s.countries[id]) === 'US').length;
    const ussrBG = Object.keys(COUNTRIES).filter((id) => COUNTRIES[id].battleground && controller(id, s.countries[id]) === 'USSR').length;
    if (usBG > ussrBG) gainVP(s, 'US', 2);
  },
  ussuri: (s) => {
    addInfluenceRegion(s, 'US', ['Asia'], 2, 1, false);
    if (s.chinaCard.holder === 'USSR') { s.chinaCard = { holder: 'US', faceDown: false }; gainVP(s, 'US', 1); }
  },
  onesmallstep: (s, side) => {
    const other = opponent(side);
    if (boxIndex(s.space[side].box) < boxIndex(s.space[other].box)) {
      s.space[side].box = advanceBox(s.space[side].box, 2);
    }
  },
  armsrace: (s, side) => {
    const other = opponent(side);
    const ahead = boxIndex(s.space[side].box) > boxIndex(s.space[other].box);
    const tied = boxIndex(s.space[side].box) === boxIndex(s.space[other].box);
    gainVP(s, side, ahead ? 3 : tied ? 1 : 0);
  },
  summit: (s, side) => {
    const { roll } = rollDie(s);
    improveDefcon(s, Math.min(2, Math.floor(roll / 2)));
    gainVP(s, side, 1);
  },
  worrying: (s, side) => {
    // set DEFCON to 2, gain VP = 5-2
    s.defcon = 2;
    gainVP(s, side, 3);
  },
  wewillburyyou: (s) => { degradeDefcon(s, 1); gainVP(s, 'USSR', 3); },
  spaceraceadvance: (s, side) => { attemptSpace(s, side, 1); },
  brushwar: (s, side) => {
    // coup-like on a low-stability non-adjacent country
    const target = Object.keys(COUNTRIES).find(
      (id) => COUNTRIES[id].stability <= 2 && controller(id, s.countries[id]) === opponent(side),
    );
    if (target) warEvent(s, side, target);
  },
  war: () => { /* handled via resolveEvent payload in reducer */ },

  // generic handlers for cards that add/remove influence over a region
  influence: (s, side) => {
    // default: +1 to 3 adjacent-friendly countries (best-effort). Per-card text
    // is approximated; specific cards override via dedicated impl keys.
    addInfluenceRegion(s, side, ['Africa', 'Asia'], 3, 1, true);
  },
  removeinfluence: (s, side) => {
    removeEnemyInfluence(s, side, 'Europe', 3, 2);
  },
  destalinization: (s) => {
    // simplified: move up to 3 USSR influence from one country to others
    const src = Object.keys(COUNTRIES).find((id) => s.countries[id].ussr >= 3 && COUNTRIES[id].region === 'Europe');
    if (src) {
      removeCountryInfluence(s, src, 'USSR', 2);
      addInfluenceRegion(s, 'USSR', ['Asia', 'Africa', 'SouthAmerica'], 2, 1, true);
    }
  },
  campdavid: (s) => {
    for (const id of ['israel', 'egypt', 'jordan']) setCountryInfluence(s, id, 'US', 1);
    setPersistent(s, 'campdavid');
  },
  sadatexpels: (s) => {
    removeCountryInfluence(s, 'egypt', 'USSR', 3);
    setCountryInfluence(s, 'egypt', 'US', 1);
    gainVP(s, 'US', 1);
  },
  voiceofamerica: (s, side) => {
    // remove up to 4 USSR influence from non-European countries, max 2 each
    removeEnemyInfluence(s, side, 'Asia', 4, 2);
    removeEnemyInfluence(s, side, 'Africa', 2, 2);
  },
  johnpaul: (s) => {
    removeCountryInfluence(s, 'poland', 'USSR', 2);
    setCountryInfluence(s, 'poland', 'US', 1);
    setPersistent(s, 'johnpaul');
  },
  olympicgames: (s, side) => {
    // simplified: hosting side gains 2 VP
    gainVP(s, side, 2);
  },
  nasser2: () => {},
  cubanmissile: (s) => { s.defcon = 2; setPersistent(s, 'cubanmissile'); },
};

// Scoring application + VP move + Europe auto-win check.
function applyScoring(state: GameState, side: Side, region: 'Europe' | 'Asia' | 'MiddleEast' | 'Africa' | 'CentralAmerica' | 'SouthAmerica'): void {
  const r = scoreRegion(state, region);
  gainVP(state, 'US', r.net);
  log(state, `${side} plays ${region} Scoring: net ${r.net >= 0 ? 'US +' + r.net : 'USSR +' + -r.net} VP (US ${r.usLevel}/USSR ${r.ussrLevel})`, side);
  if (r.europeControlWinner) {
    state.over = { winner: r.europeControlWinner, reason: 'Europe Control' };
  }
}

function setPersistent(state: GameState, cardId: string, data?: Record<string, unknown>): void {
  if (!state.events.find((e) => e.cardId === cardId)) state.events.push({ cardId, data });
}

// helper to advance a space box by n
function advanceBox(current: import('../state/types').SpaceBoxId, n: number): import('../state/types').SpaceBoxId {
  const order: import('../state/types').SpaceBoxId[] = ['none', 'satellite', 'animal', 'maninspace', 'manearthorbit', 'lunarorbit', 'eagle', 'spacestation', 'intersolar'];
  const idx = order.indexOf(current);
  return order[Math.min(order.length - 1, idx + n)];
}

export function hasEvent(state: GameState, cardId: string): boolean {
  return !!state.events.find((e) => e.cardId === cardId);
}

// ============================================================================
// events – Card event handlers. Each handler mutates state. Many auto-resolve
// reasonable targets; the player still chooses for Operations (coups/
// influence/space). This is a working v1; events can be made interactive later.
// ============================================================================

import type { GameState } from '../state/types';
import { getCard, type Side } from '../data/cards';
import { COUNTRIES, countriesInRegion, getCountry } from '../data/map';
import { controller, removeInfluence, addInfluence } from '../core/control';
import {
  gainVP, improveDefcon, degradeDefcon, log, opponent, removeCountryInfluence, setCountryInfluence,
} from '../core/effects';
import { scoreRegion, scoreSoutheastAsia } from '../scoring/scoring';
import { performCoup } from '../ops/coup';
import { attemptSpace, boxIndex } from '../ops/spacerace';

export type EventHandler = (state: GameState, side: Side) => void;
export const NO_EFFECT_EVENTS = new Set<string>(['noop']);

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

function addMany(state: GameState, side: Side, placements: Array<[string, number]>): void {
  for (const [id, amount] of placements) setCountryInfluence(state, id, side, amount);
}

function removeMany(state: GameState, side: Side, removals: Array<[string, number]>): void {
  for (const [id, amount] of removals) removeCountryInfluence(state, id, side, amount);
}

function removeInfluenceFromCountries(
  state: GameState,
  side: Side,
  ids: string[],
  total: number,
  maxPerCountry = 99,
): void {
  let remaining = total;
  for (const id of ids) {
    if (remaining <= 0) break;
    const available = state.countries[id][side === 'US' ? 'us' : 'ussr'];
    const take = Math.min(remaining, maxPerCountry, available);
    if (take > 0) {
      removeCountryInfluence(state, id, side, take);
      remaining -= take;
    }
  }
}

function removeAll(state: GameState, id: string, side: Side): void {
  removeCountryInfluence(state, id, side, 999);
}

function firstControlledBattlegrounds(state: GameState, side: Side, regions: string[]): number {
  return Object.keys(COUNTRIES).filter((id) => {
    const def = COUNTRIES[id];
    return def.battleground && regions.includes(def.region) && controller(id, state.countries[id]) === side;
  }).length;
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
    if (removed > 0) setCountryInfluence(state, targetId, side, removed);
    log(state, `${side} wins war in ${def.name}: +2 VP${removed > 0 ? ', gains influence' : ''}`);
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
  fiveyearplan: (s) => {
    const cardId = s.hands.USSR[0];
    if (!cardId) return;
    s.hands.USSR = s.hands.USSR.filter((id) => id !== cardId);
    const card = getCard(cardId);
    s.decks.discard.push(cardId);
    if (card.side === 'US') {
      const handler = EVENTS[card.impl];
      if (handler) handler(s, 'US');
    }
  },
  socialistgovs: (s) => removeEnemyInfluence(s, 'USSR', 'Europe', 3, 2),
  nasser: (s) => {
    setCountryInfluence(s, 'egypt', 'USSR', 2);
    removeCountryInfluence(s, 'egypt', 'US', Math.ceil(s.countries.egypt.us / 2));
  },
  fidel: (s) => setControl(s, 'cuba', 'USSR'),
  vietnamrevolts: (s) => {
    setCountryInfluence(s, 'vietnam', 'USSR', 2);
    s.opMod.USSR += 1; // approximation: +1 to all USSR ops this turn (should be SE Asia only)
  },
  blockade: (s) => setControl(s, 'wgermany', 'USSR'),
  koreanwar: (s) => warEvent(s, 'USSR', 'skorea'),
  romanianabdication: (s) => setControl(s, 'romania', 'USSR'),
  arabisraeliwar: (s) => {
    if (!hasEvent(s, 'campdavid')) warEvent(s, 'USSR', 'israel');
  },
  comecon: (s) => addInfluenceRegion(s, 'USSR', 'EasternEurope', 4, 1, false),
  warsawpact: (s) => addInfluenceRegion(s, 'USSR', 'EasternEurope', 5, 2, false),
  degaulle: (s) => {
    removeCountryInfluence(s, 'france', 'US', 2);
    setCountryInfluence(s, 'france', 'USSR', 1);
    setPersistent(s, 'degaulle');
  },
  capturednazi: (s, side) => { s.space[side].box = advanceBox(s.space[side].box, 1); },
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
  indopakiwar: (s, side) => warEvent(s, side, controller('pakistan', s.countries.pakistan) === opponent(side) ? 'pakistan' : 'india'),
  marshallplan: (s) => addInfluenceRegion(s, 'US', 'WesternEurope', 7, 1, false),
  containment: (s) => { s.opMod.US += 1; },
  ciacreated: (s) => { s.pending = { kind: 'opType', side: 'US', amount: 1, meta: { cardId: 'ciacreated' } }; s.awaiting = 'US'; },
  brezhnev: (s) => { s.opMod.USSR += 1; },
  redscare: (s, side) => { s.opMod[opponent(side)] -= 1; },
  nucleartestban: (s, side) => {
    gainVP(s, side, s.defcon - 2);
    improveDefcon(s, 2);
  },
  defcon: (s, side) => {
    improveDefcon(s, 2);
    gainVP(s, side === 'USSR' ? 'USSR' : 'US', 1);
  },
  suezcrisis: (s) => removeInfluenceFromCountries(s, 'US', ['france', 'uk', 'israel'], 4, 2),
  easteurunrest: (s) => removeEnemyInfluence(s, 'US', 'EasternEurope', s.turn >= 8 ? 6 : 3, s.turn >= 8 ? 2 : 1),
  decolonization: (s) => addInfluenceRegion(s, 'USSR', ['Africa', 'Asia'], 4, 1, false),
  unintervention: (s) => setPersistent(s, 'unintervention'),
  formosan: (s) => setPersistent(s, 'formosan'),
  defectors: (s, side) => {
    if (side === 'US') setPersistent(s, 'defectors');
    else gainVP(s, 'US', 1);
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
  nuclearsubs: (s) => setPersistent(s, 'nuclearsubs'),
  quagmire: (s) => setPersistent(s, 'quagmire', { side: 'US' }),
  salt: (s) => { improveDefcon(s, 2); setPersistent(s, 'salt'); },
  beartrap: (s) => setPersistent(s, 'beartrap', { side: 'USSR' }),
  armsrace: (s, side) => {
    const other = opponent(side);
    if (s.milOps[side] <= s.milOps[other]) return;
    gainVP(s, side, s.milOps[side] >= s.defcon ? 3 : 1);
  },
  summit: (s, side) => {
    const { roll } = rollDie(s);
    improveDefcon(s, Math.min(2, Math.floor(roll / 2)));
    gainVP(s, side, 1);
  },
  worrying: (s, side) => {
    s.defcon = 5;
    s.milOps[side] += 5;
  },
  junta: (s, side) => {
    const target = ['panama', 'venezuela', 'chile', 'brazil'].find((id) => controller(id, s.countries[id]) !== opponent(side)) ?? 'panama';
    setCountryInfluence(s, target, side, 2);
  },
  missileenvy: (s, side) => {
    const other = opponent(side);
    const target = [...s.hands[other]].sort((a, b) => getCard(b).ops - getCard(a).ops)[0];
    if (!target) return;
    s.hands[other] = s.hands[other].filter((id) => id !== target);
    s.hands[side].push(target);
    s.hands[side] = s.hands[side].filter((id) => id !== 'missileenvy');
    s.hands[other].push('missileenvy');
  },
  wewillburyyou: (s) => { degradeDefcon(s, 1); gainVP(s, 'USSR', 3); },
  portugalempire: (s) => addMany(s, 'USSR', [['angola', 2], ['seafrica', 2]]),
  southafricanunrest: (s) => addMany(s, 'USSR', [['southafrica', 1], ['angola', 2]]),
  allende: (s) => setCountryInfluence(s, 'chile', 'USSR', 2),
  willybrandt: (s) => { gainVP(s, 'USSR', 1); setCountryInfluence(s, 'wgermany', 'USSR', 1); setPersistent(s, 'willybrandt'); },
  muslimrevolution: (s) => {
    if (hasEvent(s, 'awacs')) return;
    for (const id of ['egypt', 'libya']) removeAll(s, id, 'US');
  },
  abm: (s, side) => { improveDefcon(s, 1); s.pending = { kind: 'opType', side, amount: 4, meta: { cardId: 'abm' } }; s.awaiting = side; },
  culturalrevolution: (s) => {
    if (s.chinaCard.holder === 'US') s.chinaCard = { holder: 'USSR', faceDown: false };
    else gainVP(s, 'USSR', 1);
  },
  flowerpower: (s) => setPersistent(s, 'flowerpower'),
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
  lonegunman: (s) => { gainVP(s, 'USSR', 1); s.pending = { kind: 'opType', side: 'USSR', amount: 1, meta: { cardId: 'lonegunman' } }; s.awaiting = 'USSR'; },
  colonialrearguards: (s) => addInfluenceRegion(s, 'US', ['Africa', 'Asia'], 4, 1, false),
  panamacanal: (s) => addMany(s, 'US', [['panama', 1], ['costarica', 1], ['venezuela', 1]]),
  campdavid: (s) => {
    gainVP(s, 'US', 1);
    for (const id of ['israel', 'egypt', 'jordan']) setCountryInfluence(s, id, 'US', 1);
    setPersistent(s, 'campdavid');
  },
  puppetgovs: (s) => addInfluenceRegion(s, 'US', ['Africa', 'Asia', 'CentralAmerica', 'SouthAmerica'], 3, 1, true),
  grainsales: (s) => {
    const cardId = s.hands.USSR[0];
    if (cardId) {
      s.hands.USSR = s.hands.USSR.filter((id) => id !== cardId);
      s.hands.US.push(cardId);
    }
  },
  deathsquads: (s, side) => setPersistent(s, 'deathsquads', { side }),
  oasfounded: (s) => addInfluenceRegion(s, 'US', ['CentralAmerica', 'SouthAmerica'], 2, 1, false),
  nixonchina: (s) => {
    if (s.chinaCard.holder === 'USSR') s.chinaCard = { holder: 'US', faceDown: true };
    else gainVP(s, 'US', 2);
  },
  sadatexpels: (s) => {
    removeAll(s, 'egypt', 'USSR');
    setCountryInfluence(s, 'egypt', 'US', 1);
    gainVP(s, 'US', 1);
  },
  shuttlediplomacy: (s) => setPersistent(s, 'shuttlediplomacy'),
  voiceofamerica: (s, side) => {
    const targets = Object.keys(COUNTRIES).filter((id) => COUNTRIES[id].region !== 'Europe' && COUNTRIES[id].region !== 'NorthAmerica');
    removeInfluenceFromCountries(s, opponent(side), targets, 4, 2);
  },
  liberationtheology: (s) => addInfluenceRegion(s, 'USSR', ['CentralAmerica'], 3, 2, false),
  johnpaul: (s) => {
    removeCountryInfluence(s, 'poland', 'USSR', 2);
    setCountryInfluence(s, 'poland', 'US', 1);
    setPersistent(s, 'johnpaul');
  },
  asknot: (s) => {
    s.decks.discard.push(...s.hands.US);
    s.hands.US = [];
  },
  allianceforprogress: (s) => gainVP(s, 'US', firstControlledBattlegrounds(s, 'US', ['CentralAmerica', 'SouthAmerica'])),
  iranianhostage: (s) => { removeAll(s, 'iran', 'US'); setCountryInfluence(s, 'iran', 'USSR', 2); gainVP(s, 'USSR', 1); setPersistent(s, 'iranianhostage'); },
  ironlady: (s) => { setCountryInfluence(s, 'argentina', 'USSR', 1); removeAll(s, 'uk', 'USSR'); gainVP(s, 'US', 1); setPersistent(s, 'ironlady'); },
  reaganlibya: (s) => gainVP(s, 'US', Math.floor(s.countries.libya.ussr / 2)),
  starwars: (s) => {
    if (boxIndex(s.space.US.box) <= boxIndex(s.space.USSR.box)) return;
    const cardId = s.decks.discard.find((id) => !getCard(id).scoring);
    if (cardId) {
      s.decks.discard = s.decks.discard.filter((id) => id !== cardId);
      const handler = EVENTS[getCard(cardId).impl];
      if (handler) handler(s, 'US');
      s.decks.removed.push(cardId);
    }
  },
  northseaoil: (s) => { setPersistent(s, 'northseaoil'); s.events = s.events.filter((e) => e.cardId !== 'opec'); },
  reformer: (s) => { addInfluenceRegion(s, 'USSR', 'EasternEurope', s.vp < 0 ? 4 : 6, 2, false); setPersistent(s, 'reformer'); },
  marinebarracks: (s) => { removeAll(s, 'lebanon', 'US'); removeEnemyInfluence(s, 'USSR', 'MiddleEast', 2, 2); },
  kal007: (s) => { degradeDefcon(s, 1); gainVP(s, 'US', 2); setCountryInfluence(s, 'skorea', 'US', 1); },
  glasnost: (s) => { improveDefcon(s, 1); gainVP(s, 'USSR', 2); if (hasEvent(s, 'reformer')) addInfluenceRegion(s, 'USSR', 'EasternEurope', 2, 1, false); },
  ortega: (s) => { removeAll(s, 'nicaragua', 'US'); setControl(s, 'nicaragua', 'USSR'); },
  terrorism: (s, side) => {
    const other = opponent(side);
    const count = other === 'US' && hasEvent(s, 'iranianhostage') ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const cardId = s.hands[other][0];
      if (!cardId) break;
      s.hands[other] = s.hands[other].filter((id) => id !== cardId);
      s.decks.discard.push(cardId);
    }
  },
  irancontra: (s) => setPersistent(s, 'irancontra'),
  chernobyl: (s) => setPersistent(s, 'chernobyl', { region: 'Europe' }),
  debtcrisis: (s) => addInfluenceRegion(s, 'USSR', ['SouthAmerica'], 4, 2, false),
  teardown: (s) => { setCountryInfluence(s, 'egermany', 'US', 3); s.events = s.events.filter((e) => !['willybrandt', 'reformer'].includes(e.cardId)); },
  evilempire: (s) => { gainVP(s, 'US', 1); s.events = s.events.filter((e) => e.cardId !== 'flowerpower'); },
  aldrichames: (s) => {
    const cardId = s.hands.US[0];
    if (cardId) {
      s.hands.US = s.hands.US.filter((id) => id !== cardId);
      s.decks.discard.push(cardId);
    }
    setPersistent(s, 'aldrichames');
  },
  pershing2: (s) => { gainVP(s, 'USSR', 1); removeMany(s, 'US', [['france', 1], ['italy', 1], ['wgermany', 1]]); },
  wargames: (s, side) => {
    if (s.defcon === 2) {
      gainVP(s, opponent(side), 6);
      s.over = { winner: side, reason: 'Wargames' };
    }
  },
  solidarity: (s) => { if (hasEvent(s, 'johnpaul')) setCountryInfluence(s, 'poland', 'US', 3); },
  iraniraqwar: (s, side) => warEvent(s, side, controller('iran', s.countries.iran) === opponent(side) ? 'iran' : 'iraq'),
  cambridgefive: (s) => addInfluenceRegion(s, 'USSR', ['Asia', 'MiddleEast', 'Europe'], 1, 1, false),
  specialrelationship: (s) => { if (controller('uk', s.countries.uk) === 'US') setCountryInfluence(s, hasEvent(s, 'nato') ? 'france' : 'canada', 'US', hasEvent(s, 'nato') ? 2 : 1); },
  norad: (s) => setPersistent(s, 'norad'),
  che: (s) => {
    const target = ['nicaragua', 'angola', 'zaire'].find((id) => !COUNTRIES[id].battleground && s.countries[id].us > 0);
    if (target) performCoup(s, { countryId: target, ops: 3, side: 'USSR', free: true });
  },
  ourmanintehran: (s) => { if (Object.keys(COUNTRIES).some((id) => COUNTRIES[id].region === 'MiddleEast' && controller(id, s.countries[id]) === 'US')) setPersistent(s, 'ourmanintehran'); },
  yuriandsamantha: (s) => setPersistent(s, 'yuriandsamantha'),
  awacs: (s) => { setCountryInfluence(s, 'saudi', 'US', 2); setPersistent(s, 'awacs'); },
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

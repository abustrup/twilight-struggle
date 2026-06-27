// ============================================================================
// scoring.ts — Region scoring (rule 10.1) and final scoring (10.3.2).
//
// Scoring per region (10.1.1-10.1.2):
//  Presence: control >= 1 country in region.
//  Domination: more countries + more battlegrounds than opponent,
//              AND at least 1 BG and 1 non-BG controlled.
//  Control: more countries + ALL battlegrounds in region.
// Bonus VPs:
//  +1 per controlled country adjacent to enemy superpower
//  +1 per controlled battleground
//
// Region VP tables (Presence/Domination/Control):
//   Europe       3/7/auto-win-on-control
//   Asia         3/7/9
//   Middle East  3/5/7
//   Africa       1/4/6
//   Central Am.  1/3/5
//   South Am.    2/3/6
// ============================================================================

import type { GameState } from '../state/types';
import type { Region } from '../data/map';
import { COUNTRIES, countriesInRegion } from '../data/map';
import { controller, type ControlStatus } from '../core/control';

interface RegionTable {
  presence: number;
  domination: number;
  control: number;
}

const TABLES: Record<Region, RegionTable> = {
  Europe: { presence: 3, domination: 7, control: Number.MAX_SAFE_INTEGER },
  Asia: { presence: 3, domination: 7, control: 9 },
  MiddleEast: { presence: 3, domination: 5, control: 7 },
  Africa: { presence: 1, domination: 4, control: 6 },
  CentralAmerica: { presence: 1, domination: 3, control: 5 },
  SouthAmerica: { presence: 2, domination: 3, control: 6 },
};

type Level = 'none' | 'presence' | 'domination' | 'control';

interface SideScore {
  countries: number;
  battlegrounds: number;
  adjacentToEnemy: number;
  nonBG: number;
}

function computeSide(state: GameState, region: Region, side: 'US' | 'USSR'): SideScore {
  const ids = countriesInRegion(region);
  const enemySP = side === 'US' ? 'adjUSSR' : 'adjUS';
  let countries = 0;
  let battlegrounds = 0;
  let adjacentToEnemy = 0;
  for (const id of ids) {
    if (controller(id, state.countries[id]) !== side) continue;
    countries++;
    const def = COUNTRIES[id];
    if (def.battleground) battlegrounds++;
    else (0);
    if (def[enemySP]) adjacentToEnemy++;
  }
  return { countries, battlegrounds, adjacentToEnemy, nonBG: countries - battlegrounds };
}

function levelForSide(
  side: SideScore,
  opp: SideScore,
  region: Region,
): Level {
  if (side.countries === 0) return 'none';
  const table = TABLES[region];
  // Control
  const allBGs = countriesInRegion(region).filter((id) => COUNTRIES[id].battleground).length;
  if (side.countries > opp.countries && side.battlegrounds === allBGs && allBGs > 0) {
    return 'control';
  }
  // Domination
  if (
    side.countries > opp.countries &&
    side.battlegrounds > opp.battlegrounds &&
    side.battlegrounds >= 1 &&
    side.nonBG >= 1
  ) {
    return 'domination';
  }
  // Presence
  return 'presence';
}

function levelVP(level: Level, region: Region): number {
  const t = TABLES[region];
  switch (level) {
    case 'none': return 0;
    case 'presence': return t.presence;
    case 'domination': return t.domination;
    case 'control': return t.control;
  }
}

export interface RegionScoreResult {
  region: Region;
  usRaw: number;
  ussrRaw: number;
  net: number; // positive = US gains, negative = USSR gains
  usLevel: Level;
  ussrLevel: Level;
  // special: Europe control = auto-win
  europeControlWinner?: 'US' | 'USSR';
}

export function scoreRegion(state: GameState, region: Region): RegionScoreResult {
  const us = computeSide(state, region, 'US');
  const ussr = computeSide(state, region, 'USSR');
  const usLevel = levelForSide(us, ussr, region);
  const ussrLevel = levelForSide(ussr, us, region);

  const usRaw = levelVP(usLevel, region) + us.battlegrounds + us.adjacentToEnemy;
  const ussrRaw = levelVP(ussrLevel, region) + ussr.battlegrounds + ussr.adjacentToEnemy;
  const net = usRaw - ussrRaw;

  let europeControlWinner: 'US' | 'USSR' | undefined;
  if (region === 'Europe') {
    if (usLevel === 'control') europeControlWinner = 'US';
    else if (ussrLevel === 'control') europeControlWinner = 'USSR';
  }

  return { region, usRaw, ussrRaw, net, usLevel, ussrLevel, europeControlWinner };
}

// Final scoring at end of turn 10 (10.3.2): all regions scored (SEA folded
// into Asia; handled because SEA countries have region 'Asia').
export function finalScore(state: GameState): { net: number; perRegion: RegionScoreResult[]; europeControlWinner?: 'US' | 'USSR' } {
  const regions: Region[] = ['Europe', 'Asia', 'MiddleEast', 'Africa', 'CentralAmerica', 'SouthAmerica'];
  const perRegion = regions.map((r) => scoreRegion(state, r));
  let net = 0;
  let europeControlWinner: 'US' | 'USSR' | undefined;
  for (const r of perRegion) {
    net += r.net;
    if (r.europeControlWinner) europeControlWinner = r.europeControlWinner;
  }
  return { net, perRegion, europeControlWinner };
}

// Southeast Asia sub-scoring (only its own scoring card, 7.2). Simplified:
// counts SEA subregion countries.
export function scoreSoutheastAsia(state: GameState): number {
  const ids = Object.keys(COUNTRIES).filter((id) => COUNTRIES[id].subregion === 'SoutheastAsia');
  let us = 0;
  let ussr = 0;
  const bgInSEA = ids.filter((id) => COUNTRIES[id].battleground);
  const usBGs = bgInSEA.filter((id) => controller(id, state.countries[id]) === 'US').length;
  const ussrBGs = bgInSEA.filter((id) => controller(id, state.countries[id]) === 'USSR').length;
  for (const id of ids) {
    const ctrl = controller(id, state.countries[id]);
    if (ctrl === 'US') us++;
    else if (ctrl === 'USSR') ussr++;
  }
  // SEA table: 1 VP per country, +2 per BG (winner-takes-Vietnam bonus ~+1)
  us += usBGs * 2 + (controller('vietnam', state.countries.vietnam) === 'US' ? 1 : 0);
  ussr += ussrBGs * 2 + (controller('vietnam', state.countries.vietnam) === 'USSR' ? 1 : 0);
  return us - ussr;
}

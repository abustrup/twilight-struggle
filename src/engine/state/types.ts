// ============================================================================
// types.ts – Core engine types.
// ============================================================================

import type { Region } from '../data/map';
import type { Side, War } from '../data/cards';

export type { Side };

// Phases the game machine can be in.
export type Phase =
  | 'setup' // optional bidding/placement (auto-resolved here)
  | 'headlinePick' // both choose headline secretly
  | 'headlineResolve' // apply headline events in order
  | 'actionRound' // players alternate playing cards
  | 'turnEnd' // milops check, china card flip, advance turn
  | 'finalScoring'
  | 'gameOver';

// What a player is currently being asked to decide.
export type PendingKind =
  | 'headline' // pick a headline card
  | 'playCard' // pick a card from hand
  | 'cardMode' // choose: event vs ops (after picking a card)
  | 'opType' // choose: influence / coup / realignment / space
  | 'influenceTargets' // place N influence
  | 'coupTarget' // pick a country to coup
  | 'realignTargets' // pick countries to realign
  | 'spaceRoll' // confirm space race attempt
  | 'resolveEvent' // event-specific choice (e.g. de-stalinization)
  | 'pass' // no legal action / sit out
  | 'scoringPlayed' // informational
  | 'ok'; // dismiss a notice

export interface PendingChoice {
  kind: PendingKind;
  side: Side; // who must act
  // generic payload
  cardId?: string; // the card being played
  amount?: number; // ops to spend / influence to place
  description?: string;
  options?: string[]; // valid option ids
  // state for multi-step influence placement
  placements?: { country: string; amount: number }[]; // already placed this action
  // event-specific payload (free-form)
  payload?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface PlayerView {
  hand: string[];
  chinaCardHeld: boolean;
  chinaCardFaceDown: boolean;
}

export interface PersistentEvent {
  cardId: string;
  data?: Record<string, unknown>; // e.g. region blocked by Chernobyl
}

export type SpaceBoxId =
  | 'none'
  | 'satellite'
  | 'animal'
  | 'maninspace'
  | 'manearthorbit'
  | 'lunarorbit'
  | 'eagle'
  | 'spacestation'
  | 'intersolar';

export interface SpaceState {
  box: SpaceBoxId;
  attemptsThisTurn: number;
  // abilities (6.4.4)
  abilities: Set<string>;
}

export interface LogEntry {
  side?: Side;
  text: string;
  roll?: number;
  ts: number;
}

export interface GameState {
  turn: number;
  phase: Phase;
  actionRound: number;
  phasing: Side;
  defcon: number;
  vp: number; // positive = US, negative = USSR
  milOps: { US: number; USSR: number };
  space: { US: SpaceState; USSR: SpaceState };
  chinaCard: { holder: Side; faceDown: boolean };
  countries: Record<string, { us: number; ussr: number }>;

  decks: {
    draw: string[];
    discard: string[];
    removed: string[];
    // staged piles not yet mixed in
    pendingMid: string[];
    pendingLate: string[];
  };

  hands: { US: string[]; USSR: string[] };
  headline: { US: string | null; USSR: string | null; orderResolved: Side[] };
  events: PersistentEvent[];
  opMod: { US: number; USSR: number }; // additive op modifier this turn
  spaceThisTurn: { US: number; USSR: number };
  pending: PendingChoice | null;
  awaiting: Side | null; // whose input is needed
  log: LogEntry[];
  rngState: number;
  over: { winner: Side; reason: string } | null;
  // flags
  firstActionRoundResolved: { US: boolean; USSR: boolean };
  // optional variant flags
  options: GameOptions;
}

export interface GameOptions {
  chineseCivilWar: boolean;
  optionalCards: boolean;
}

export function handSizeForTurn(turn: number): number {
  return turn <= 3 ? 8 : 9;
}

export function actionRoundsForTurn(turn: number): number {
  return turn <= 3 ? 6 : 7;
}

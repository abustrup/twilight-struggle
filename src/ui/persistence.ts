import type { GameState, SpaceState } from '../engine/state/types';
import type { Side } from '../engine/data/cards';
import type { Mode } from './useGame';

export const SAVE_KEY = 'twilight-struggle.local-save.v1';
const SAVE_VERSION = 1;

type SerializedSpaceState = Omit<SpaceState, 'abilities'> & { abilities: string[] };
type SerializedGameState = Omit<GameState, 'space'> & {
  space: { US: SerializedSpaceState; USSR: SerializedSpaceState };
};

export interface SaveRecord {
  version: number;
  savedAt: string;
  mode: Mode;
  humanSide: Side;
  state: SerializedGameState;
}

export interface RestoredSave {
  mode: Mode;
  humanSide: Side;
  state: GameState;
}

export function createSaveRecord(state: GameState, mode: Mode, humanSide: Side): SaveRecord {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    mode,
    humanSide,
    state: {
      ...state,
      space: {
        US: serializeSpace(state.space.US),
        USSR: serializeSpace(state.space.USSR),
      },
    },
  };
}

export function restoreSaveRecord(record: SaveRecord): RestoredSave {
  if (record.version !== SAVE_VERSION) throw new Error(`Unsupported save version: ${record.version}`);
  return {
    mode: record.mode,
    humanSide: record.humanSide,
    state: {
      ...record.state,
      space: {
        US: restoreSpace(record.state.space.US),
        USSR: restoreSpace(record.state.space.USSR),
      },
    },
  };
}

export function saveToStorage(state: GameState, mode: Mode, humanSide: Side): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(createSaveRecord(state, mode, humanSide)));
}

export function loadFromStorage(): RestoredSave | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return restoreSaveRecord(JSON.parse(raw) as SaveRecord);
}

export function clearStoredSave(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAVE_KEY);
}

function serializeSpace(space: SpaceState): SerializedSpaceState {
  return { ...space, abilities: [...space.abilities] };
}

function restoreSpace(space: SerializedSpaceState): SpaceState {
  return { ...space, abilities: new Set(space.abilities) };
}

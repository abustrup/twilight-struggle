import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame } from '../engine/state/create';
import { reduce, type Action } from '../engine/core/reducer';
import { botAction } from '../engine/ai/bot';
import type { GameState } from '../engine/state/types';
import type { Side } from '../engine/data/cards';

export type Mode = 'hotseat' | 'vsAI';

export interface GameApi {
  state: GameState;
  dispatch: (a: Action) => void;
  perspective: Side; // whose hand the UI shows
  aiSide: Side | null;
  restart: (seed?: number) => void;
}

export function useGame(mode: Mode, humanSide: Side = 'US'): GameApi {
  const [state, setState] = useState<GameState>(() => createGame());
  const aiSide: Side | null = mode === 'vsAI' ? (humanSide === 'US' ? 'USSR' : 'US') : null;
  const perspective: Side = mode === 'vsAI' ? humanSide : (state.awaiting ?? 'US');

  const dispatch = useCallback((a: Action) => {
    setState((prev) => reduce(prev, a));
  }, []);

  // Bot auto-play
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (aiSide && state.awaiting === aiSide && !state.over) {
      timer.current = window.setTimeout(() => {
        setState((prev) => {
          if (prev.over || prev.awaiting !== aiSide) return prev;
          const a = botAction(prev, aiSide);
          return a ? reduce(prev, a) : prev;
        });
      }, 350);
      return () => {
        if (timer.current) window.clearTimeout(timer.current);
      };
    }
  }, [state, aiSide]);

  const restart = useCallback((seed?: number) => {
    setState(createGame(seed ?? Math.floor(Math.random() * 1e9)));
  }, []);

  return { state, dispatch, perspective, aiSide, restart };
}

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
  undo: () => void;
  canUndo: boolean;
  gameId: number; // bumped on restart so consumers can reset per-game baselines
}

// Undo history: snapshots of past states. Capped so a long game can't grow it
// without bound (states are plain data, but ~100 is plenty for an undo trail).
const HISTORY_CAP = 100;
interface Hist { stack: GameState[]; cur: GameState; id: number }

function push(h: Hist, prev: GameState, next: GameState): Hist {
  if (next === prev) return h;
  const stack = h.stack.length >= HISTORY_CAP ? h.stack.slice(h.stack.length - HISTORY_CAP + 1) : h.stack.slice();
  stack.push(prev);
  return { stack, cur: next, id: h.id };
}

export function useGame(mode: Mode, humanSide: Side = 'US', initialState?: GameState): GameApi {
  const aiSide: Side | null = mode === 'vsAI' ? (humanSide === 'US' ? 'USSR' : 'US') : null;
  const [hist, setHist] = useState<Hist>(() => ({ stack: [], cur: initialState ?? createGame(), id: 0 }));
  const state = hist.cur;
  const perspective: Side = mode === 'vsAI' ? humanSide : (state.awaiting ?? 'US');

  const dispatch = useCallback((a: Action) => {
    setHist((h) => push(h, h.cur, reduce(h.cur, a)));
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.stack.length) return h;
      const stack = h.stack.slice();
      let cur = stack.pop() as GameState;
      // vs AI: step back over the AI's auto-responses to the human's last decision point.
      if (aiSide) {
        while (cur.awaiting === aiSide && stack.length) cur = stack.pop() as GameState;
      }
      return { stack, cur, id: h.id };
    });
  }, [aiSide]);

  // Enable undo only when there is something meaningful to revert. In vsAI that
  // means a prior human-turn state exists (so we don't just bounce the AI).
  const canUndo = aiSide ? hist.stack.some((s) => s.awaiting === humanSide) : hist.stack.length > 0;

  // Bot auto-play
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (aiSide && state.awaiting === aiSide && !state.over) {
      timer.current = window.setTimeout(() => {
        setHist((h) => {
          if (h.cur.over || h.cur.awaiting !== aiSide) return h;
          const a = botAction(h.cur, aiSide);
          return a ? push(h, h.cur, reduce(h.cur, a)) : h;
        });
      }, 350);
      return () => {
        if (timer.current) window.clearTimeout(timer.current);
      };
    }
  }, [state, aiSide]);

  const restart = useCallback((seed?: number) => {
    setHist((h) => ({ stack: [], cur: createGame(seed ?? Math.floor(Math.random() * 1e9)), id: h.id + 1 }));
  }, []);

  return { state, dispatch, perspective, aiSide, restart, undo, canUndo, gameId: hist.id };
}

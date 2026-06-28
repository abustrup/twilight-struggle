import { useEffect, useState, type CSSProperties } from 'react';
import { useGame, type Mode } from './ui/useGame';
import { Tracks, Board, Hand, Log, startInf } from './ui/components';
import { clearStoredSave, loadFromStorage, saveToStorage, type RestoredSave } from './ui/persistence';
import type { Side } from './engine/data/cards';
import { getCard, isScoring } from './engine/data/cards';
import { COUNTRIES } from './engine/data/map';
import { controller } from './engine/core/control';
import { canCoup } from './engine/ops/coup';
import { canRealign } from './engine/ops/realignment';
import { canAttemptSpace } from './engine/ops/spacerace';
import type { Action } from './engine/core/reducer';
import type { Placement } from './engine/ops/influence';
import type { GameState } from './engine/state/types';

type OpType = 'influence' | 'coup' | 'realign' | 'space';

export function App() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [humanSide, setHumanSide] = useState<Side>('US');
  const [initialState, setInitialState] = useState<GameState | undefined>(undefined);
  const [storedSave, setStoredSave] = useState<RestoredSave | null>(() => {
    try { return loadFromStorage(); } catch { return null; }
  });
  if (!mode) {
    return (
      <Menu
        storedSave={storedSave}
        onResume={() => {
          if (!storedSave) return;
          setMode(storedSave.mode);
          setHumanSide(storedSave.humanSide);
          setInitialState(storedSave.state);
        }}
        onPick={(m, s) => {
          clearStoredSave();
          setStoredSave(null);
          setInitialState(undefined);
          setMode(m);
          setHumanSide(s);
        }}
      />
    );
  }
  return <Game mode={mode} humanSide={humanSide} initialState={initialState} onExit={() => { setStoredSave(loadFromStorage()); setMode(null); }} />;
}

function Menu({
  storedSave,
  onResume,
  onPick,
}: {
  storedSave: RestoredSave | null;
  onResume: () => void;
  onPick: (m: Mode, s: Side) => void;
}) {
  const menuStyle = {
    '--map-image': `url("${import.meta.env.BASE_URL}ts-map.jpg")`,
  } as CSSProperties;

  return (
    <div className="menu" style={menuStyle}>
      <h1>Twilight Struggle</h1>
      <p className="subtitle">The Cold War 1945–1989</p>
      <div className="menu-buttons">
        {storedSave && <button onClick={onResume}>Continue Saved Game</button>}
        <button onClick={() => onPick('hotseat', 'US')}>Hotseat (2 players)</button>
        <button onClick={() => onPick('vsAI', 'US')}>Play vs AI – as US</button>
        <button onClick={() => onPick('vsAI', 'USSR')}>Play vs AI – as USSR</button>
      </div>
      <div className="menu-note">
        A working build of the core board game: full map, the 110-card deck,
        Influence / Coups / Realignments / Space Race, DEFCON, Military Ops,
        region scoring, headline + action rounds, local saves, AI play, and
        10-turn victory. Card events are registered across Early, Mid, Late, and
        Optional cards, with deterministic target choices where the UI does not
        yet ask for a specific target.
      </div>
    </div>
  );
}

function Game({ mode, humanSide, initialState, onExit }: { mode: Mode; humanSide: Side; initialState?: GameState; onExit: () => void }) {
  const { state, dispatch, perspective, aiSide, restart } = useGame(mode, humanSide, initialState);

  const [selCard, setSelCard] = useState<string | null>(null);
  const [opType, setOpType] = useState<OpType | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [realignSel, setRealignSel] = useState<string[]>([]);

  const p = state.pending;
  const myTurn = state.awaiting === perspective && !state.over;
  const budget = p?.amount ?? 0;

  useEffect(() => {
    saveToStorage(state, mode, humanSide);
  }, [state, mode, humanSide]);

  // reset interaction state whenever the pending target changes
  const key = `${state.turn}-${state.actionRound}-${state.phasing}-${p?.kind}-${(p as { meta?: { cardId?: string } })?.meta?.cardId ?? ''}`;
  const [lastKey, setLastKey] = useState(key);
  useEffect(() => {
    setLastKey(key);
    setSelCard(null);
    setOpType(null);
    setPlacements([]);
    setRealignSel([]);
  }, [key]);

  function reset() {
    setSelCard(null);
    setOpType(null);
    setPlacements([]);
    setRealignSel([]);
  }

  // ---- hand/card clicks ----
  function onCard(id: string) {
    if (!myTurn || !p) return;
    if (p.kind === 'headline') {
      dispatch({ type: 'pickHeadline', side: perspective, cardId: id });
    } else if (p.kind === 'playCard') {
      setSelCard((cur) => (cur === id ? null : id));
    }
  }

  // ---- country highlight + click ----
  function placeable(id: string): boolean {
    if (!myTurn || p?.kind !== 'opType' || opType !== 'influence') return false;
    const def = COUNTRIES[id];
    if (!def) return false;
    let reach = (perspective === 'US' && def.adjUS) || (perspective === 'USSR' && def.adjUSSR);
    if (!reach) for (const n of def.adj) if (COUNTRIES[n] && startInf(state)[n][perspective === 'US' ? 'us' : 'ussr'] > 0) reach = true;
    if (!reach) return false;
    // budget check (approx, considering placements + 2-cost)
    return placementCostUsed() < budget;
  }
  function placementCostUsed(): number {
    const enemy: Side = perspective === 'US' ? 'USSR' : 'US';
    const sim: Record<string, { us: number; ussr: number }> = { ...state.countries };
    let used = 0;
    for (const pl of placements) {
      sim[pl.country] = { ...sim[pl.country] };
      const cost = controller(pl.country, sim[pl.country]) === enemy ? 2 : 1;
      used += cost;
      if (perspective === 'US') sim[pl.country].us += 1; else sim[pl.country].ussr += 1;
    }
    return used;
  }
  function highlight(id: string): boolean {
    if (!myTurn || p?.kind !== 'opType') return false;
    if (opType === 'coup') return canCoup(state, id, perspective, false);
    if (opType === 'realign') return canRealign(state, id, perspective);
    if (opType === 'influence') return placeable(id);
    return false;
  }
  function onCountry(id: string) {
    if (!myTurn || p?.kind !== 'opType') return;
    if (opType === 'coup' && canCoup(state, id, perspective, false)) {
      dispatch({ type: 'coup', side: perspective, countryId: id });
      reset();
    } else if (opType === 'realign' && canRealign(state, id, perspective)) {
      setRealignSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < budget ? [...s, id] : s));
    } else if (opType === 'influence' && placeable(id)) {
      setPlacements((ps) => [...ps, { country: id, amount: 1 }]);
    }
  }

  // ---- play-card helpers ----
  function playEvent() {
    if (!selCard) return;
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'event' });
    reset();
  }
  function playOps() {
    if (!selCard) return;
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'ops' });
    reset();
  }
  function playScoring() {
    if (!selCard) return;
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'scoring' });
    reset();
  }
  function confirmInfluence() {
    dispatch({ type: 'placeInfluence', side: perspective, placements });
    reset();
  }
  function confirmRealign() {
    dispatch({ type: 'realign', side: perspective, countryIds: realignSel });
    reset();
  }
  function space() {
    dispatch({ type: 'space', side: perspective });
    reset();
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="exit" onClick={onExit}>← Menu</button>
        <Tracks state={state} />
        <button className="exit" onClick={() => { clearStoredSave(); restart(); }}>↻ Restart</button>
      </header>

      <main className="main">
        <Board state={state} onClickCountry={onCountry} highlight={highlight} />

        <aside className="sidebar">
          <div className="panel">
            {state.over ? (
              <>
                <h2>Game Over</h2>
                <p>Winner: <b className={state.over.winner === 'US' ? 'us' : 'ussr'}>{state.over.winner}</b></p>
                <small>{state.over.reason}</small>
              </>
            ) : !myTurn ? (
              <p className="hint">Waiting for {state.awaiting}…{aiSide ? ' (AI)' : ''}</p>
            ) : p?.kind === 'headline' ? (
              <>
                <h3>Headline Phase</h3>
                <p className="hint">{perspective}: choose a headline card from your hand.</p>
              </>
            ) : p?.kind === 'playCard' ? (
              <>
                <h3>{perspective}'s Action Round</h3>
                <p className="hint">{selCard ? `Selected: ${selCard === 'thechinacard' ? 'The China Card' : getCard(selCard).name}` : 'Pick a card from your hand.'}</p>
                {selCard && (
                  <div className="modes">
                    {isScoring(selCard) ? (
                      <button onClick={playScoring}>Play Scoring</button>
                    ) : (
                      <>
                        <button onClick={playEvent}>Play as Event</button>
                        <button onClick={playOps}>Play for Ops</button>
                      </>
                    )}
                    <button onClick={() => setSelCard(null)}>Cancel</button>
                  </div>
                )}
              </>
            ) : p?.kind === 'opType' ? (
              <>
                <h3>Spend {budget} Op{budget !== 1 ? 's' : ''}</h3>
                {!opType && (
                  <div className="modes">
                    <button onClick={() => setOpType('influence')}>Place Influence</button>
                    <button onClick={() => setOpType('coup')}>Coup</button>
                    <button onClick={() => setOpType('realign')}>Realignment</button>
                    <button disabled={!canAttemptSpace(state, perspective, budget)} onClick={space}>Space Race</button>
                  </div>
                )}
                {opType === 'influence' && (
                  <div>
                    <p className="hint">Click highlighted countries ({placements.length} placed, {placementCostUsed()}/{budget} spent).</p>
                    <div className="modes">
                      <button disabled={!placements.length} onClick={confirmInfluence}>Confirm</button>
                      <button onClick={() => setPlacements([])}>Clear</button>
                      <button onClick={() => setOpType(null)}>Back</button>
                    </div>
                  </div>
                )}
                {opType === 'coup' && <p className="hint">Click a country to coup. <button className="link" onClick={() => setOpType(null)}>Back</button></p>}
                {opType === 'realign' && (
                  <div>
                    <p className="hint">Click up to {budget} countries ({realignSel.length}).</p>
                    <div className="modes">
                      <button disabled={!realignSel.length} onClick={confirmRealign}>Confirm</button>
                      <button onClick={() => setOpType(null)}>Back</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="hint">…</p>
            )}
          </div>
          <Log state={state} />
        </aside>
      </main>

      <footer className="hand-area">
        <div className="hand-label">
          {mode === 'vsAI' ? `Your hand (${perspective})` : `Hand – ${perspective}`}
          {aiSide && state.awaiting === aiSide && <span className="thinking"> · AI thinking…</span>}
          {mode === 'hotseat' && !state.over && <span className="thinking"> · (pass device to {perspective})</span>}
        </div>
        <Hand state={state} perspective={perspective} onClickCard={onCard} selectedId={selCard} />
      </footer>
    </div>
  );
}

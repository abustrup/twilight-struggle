import { useEffect, useState, type CSSProperties } from 'react';
import { useGame, type Mode } from './ui/useGame';
import { Tracks, Board, Hand, Log, SideBadge, CardFace, PileView, startInf } from './ui/components';
import { Tutorial } from './ui/Tutorial';
import { clearStoredSave, loadFromStorage, saveToStorage, type RestoredSave } from './ui/persistence';
import type { Side } from './engine/data/cards';
import { getCard, isScoring } from './engine/data/cards';
import { COUNTRIES } from './engine/data/map';
import { controller } from './engine/core/control';
import { canCoup } from './engine/ops/coup';
import { canRealign } from './engine/ops/realignment';
import { canAttemptSpace } from './engine/ops/spacerace';
import type { Placement } from './engine/ops/influence';
import type { GameState } from './engine/state/types';

type OpType = 'influence' | 'coup' | 'realign' | 'space';
type HoverState = { id: string; rect: DOMRect } | null;
type HandTab = 'hand' | 'discard' | 'removed';

export function App() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [humanSide, setHumanSide] = useState<Side>('US');
  const [initialState, setInitialState] = useState<GameState | undefined>(undefined);
  const [storedSave, setStoredSave] = useState<RestoredSave | null>(() => {
    try { return loadFromStorage(); } catch { return null; }
  });

  if (tutorial) {
    return <Tutorial onExit={() => setTutorial(false)} />;
  }
  if (!mode) {
    return (
      <Menu
        storedSave={storedSave}
        onTutorial={() => setTutorial(true)}
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
  onTutorial,
}: {
  storedSave: RestoredSave | null;
  onResume: () => void;
  onPick: (m: Mode, s: Side) => void;
  onTutorial: () => void;
}) {
  const menuStyle = {
    '--map-image': `url("${import.meta.env.BASE_URL}ts-map.jpg")`,
  } as CSSProperties;

  return (
    <div className="menu" style={menuStyle}>
      <h1>Twilight Struggle</h1>
      <p className="subtitle">The Cold War 1945–1989</p>
      <div className="menu-buttons">
        <button className="primary" onClick={onTutorial}>▶ How to Play — Tutorial</button>
        {storedSave && <button onClick={onResume}>Continue Saved Game</button>}
        <button onClick={() => onPick('hotseat', 'US')}>Hotseat (2 players)</button>
        <button onClick={() => onPick('vsAI', 'US')}>Play vs AI – as US</button>
        <button onClick={() => onPick('vsAI', 'USSR')}>Play vs AI – as USSR</button>
      </div>
      <div className="menu-note">
        New to the game? Start with the <b>Tutorial</b> — it walks you through the
        board, influence and control, the four operations, DEFCON, and how to win,
        with hands-on practice. Otherwise jump straight into Hotseat or a match
        against the AI.
      </div>
    </div>
  );
}

// Floating thematic card face that follows the hovered card.
export function CardPreview({ id, rect }: { id: string; rect: DOMRect }) {
  const W = 272;
  const left = Math.max(10, Math.min(window.innerWidth - W - 10, rect.left + rect.width / 2 - W / 2));
  const bottom = Math.max(10, window.innerHeight - rect.top + 12);
  return (
    <div className="card-preview" style={{ left, bottom, width: W }}>
      <CardFace id={id} className="preview" />
    </div>
  );
}

function Game({ mode, humanSide, initialState, onExit }: { mode: Mode; humanSide: Side; initialState?: GameState; onExit: () => void }) {
  const { state, dispatch, perspective, aiSide, restart } = useGame(mode, humanSide, initialState);

  const [selCard, setSelCard] = useState<string | null>(null);
  const [opType, setOpType] = useState<OpType | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [realignSel, setRealignSel] = useState<string[]>([]);
  const [hover, setHover] = useState<HoverState>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [tab, setTab] = useState<HandTab>('hand');

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

  const onHover = (id: string | null, rect: DOMRect | null) => setHover(id && rect ? { id, rect } : null);

  return (
    <div className="app">
      <header className="app-header">
        <button className="exit" onClick={onExit}>← Menu</button>
        <SideBadge side="US" acting={state.awaiting === 'US' && !state.over} />
        <Tracks state={state} />
        <SideBadge side="USSR" acting={state.awaiting === 'USSR' && !state.over} />
        <button className="exit" onClick={() => { clearStoredSave(); restart(); }}>↻ Restart</button>
      </header>

      <main className="main">
        <Board state={state} onClickCountry={onCountry} highlight={highlight} />

        <aside className="sidebar">
          <div className="panel" data-tour="panel">
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
                <p className="hint">{perspective}: choose a headline card from your hand. Hover a card to see its full effect.</p>
              </>
            ) : p?.kind === 'playCard' ? (
              <>
                <h3>{perspective}'s Action Round</h3>
                <p className="hint">{selCard ? 'Choose how to play it:' : 'Pick a card from your hand. Hover any card to read it.'}</p>
                {selCard && (
                  <>
                    <CardFace id={selCard} className="panel-card" />
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
                  </>
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

          <div className={`log-drawer${logOpen ? ' open' : ''}`}>
            <button className="log-head" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
              <span>Game Log</span>
              <span className="log-chevron">{logOpen ? '▾' : '▸'}</span>
            </button>
            {logOpen && <Log state={state} />}
          </div>
        </aside>
      </main>

      <footer className="hand-area">
        <div className="hand-tabs">
          <button className={tab === 'hand' ? 'on' : ''} onClick={() => setTab('hand')}>
            {mode === 'vsAI' ? `Your Hand (${perspective})` : `Hand – ${perspective}`}
          </button>
          <button className={tab === 'discard' ? 'on' : ''} onClick={() => setTab('discard')}>Discard ({state.decks.discard.length})</button>
          <button className={tab === 'removed' ? 'on' : ''} onClick={() => setTab('removed')}>Removed ({state.decks.removed.length})</button>
          {aiSide && state.awaiting === aiSide && <span className="thinking"> · AI thinking…</span>}
          {mode === 'hotseat' && !state.over && tab === 'hand' && <span className="thinking"> · pass device to {perspective}</span>}
        </div>
        {tab === 'hand' && <Hand state={state} perspective={perspective} onClickCard={onCard} selectedId={selCard} onHover={onHover} />}
        {tab === 'discard' && <PileView ids={[...state.decks.discard].reverse()} empty="The discard pile is empty." onHover={onHover} />}
        {tab === 'removed' && <PileView ids={state.decks.removed} empty="No cards removed from the game yet." onHover={onHover} />}
      </footer>

      {hover && <CardPreview id={hover.id} rect={hover.rect} />}
    </div>
  );
}

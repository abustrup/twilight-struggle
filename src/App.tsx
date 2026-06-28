import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useGame, type Mode } from './ui/useGame';
import { Tracks, Board, Hand, Log, SideBadge, CardFace, PileView, startInf } from './ui/components';
import { Tutorial } from './ui/Tutorial';
import { playSound, isMuted, toggleMuted, onMuteChange } from './ui/sound';
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

function useMuted(): boolean {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(setM), []);
  return m;
}

function SoundButton() {
  const muted = useMuted();
  return (
    <button
      className="exit snd"
      title={muted ? 'Sound off — click to enable' : 'Sound on — click to mute'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => { toggleMuted(); playSound('ui'); }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

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
        <button className="primary" onClick={() => { playSound('ui'); onTutorial(); }}>▶ How to Play — Tutorial</button>
        {storedSave && <button onClick={() => { playSound('ui'); onResume(); }}>Continue Saved Game</button>}
        <button onClick={() => { playSound('ui'); onPick('hotseat', 'US'); }}>Hotseat (2 players)</button>
        <button onClick={() => { playSound('ui'); onPick('vsAI', 'US'); }}>Play vs AI – as US</button>
        <button onClick={() => { playSound('ui'); onPick('vsAI', 'USSR'); }}>Play vs AI – as USSR</button>
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
      <CardFace key={id} id={id} className="preview" flippable={false} />
      <div className="card-preview-rules">{getCard(id).text}</div>
    </div>
  );
}

function Game({ mode, humanSide, initialState, onExit }: { mode: Mode; humanSide: Side; initialState?: GameState; onExit: () => void }) {
  const { state, dispatch, perspective, aiSide, restart, undo, canUndo, gameId } = useGame(mode, humanSide, initialState);

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
  const sideKey: 'us' | 'ussr' = perspective === 'US' ? 'us' : 'ussr';

  useEffect(() => {
    saveToStorage(state, mode, humanSide);
  }, [state, mode, humanSide]);

  // Live influence shown on the board = committed state + pending placements,
  // so the country number/control updates the instant you click (before Confirm).
  const displayCountries = useMemo(() => {
    if (!placements.length) return state.countries;
    const copy: Record<string, { us: number; ussr: number }> = {};
    for (const k in state.countries) copy[k] = state.countries[k];
    for (const pl of placements) {
      copy[pl.country] = { ...copy[pl.country] };
      copy[pl.country][sideKey] += pl.amount;
    }
    return copy;
  }, [state.countries, placements, sideKey]);

  // Sound cues for state changes that aren't tied to a single human click
  // (DEFCON shifts, VP swings, game over) — covers AI moves and event fallout.
  const prevSnd = useRef({ id: gameId, defcon: state.defcon, vp: state.vp, over: !!state.over });
  useEffect(() => {
    const prev = prevSnd.current;
    // A restart bumps gameId: reseed the baseline so a fresh game (defcon 5,
    // vp 0) doesn't replay the previous game's DEFCON/VP cues.
    if (prev.id !== gameId) {
      prevSnd.current = { id: gameId, defcon: state.defcon, vp: state.vp, over: !!state.over };
      return;
    }
    if (state.defcon < prev.defcon) playSound('defconDown');
    else if (state.defcon > prev.defcon) playSound('defconUp');
    if (state.vp !== prev.vp) playSound('vp');
    if (state.over && !prev.over) {
      playSound(mode === 'vsAI' && state.over.winner !== perspective ? 'lose' : 'win');
    }
    prevSnd.current = { id: gameId, defcon: state.defcon, vp: state.vp, over: !!state.over };
  }, [state.defcon, state.vp, state.over, gameId, perspective, mode]);

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
      playSound('headline');
      dispatch({ type: 'pickHeadline', side: perspective, cardId: id });
    } else if (p.kind === 'playCard') {
      setSelCard((cur) => {
        const next = cur === id ? null : id;
        if (next) playSound('select');
        return next;
      });
    }
  }

  // ---- country highlight + click ----
  // Simulate the current pending placements to get the post-placement influence
  // map and the ops already spent (enemy-controlled countries cost 2, else 1).
  function simPlacements(): { sim: Record<string, { us: number; ussr: number }>; used: number } {
    const enemy: Side = perspective === 'US' ? 'USSR' : 'US';
    const sim: Record<string, { us: number; ussr: number }> = { ...state.countries };
    let used = 0;
    for (const pl of placements) {
      sim[pl.country] = { ...sim[pl.country] };
      used += controller(pl.country, sim[pl.country]) === enemy ? 2 : 1;
      if (perspective === 'US') sim[pl.country].us += 1; else sim[pl.country].ussr += 1;
    }
    return { sim, used };
  }
  function placementCostUsed(): number {
    return simPlacements().used;
  }
  function placeable(id: string): boolean {
    if (!myTurn || p?.kind !== 'opType' || opType !== 'influence') return false;
    const def = COUNTRIES[id];
    if (!def) return false;
    let reach = (perspective === 'US' && def.adjUS) || (perspective === 'USSR' && def.adjUSSR);
    if (!reach) for (const n of def.adj) if (COUNTRIES[n] && startInf(state)[n][perspective === 'US' ? 'us' : 'ussr'] > 0) reach = true;
    if (!reach) return false;
    // Budget check that includes the cost of THIS prospective placement, so a
    // 2-cost (enemy-controlled) target is only offered when 2 ops remain.
    const enemy: Side = perspective === 'US' ? 'USSR' : 'US';
    const { sim, used } = simPlacements();
    const marginal = controller(id, sim[id]) === enemy ? 2 : 1;
    return used + marginal <= budget;
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
      playSound('coup');
      dispatch({ type: 'coup', side: perspective, countryId: id });
      reset();
    } else if (opType === 'realign' && canRealign(state, id, perspective)) {
      setRealignSel((s) => {
        const has = s.includes(id);
        playSound(has ? 'ui' : 'select');
        return has ? s.filter((x) => x !== id) : s.length < budget ? [...s, id] : s;
      });
    } else if (opType === 'influence' && placeable(id)) {
      playSound(sideKey === 'us' ? 'placeUS' : 'placeUSSR');
      setPlacements((ps) => [...ps, { country: id, amount: 1 }]);
    } else if (opType === 'influence' || opType === 'coup' || opType === 'realign') {
      // clicked a non-eligible country — give a soft "can't do that" cue
      playSound('error');
    }
  }

  // ---- play-card helpers ----
  function playEvent() {
    if (!selCard) return;
    playSound('card');
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'event' });
    reset();
  }
  function playOps() {
    if (!selCard) return;
    playSound('card');
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'ops' });
    reset();
  }
  function playScoring() {
    if (!selCard) return;
    playSound('card');
    dispatch({ type: 'playCard', side: perspective, cardId: selCard, mode: 'scoring' });
    reset();
  }
  function confirmInfluence() {
    // Safety net: never commit (or play the success chime) for an over-budget
    // batch — the engine would reject it and silently drop the whole placement.
    if (!placements.length || placementCostUsed() > budget) { playSound('error'); return; }
    playSound('confirm');
    dispatch({ type: 'placeInfluence', side: perspective, placements });
    reset();
  }
  function confirmRealign() {
    playSound('realign');
    dispatch({ type: 'realign', side: perspective, countryIds: realignSel });
    reset();
  }
  function space() {
    playSound('space');
    dispatch({ type: 'space', side: perspective });
    reset();
  }

  const onHover = (id: string | null, rect: DOMRect | null) => setHover(id && rect ? { id, rect } : null);

  return (
    <div className="app">
      <header className="app-header">
        <button className="exit" onClick={() => { playSound('ui'); onExit(); }}>← Menu</button>
        <SideBadge side="US" acting={state.awaiting === 'US' && !state.over} />
        <Tracks state={state} />
        <SideBadge side="USSR" acting={state.awaiting === 'USSR' && !state.over} />
        <button className="exit" disabled={!canUndo} title="Undo the last move" onClick={() => { playSound('undo'); reset(); undo(); }}>↶ Undo</button>
        <SoundButton />
        <button className="exit" onClick={() => { playSound('ui'); clearStoredSave(); restart(); }}>↻ Restart</button>
      </header>

      <main className="main">
        <Board
          state={state}
          displayCountries={displayCountries}
          onClickCountry={onCountry}
          highlight={highlight}
          selected={(id) =>
            (opType === 'influence' && placements.some((pl) => pl.country === id)) ||
            (opType === 'realign' && realignSel.includes(id))
          }
        />

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
                <p className="hint">{perspective}: choose a headline card from your hand. Hover a card to preview it.</p>
              </>
            ) : p?.kind === 'playCard' ? (
              <>
                <h3>{perspective}'s Action Round</h3>
                <p className="hint">{selCard ? 'Choose how to play it — click the card to flip for its rules.' : 'Pick a card from your hand. Hover any card to preview it.'}</p>
                {selCard && (
                  <>
                    <CardFace key={selCard} id={selCard} className="panel-card" />
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
                    <button onClick={() => { playSound('ui'); setOpType('influence'); }}>Place Influence</button>
                    <button onClick={() => { playSound('ui'); setOpType('coup'); }}>Coup</button>
                    <button onClick={() => { playSound('ui'); setOpType('realign'); }}>Realignment</button>
                    <button disabled={!canAttemptSpace(state, perspective, budget)} onClick={space}>Space Race</button>
                  </div>
                )}
                {opType === 'influence' && (
                  <div>
                    <p className="hint">Click highlighted countries ({placements.length} placed, {placementCostUsed()}/{budget} spent).</p>
                    <div className="modes">
                      <button disabled={!placements.length} onClick={confirmInfluence}>Confirm</button>
                      <button disabled={!placements.length} onClick={() => { playSound('undo'); setPlacements((ps) => ps.slice(0, -1)); }}>↶ Undo</button>
                      <button disabled={!placements.length} onClick={() => { playSound('ui'); setPlacements([]); }}>Clear</button>
                      <button onClick={() => { playSound('ui'); setOpType(null); }}>Back</button>
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

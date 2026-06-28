import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type FocusEvent as ReactFocusEvent } from 'react';
import type { GameState } from '../engine/state/types';
import type { Side, Affiliation } from '../engine/data/cards';
import { getCard, isScoring, CHINA_CARD_ID } from '../engine/data/cards';
import { COUNTRIES, COUNTRY_IDS } from '../engine/data/map';
import { controller } from '../engine/core/control';
import { boxName } from '../engine/ops/spacerace';
import {
  BOARD_W, BOARD_H, NODE_W, NODE_H, LAYOUT, HQ,
  FLAGS, EDGES,
} from '../engine/data/boardLayout';

export function startInf(state: GameState): Record<string, { us: number; ussr: number }> {
  return (state as GameState & { _startInf?: Record<string, { us: number; ussr: number }> })._startInf ?? state.countries;
}

// Connection-line styles by type (from the map design).
const EDGE_STYLE: Record<string, { stroke: string; width: number; dash: string; op: number }> = {
  reg: { stroke: '#6f5c3c', width: 1.8, dash: '', op: 0.6 },
  sea: { stroke: '#cc2b1e', width: 1.8, dash: '7 6', op: 0.68 },
};

// Build the flag background CSS from the flag spec array.
function flagBg(f: string[] | undefined): string {
  if (!f || !f.length) return '#ccc';
  const d = f[0], cols = f.slice(1);
  if (d === 'solid') return cols[0] || '#ccc';
  const dir = d === 'v' ? 'to right' : 'to bottom';
  const n = cols.length;
  const stops = cols.map((c, i) => `${c} ${(i / n * 100).toFixed(1)}% ${((i + 1) / n * 100).toFixed(1)}%`).join(',');
  return `linear-gradient(${dir},${stops})`;
}

// Region code for a country (for coloring).
function regionCode(id: string): string {
  const def = COUNTRIES[id];
  const r = def.region;
  if (r === 'Europe') return 'eu';
  if (r === 'MiddleEast') return 'me';
  if (r === 'Africa') return 'af';
  if (r === 'Asia') return 'as';
  if (r === 'CentralAmerica') return 'ca';
  if (r === 'SouthAmerica') return 'sa';
  return 'eu';
}

// Soft region tints painted *behind* the influence number (kept subtle so the
// big number stays the dominant element).
const FIELD: Record<string, string> = {
  eu: 'rgba(195,177,225,0.30)', me: 'rgba(188,214,238,0.30)', af: 'rgba(240,227,168,0.32)',
  as: 'rgba(244,185,94,0.30)', ca: 'rgba(220,234,168,0.32)', sa: 'rgba(170,203,132,0.32)',
};

// ---------------- Superpower / neutral emblem (used in cards + status bar) ----------------
export function Emblem({ side, size = 26 }: { side: Affiliation; size?: number }) {
  if (side === 'USSR') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#7d1410" />
        <path d="M9 22c-1-4 2-7 6-7 1 0 1-1 0-1-3 0-6 2-6 5l-1-6 2 1c0-3 3-5 6-4 2 .6 3 3 2 5l3-2-1 3c2-1 4 1 3 3l-2-1c0 2-2 3-4 2" fill="#f4d878" />
        <path d="M19 8l1.2 2.5L23 11l-2 2 .5 2.7L19 14l-2.4 1.7.5-2.7-2-2 2.8-.5z" fill="#f4d878" />
      </svg>
    );
  }
  if (side === 'US') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#143a63" />
        <path d="M16 5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L16 24.3l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" fill="#eaf2ff" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#4a4f57" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#e8e2d2" strokeWidth="1.6" />
      <path d="M7 16h18M16 7v18M9.5 10.5c4 3 9 3 13 0M9.5 21.5c4-3 9-3 13 0" fill="none" stroke="#e8e2d2" strokeWidth="1.2" />
    </svg>
  );
}

// ---------------- Top status bar (tracks) ----------------
export function Tracks({ state }: { state: GameState }) {
  const vp = state.vp; // positive = US, negative = USSR
  const clamped = Math.max(-20, Math.min(20, vp));
  const usWidth = clamped > 0 ? (clamped / 20) * 50 : 0;
  const ussrWidth = clamped < 0 ? (-clamped / 20) * 50 : 0;
  return (
    <div className="statusbar" data-tour="tracks">
      <div className="sb-turn">
        <span className="sb-cap">Turn</span>
        <b>{state.turn > 10 ? 'F' : state.turn}<span className="sb-of">/10</span></b>
        <span className="sb-sub">Rd {state.actionRound} · <span className={state.phasing === 'US' ? 'us' : 'ussr'}>{state.phasing}</span></span>
      </div>

      <div className="sb-defcon" data-tour="defcon">
        <span className="sb-cap">DEFCON</span>
        <div className="defcon-ladder">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n} className={`dl dl-${n}${state.defcon === n ? ' on' : ''}`}>{n}</span>
          ))}
        </div>
      </div>

      <div className="sb-vp" data-tour="vp">
        <span className="sb-cap">Victory Points</span>
        <div className="vp-bar">
          <div className="vp-fill ussr" style={{ width: `${ussrWidth}%` }} />
          <div className="vp-fill us" style={{ width: `${usWidth}%` }} />
          <span className="vp-tick" />
          <span className="vp-num">{vp === 0 ? 'Tied 0' : vp > 0 ? `US +${vp}` : `USSR +${-vp}`}</span>
        </div>
      </div>

      <div className="sb-mini">
        <div><span>MilOps</span><b><span className="us">{state.milOps.US}</span> · <span className="ussr">{state.milOps.USSR}</span></b></div>
        <div><span>Space</span><b>{boxName(state.space.US.box)} · {boxName(state.space.USSR.box)}</b></div>
        <div><span>China</span><b className={state.chinaCard.holder === 'US' ? 'us' : 'ussr'}>{state.chinaCard.holder}{state.chinaCard.faceDown ? ' ↓' : ''}</b></div>
      </div>
    </div>
  );
}

export function SideBadge({ side, acting }: { side: Side; acting: boolean }) {
  const us = side === 'US';
  return (
    <div className={`side-badge ${us ? 'us' : 'ussr'}${acting ? ' acting' : ''}`}>
      <Emblem side={side} size={30} />
      <div className="sbg-text">
        <div className="sbg-name">{us ? 'USA' : 'USSR'}</div>
        <div className="sbg-sub">{acting ? 'Acting' : us ? 'United States' : 'Soviet Union'}</div>
      </div>
    </div>
  );
}

// ---------------- Board: world-map background + positioned country boxes ----------------
export function Board({
  state, onClickCountry, highlight,
}: {
  state: GameState;
  onClickCountry: (id: string) => void;
  highlight: (id: string) => boolean;
}) {
  const [zoom, setZoom] = useState(0.58);
  const mapSrc = `${import.meta.env.BASE_URL}ts-map.jpg`;

  return (
    <div className="board-wrap" data-tour="board">
      <div className="board-zoom">
        <button title="Zoom in" onClick={() => setZoom((z) => Math.min(1.1, +(z + 0.08).toFixed(2)))}>+</button>
        <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.32, +(z - 0.08).toFixed(2)))}>−</button>
        <button onClick={() => setZoom(0.55)}>Fit</button>
        <span className="zoom-val">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="board-scroll">
        <div className="board-canvas" style={{ width: BOARD_W * zoom, height: BOARD_H * zoom }}>
          <div className="board-inner" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: BOARD_W, height: BOARD_H }}>
            {/* world map background */}
            <img src={mapSrc} width={BOARD_W} height={BOARD_H} alt="" className="map-bg" draggable={false} />
            {/* vignette */}
            <div className="map-vignette" />

            {/* connection lines */}
            <svg className="map-lines" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} width={BOARD_W} height={BOARD_H}>
              {EDGES.map((e, i) => {
                const s = EDGE_STYLE[e.type] ?? EDGE_STYLE.reg;
                return <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" opacity={s.op} />;
              })}
            </svg>

            {/* HQ labels */}
            <HqLabel side="US" box={HQ.usa} />
            <HqLabel side="USSR" box={HQ.ussr} />

            {/* country boxes */}
            {COUNTRY_IDS.map((id) => {
              const p = LAYOUT[id];
              if (!p) return null;
              const def = COUNTRIES[id];
              const inf = state.countries[id];
              const ctrl = controller(id, inf);
              const hl = highlight(id);
              const rc = regionCode(id);
              const style = { left: p.x, top: p.y, width: NODE_W, height: NODE_H, '--field': FIELD[rc] } as CSSProperties;
              return (
                <div
                  key={id}
                  className={`country-box${hl ? ' hl' : ''}${def.battleground ? ' bg' : ''}${ctrl !== 'none' ? ` ctrl-${ctrl.toLowerCase()}` : ''}`}
                  style={style}
                  onClick={() => onClickCountry(id)}
                  title={`${def.name} · stability ${def.stability}${def.battleground ? ' · Battleground' : ''}`}
                >
                  <div className="cb-top">
                    <span className="cb-flag" style={{ background: flagBg(FLAGS[id]) }} />
                    <span className="cb-name">{def.name}</span>
                    {def.battleground && <span className="cb-star" title="Battleground">★</span>}
                    <span className="cb-stab">{def.stability}</span>
                  </div>
                  <div className="cb-nums">
                    {inf.ussr > 0 && <span className={`cb-num ussr${ctrl === 'USSR' ? ' on' : ''}`}>{inf.ussr}</span>}
                    {inf.us > 0 && <span className={`cb-num us${ctrl === 'US' ? ' on' : ''}`}>{inf.us}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HqLabel({ side, box }: { side: Side; box: { x: number; y: number; w: number; h: number } }) {
  const teal = side === 'US';
  return (
    <div className="hq-label" style={{ left: box.x, top: box.y, width: box.w }}>
      <div className="hq-emblem" style={{ borderColor: teal ? '#0c6e6e' : '#b8420c' }} />
      <div className="hq-name" style={{ color: teal ? '#0a5e5e' : '#7a2c06' }}>
        {teal ? 'UNITED STATES' : 'SOVIET UNION'}
      </div>
      <div className="hq-sub" style={{ background: teal ? '#0c6e6e' : '#b8420c' }}>
        {teal ? 'HQ – THE AMERICAS' : 'HQ – EURASIA'}
      </div>
    </div>
  );
}

// ---------------- Thematic full card face (used for hover preview + selected card) ----------------
export function CardFace({ id, className = '' }: { id: string; className?: string }) {
  const c = getCard(id);
  const sc = isScoring(id);
  const china = id === CHINA_CARD_ID;
  const sideClass = c.side === 'US' ? 'us' : c.side === 'USSR' ? 'ussr' : 'neutral';
  const opsLabel = sc ? '★' : String(c.ops);
  const banner = sc ? 'Scoring Card' : c.side === 'Neutral' ? 'Neutral Event' : `${c.side} Event`;
  return (
    <div className={`card-face side-${sideClass}${sc ? ' scoring' : ''} ${className}`}>
      <div className="cf-head">
        <span className="cf-ops" title="Operations value">{opsLabel}</span>
        <span className="cf-period">
          {c.war} War{c.optional ? ' · Optional' : ''}
          {c.starred && <span className="cf-removed" title="Removed from the game after the event"> · ★ once</span>}
        </span>
      </div>
      <div className={`cf-art art-${sideClass}`}>
        <Emblem side={c.side} size={54} />
        <span className="cf-num">{china ? '#6' : `#${c.number}`}</span>
      </div>
      <div className="cf-title">{c.name}</div>
      <div className="cf-banner">{banner}</div>
      <div className="cf-text">{c.text}</div>
    </div>
  );
}

// ---------------- Hand (with hover preview reporting) ----------------
export function Hand({
  state, perspective, onClickCard, selectedId, onHover,
}: {
  state: GameState;
  perspective: Side;
  onClickCard: (id: string) => void;
  selectedId?: string | null;
  onHover?: (id: string | null, rect: DOMRect | null) => void;
}) {
  const hand = state.hands[perspective];
  const hasChina = state.chinaCard.holder === perspective && !state.chinaCard.faceDown;
  function report(id: string | null, e?: ReactMouseEvent | ReactFocusEvent) {
    if (!onHover) return;
    const rect = id && e ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null;
    onHover(id, rect);
  }
  return (
    <div className="hand" data-tour="hand">
      {hand.length === 0 && !hasChina && <div className="hand-empty">No cards in hand.</div>}
      {hand.map((id) => {
        const c = getCard(id);
        const sc = isScoring(id);
        return (
          <button
            key={id}
            className={`card side-${c.side.toLowerCase()} ${selectedId === id ? 'sel' : ''}`}
            onClick={() => onClickCard(id)}
            onMouseEnter={(e) => report(id, e)}
            onMouseLeave={() => report(null)}
            onFocus={(e) => report(id, e)}
            onBlur={() => report(null)}
          >
            <div className="card-ops">{sc ? '★' : c.ops}</div>
            <div className="card-text">
              <div className="card-name">{c.name}</div>
              <div className="card-tag">{sc ? 'Scoring' : `${c.war} · ${c.side}`}{c.starred ? ' ·★' : ''}</div>
            </div>
          </button>
        );
      })}
      {hasChina && (
        <button
          className={`card side-neutral china ${selectedId === CHINA_CARD_ID ? 'sel' : ''}`}
          onClick={() => onClickCard(CHINA_CARD_ID)}
          onMouseEnter={(e) => report(CHINA_CARD_ID, e)}
          onMouseLeave={() => report(null)}
          onFocus={(e) => report(CHINA_CARD_ID, e)}
          onBlur={() => report(null)}
        >
          <div className="card-ops">4</div>
          <div className="card-text">
            <div className="card-name">The China Card</div>
            <div className="card-tag">+1 bonus Op</div>
          </div>
        </button>
      )}
    </div>
  );
}

// Read-only viewer for discard / removed piles (shows card faces on hover too).
export function PileView({ ids, empty, onHover }: {
  ids: string[];
  empty: string;
  onHover?: (id: string | null, rect: DOMRect | null) => void;
}) {
  function report(id: string | null, e?: ReactMouseEvent | ReactFocusEvent) {
    if (!onHover) return;
    onHover(id, id && e ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null);
  }
  if (!ids.length) return <div className="hand"><div className="hand-empty">{empty}</div></div>;
  return (
    <div className="hand">
      {ids.map((id, i) => {
        const c = getCard(id);
        const sc = isScoring(id);
        return (
          <div
            key={`${id}-${i}`}
            className={`card pile side-${c.side.toLowerCase()}`}
            tabIndex={0}
            onMouseEnter={(e) => report(id, e)}
            onMouseLeave={() => report(null)}
            onFocus={(e) => report(id, e)}
            onBlur={() => report(null)}
          >
            <div className="card-ops">{sc ? '★' : c.ops}</div>
            <div className="card-text">
              <div className="card-name">{c.name}</div>
              <div className="card-tag">{sc ? 'Scoring' : `${c.war} · ${c.side}`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Log (collapsible drawer handled by parent) ----------------
export function Log({ state }: { state: GameState }) {
  const recent = useMemo(() => state.log.slice(-80).reverse(), [state.log]);
  return (
    <div className="log">
      {recent.length === 0 && <div className="log-empty">No events yet.</div>}
      {recent.map((l) => (
        <div key={l.ts} className={`log-row ${l.side ? l.side.toLowerCase() : ''}`}>{l.text}</div>
      ))}
    </div>
  );
}

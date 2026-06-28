import { useMemo, useState } from 'react';
import type { GameState } from '../engine/state/types';
import type { Side } from '../engine/data/cards';
import { getCard, isScoring, CHINA_CARD_ID } from '../engine/data/cards';
import { COUNTRIES, COUNTRY_IDS } from '../engine/data/map';
import { controller } from '../engine/core/control';
import { canCoup } from '../engine/ops/coup';
import { canRealign } from '../engine/ops/realignment';
import { boxName } from '../engine/ops/spacerace';
import {
  BOARD_W, BOARD_H, NODE_W, NODE_H, LAYOUT, HQ, REGION_COLOR, REGION_KEY,
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

// ---------------- Top status bar (tracks) ----------------
export function Tracks({ state }: { state: GameState }) {
  return (
    <div className="tracks">
      <div className="track"><span>Turn</span><b>{state.turn > 10 ? 'Final' : state.turn}/10</b></div>
      <div className="track"><span>Act Rd</span><b>{state.actionRound}</b></div>
      <div className="track"><span>Phasing</span><b className={state.phasing === 'US' ? 'us' : 'ussr'}>{state.phasing}</b></div>
      <div className="track defcon"><span>DEFCON</span><b className={`def-${state.defcon}`}>{state.defcon}</b></div>
      <div className="track vp"><span>VP</span><b className={state.vp >= 0 ? 'us' : 'ussr'}>{state.vp > 0 ? '+' : ''}{state.vp}</b></div>
      <div className="track"><span>MilOps</span><b>{state.milOps.US}/{state.milOps.USSR}</b></div>
      <div className="track"><span>Space</span><b>{boxName(state.space.US.box)} · {boxName(state.space.USSR.box)}</b></div>
      <div className="track"><span>China</span><b className={state.chinaCard.holder === 'US' ? 'us' : 'ussr'}>{state.chinaCard.holder}{state.chinaCard.faceDown ? '↓' : ''}</b></div>
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
  const [zoom, setZoom] = useState(0.54);
  const mapSrc = `${import.meta.env.BASE_URL}ts-map.jpg`;

  return (
    <div className="board-wrap">
      <div className="board-zoom">
        <button title="Zoom in" onClick={() => setZoom((z) => Math.min(1.1, +(z + 0.1).toFixed(2)))}>+</button>
        <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.32, +(z - 0.1).toFixed(2)))}>−</button>
        <button onClick={() => setZoom(0.5)}>Fit</button>
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
              const field = REGION_COLOR[rc];
              const bgFill = def.battleground
                ? `repeating-linear-gradient(45deg,rgba(184,42,20,.18) 0 5px,rgba(184,42,20,0) 5px 11px),${field}`
                : field;
              const border = def.battleground ? '2.5px solid #b8420c' : '1px solid #8a7d5e';
              return (
                <div
                  key={id}
                  className={`country-box${hl ? ' hl' : ''}${ctrl !== 'none' ? ` ctrl-${ctrl.toLowerCase()}` : ''}`}
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, border, background: bgFill }}
                  onClick={() => onClickCountry(id)}
                  title={`${def.name} · stability ${def.stability}${def.battleground ? ' · Battleground' : ''}`}
                >
                  <div className="country-hdr">
                    <div className="country-flag" style={{ background: flagBg(FLAGS[id]) }} />
                    <span className="country-name">{def.name}</span>
                    <span className="country-stab">{def.stability}</span>
                  </div>
                  <div className="country-body">
                    {inf.us > 0 && <div className="inf inf-us">{inf.us}</div>}
                    {inf.ussr > 0 && <div className="inf inf-ussr">{inf.ussr}</div>}
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

// ---------------- Hand ----------------
export function Hand({
  state, perspective, onClickCard, selectedId,
}: {
  state: GameState;
  perspective: Side;
  onClickCard: (id: string) => void;
  selectedId?: string | null;
}) {
  const hand = state.hands[perspective];
  const hasChina = state.chinaCard.holder === perspective && !state.chinaCard.faceDown;
  return (
    <div className="hand">
      {hand.map((id) => {
        const c = getCard(id);
        const sc = isScoring(id);
        return (
          <button
            key={id}
            className={`card side-${c.side.toLowerCase()} ${selectedId === id ? 'sel' : ''}`}
            onClick={() => onClickCard(id)}
            title={c.text}
          >
            <div className="card-ops">{sc ? 'S' : c.ops}</div>
            <div className="card-name">{c.name}{c.starred ? ' *' : ''}</div>
          </button>
        );
      })}
      {hasChina && (
        <button className={`card side-neutral ${selectedId === CHINA_CARD_ID ? 'sel' : ''}`} onClick={() => onClickCard(CHINA_CARD_ID)}>
          <div className="card-ops">4</div>
          <div className="card-name">The China Card</div>
        </button>
      )}
    </div>
  );
}

// ---------------- Log ----------------
export function Log({ state }: { state: GameState }) {
  const recent = useMemo(() => state.log.slice(-60).reverse(), [state.log]);
  return (
    <div className="log">
      {recent.map((l) => (
        <div key={l.ts} className={`log-row ${l.side ? l.side.toLowerCase() : ''}`}>{l.text}</div>
      ))}
    </div>
  );
}

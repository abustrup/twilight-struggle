import { useMemo, useState, type CSSProperties, type ReactElement, type MouseEvent as ReactMouseEvent, type FocusEvent as ReactFocusEvent } from 'react';
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

// ---------------- Thematic card art (from the Art Bible handoff) ----------------
// Card art lives in /public/cards/<id>.png at 512x512; until a file exists a
// geometric duotone Motif stands in, so art can ship incrementally.
type Kind = 'us' | 'ussr' | 'neutral' | 'scoring' | 'china';
type MotifKind =
  | 'star' | 'sickle' | 'rings' | 'globe' | 'grid'
  | 'bars' | 'burst' | 'cross' | 'flag' | 'chevron' | 'wall';

/** Points for an n=5 star, centred on (cx,cy). */
function starPoints(cx: number, cy: number, ro: number, ri: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

// ---------------- Superpower / neutral emblem (used in cards + status bar) ----------------
export function Emblem({ side, size = 26 }: { side: Affiliation; size?: number }) {
  const ring = side === 'US' ? '#143a63' : side === 'USSR' ? '#7d1410' : '#4a4f57';
  const glyph = side === 'US' ? '#eef4ff' : side === 'USSR' ? '#f4d878' : '#e8e2d2';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="ts-emblem">
      <circle cx="16" cy="16" r="15" fill={ring} />
      <circle cx="16" cy="16" r="13" fill="none" stroke={glyph} strokeWidth="0.5" opacity="0.45" />
      {side === 'USSR' ? (
        <>
          <path d="M9 22c-1-4 2-7 6-7 1 0 1-1 0-1-3 0-6 2-6 5l-1-6 2 1c0-3 3-5 6-4 2 .6 3 3 2 5l3-2-1 3c2-1 4 1 3 3l-2-1c0 2-2 3-4 2" fill={glyph} />
          <path d="M19 8l1.2 2.5L23 11l-2 2 .5 2.7L19 14l-2.4 1.7.5-2.7-2-2 2.8-.5z" fill={glyph} />
        </>
      ) : side === 'Neutral' ? (
        <>
          <circle cx="16" cy="16" r="8.5" fill="none" stroke={glyph} strokeWidth="1.4" />
          <path d="M7.5 16h17M16 7.5v17M9.6 10.8c4 2.6 8.8 2.6 12.8 0M9.6 21.2c4-2.6 8.8-2.6 12.8 0" fill="none" stroke={glyph} strokeWidth="1.1" />
        </>
      ) : (
        <polygon points={starPoints(16, 16, 9.6, 3.9)} fill={glyph} />
      )}
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
  state, onClickCountry, highlight, displayCountries, selected,
}: {
  state: GameState;
  onClickCountry: (id: string) => void;
  highlight: (id: string) => boolean;
  // Optional override of the influence shown (e.g. live pending placements) so
  // the board updates instantly before the move is committed to the engine.
  displayCountries?: Record<string, { us: number; ussr: number }>;
  // Marks a country as picked/pending (pending influence or realign selection).
  selected?: (id: string) => boolean;
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
              const inf = (displayCountries ?? state.countries)[id];
              const ctrl = controller(id, inf);
              const hl = highlight(id);
              const sel = selected?.(id) ?? false;
              const rc = regionCode(id);
              const style = { left: p.x, top: p.y, width: NODE_W, height: NODE_H, '--field': FIELD[rc] } as CSSProperties;
              return (
                <div
                  key={id}
                  className={`country-box${hl ? ' hl' : ''}${sel ? ' sel' : ''}${def.battleground ? ' bg' : ''}${ctrl !== 'none' ? ` ctrl-${ctrl.toLowerCase()}` : ''}`}
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
                    {/* keyed by value so the number re-mounts and replays the pop animation the instant influence changes */}
                    {inf.ussr > 0 && <span key={`s${inf.ussr}`} className={`cb-num ussr${ctrl === 'USSR' ? ' on' : ''}`}>{inf.ussr}</span>}
                    {inf.us > 0 && <span key={`a${inf.us}`} className={`cb-num us${ctrl === 'US' ? ' on' : ''}`}>{inf.us}</span>}
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

// ---------------- Thematic two-sided card face (hover preview + selected card) ----------------
/** Fallback subject per card id, used until the 512x512 illustration ships.
    Generated from cards-art.json — keep in sync with the art manifest. */
const CARD_MOTIF: Record<string, MotifKind> = {
  'asiascoring': 'globe', 'europescoring': 'globe', 'mideastscoring': 'globe',
  'duckandcover': 'rings', 'fiveyearplan': 'bars', 'thechinacard': 'star',
  'socialistgovs': 'sickle', 'fidel': 'star', 'vietnamrevolts': 'burst',
  'blockade': 'wall', 'koreanwar': 'chevron', 'romanianabdication': 'star',
  'arabisraeliwar': 'chevron', 'comecon': 'grid', 'nasser': 'star',
  'warsawpact': 'grid', 'degaulle': 'flag', 'capturednazi': 'burst',
  'trumandoctrine': 'globe', 'olympicgames': 'burst', 'nato': 'star',
  'independentreds': 'star', 'marshallplan': 'bars', 'indopakiwar': 'chevron',
  'containment': 'rings', 'ciacreated': 'cross', 'usjapan': 'flag',
  'suezcrisis': 'chevron', 'easteurunrest': 'burst', 'decolonization': 'globe',
  'redscare': 'cross', 'unintervention': 'globe', 'destalinization': 'bars',
  'nucleartestban': 'rings', 'formosan': 'flag', 'brushwar': 'chevron',
  'camscoring': 'globe', 'seascoring': 'globe', 'armsrace': 'bars',
  'cubanmissile': 'rings', 'nuclearsubs': 'rings', 'quagmire': 'cross',
  'salt': 'rings', 'beartrap': 'cross', 'summit': 'grid', 'worrying': 'burst',
  'junta': 'chevron', 'kitchendebates': 'grid', 'missileenvy': 'bars',
  'wewillburyyou': 'burst', 'brezhnev': 'star', 'portugalempire': 'globe',
  'southafricanunrest': 'burst', 'allende': 'star', 'willybrandt': 'flag',
  'muslimrevolution': 'burst', 'abm': 'rings', 'culturalrevolution': 'star',
  'flowerpower': 'burst', 'u2incident': 'cross', 'opec': 'bars',
  'lonegunman': 'cross', 'colonialrearguards': 'globe', 'panamacanal': 'rings',
  'campdavid': 'flag', 'puppetgovs': 'grid', 'grainsales': 'bars',
  'johnpaul': 'burst', 'deathsquads': 'cross', 'oasfounded': 'star',
  'nixonchina': 'star', 'sadatexpels': 'flag', 'shuttlediplomacy': 'globe',
  'voiceofamerica': 'burst', 'liberationtheology': 'star', 'ussuri': 'chevron',
  'asknot': 'star', 'allianceforprogress': 'bars', 'africascoring': 'globe',
  'onesmallstep': 'burst', 'sascoring': 'globe', 'iranianhostage': 'cross',
  'ironlady': 'globe', 'reaganlibya': 'burst', 'starwars': 'rings',
  'northseaoil': 'bars', 'reformer': 'star', 'marinebarracks': 'burst',
  'kal007': 'cross', 'glasnost': 'burst', 'ortega': 'star', 'terrorism': 'burst',
  'irancontra': 'grid', 'chernobyl': 'rings', 'debtcrisis': 'bars',
  'teardown': 'wall', 'evilempire': 'star', 'aldrichames': 'cross',
  'pershing2': 'rings', 'wargames': 'cross', 'solidarity': 'flag',
  'iraniraqwar': 'chevron', 'defectors': 'cross', 'optional-cambridgefive': 'cross',
  'optional-specialrelationship': 'flag', 'optional-norad': 'rings',
  'optional-che': 'star', 'optional-ourmanintehran': 'cross',
  'optional-yuriandsamantha': 'globe', 'optional-awacs': 'rings',
};

function Motif({ kind }: { kind: MotifKind }) {
  const common = { viewBox: '0 0 100 100', className: 'ts-motif', 'aria-hidden': true } as const;
  switch (kind) {
    case 'star':
      return <svg {...common}><polygon points={starPoints(50, 50, 46, 19)} fill="currentColor" opacity={0.92} /></svg>;
    case 'sickle':
      return (
        <svg viewBox="0 0 32 32" className="ts-motif" aria-hidden>
          <path d="M9 22c-1-4 2-7 6-7 1 0 1-1 0-1-3 0-6 2-6 5l-1-6 2 1c0-3 3-5 6-4 2 .6 3 3 2 5l3-2-1 3c2-1 4 1 3 3l-2-1c0 2-2 3-4 2" fill="currentColor" />
          <path d="M19 8l1.2 2.5L23 11l-2 2 .5 2.7L19 14l-2.4 1.7.5-2.7-2-2 2.8-.5z" fill="currentColor" />
        </svg>
      );
    case 'rings':
      return (
        <svg {...common}>
          {[42, 30, 18].map((r) => <circle key={r} cx={50} cy={50} r={r} fill="none" stroke="currentColor" strokeWidth={2.6} opacity={0.85} />)}
          <line x1={50} y1={2} x2={50} y2={98} stroke="currentColor" strokeWidth={1.3} opacity={0.55} />
          <line x1={2} y1={50} x2={98} y2={50} stroke="currentColor" strokeWidth={1.3} opacity={0.55} />
          <circle cx={50} cy={50} r={4.5} fill="currentColor" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx={50} cy={50} r={44} fill="none" stroke="currentColor" strokeWidth={2.4} />
          <ellipse cx={50} cy={50} rx={44} ry={17} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.75} />
          <ellipse cx={50} cy={50} rx={44} ry={33} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.5} />
          <ellipse cx={50} cy={50} rx={17} ry={44} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.75} />
          <ellipse cx={50} cy={50} rx={33} ry={44} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.5} />
          <line x1={6} y1={50} x2={94} y2={50} stroke="currentColor" strokeWidth={1.6} opacity={0.8} />
          <line x1={50} y1={6} x2={50} y2={94} stroke="currentColor" strokeWidth={1.6} opacity={0.8} />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          {Array.from({ length: 36 }, (_, i) => {
            const r = Math.floor(i / 6), c = i % 6;
            return <circle key={i} cx={13 + c * 14.8} cy={13 + r * 14.8} r={3.6} fill="currentColor" opacity={0.8} />;
          })}
        </svg>
      );
    case 'bars':
      return <svg {...common}>{[46, 72, 34, 84, 58].map((h, i) => <rect key={i} x={7 + i * 18} y={92 - h} width={12} height={h} rx={1} fill="currentColor" opacity={0.86} />)}</svg>;
    case 'burst':
      return (
        <svg {...common}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI * 2 / 12) * i;
            return <line key={i} x1={50} y1={50} x2={+(50 + 47 * Math.cos(a)).toFixed(1)} y2={+(50 + 47 * Math.sin(a)).toFixed(1)} stroke="currentColor" strokeWidth={2.3} opacity={0.82} />;
          })}
          <circle cx={50} cy={50} r={9} fill="currentColor" />
        </svg>
      );
    case 'cross':
      return (
        <svg {...common}>
          <circle cx={50} cy={50} r={40} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.5} />
          <line x1={50} y1={4} x2={50} y2={96} stroke="currentColor" strokeWidth={2.6} />
          <line x1={4} y1={50} x2={96} y2={50} stroke="currentColor" strokeWidth={2.6} />
          <circle cx={50} cy={50} r={8} fill="none" stroke="currentColor" strokeWidth={2.6} />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <line x1={27} y1={6} x2={27} y2={94} stroke="currentColor" strokeWidth={4} opacity={0.9} />
          <circle cx={27} cy={7} r={4} fill="currentColor" />
          <rect x={27} y={14} width={50} height={24} fill="currentColor" opacity={0.86} />
          <rect x={27} y={44} width={34} height={9} fill="currentColor" opacity={0.5} />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          {[0, 1, 2].map((i) => {
            const y = 28 + i * 19;
            return <polyline key={i} points={`18,${y} 50,${y + 20} 82,${y}`} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />;
          })}
        </svg>
      );
    case 'wall': {
      const out: ReactElement[] = [];
      [14, 31, 48, 65, 82].forEach((y, r) => {
        const off = r % 2 ? -11 : 0;
        for (let x = off; x < 100; x += 22) {
          if (r >= 1 && r <= 3 && x + 10 > 42 && x + 10 < 60) continue; // a breach in the wall
          out.push(<rect key={`${r}_${x}`} x={x + 1} y={y} width={20} height={15} rx={1} fill="currentColor" opacity={0.8} />);
        }
      });
      return <svg {...common}>{out}</svg>;
    }
    default:
      return <svg {...common} />;
  }
}

function cardKind(c: ReturnType<typeof getCard>): Kind {
  if (c.id === CHINA_CARD_ID) return 'china';
  if (c.scoring) return 'scoring';
  return c.side === 'US' ? 'us' : c.side === 'USSR' ? 'ussr' : 'neutral';
}

/**
 * Thematic, two-sided event card.
 *   Front — faction duotone art slot (/public/cards/<id>.png, falling back to a
 *           geometric motif) + ops medallion + letterpress title.
 *   Back  — full rules text on a faction header. Click flips between them.
 * Pass `flippable={false}` for a static, front-only preview (hover tooltip).
 */
export function CardFace({
  id,
  className = '',
  flippable = true,
}: {
  id: string;
  className?: string;
  flippable?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const c = getCard(id);
  const kind = cardKind(c);
  const ops = isScoring(id) ? '★' : String(c.ops);
  const period = `#${c.number} · ${c.war.toUpperCase()} WAR${c.starred ? ' · ★' : ''}${c.optional ? ' · OPT' : ''}`;
  const banner = c.scoring
    ? 'Scoring Card'
    : kind === 'china'
      ? 'Special · China'
      : c.side === 'Neutral'
        ? 'Neutral Event'
        : `${c.side} Event`;
  const artSrc = `${import.meta.env.BASE_URL}cards/${id}.png`;

  return (
    <div
      className={`tsf ${flipped ? 'is-flipped' : ''} ${className}`.trim()}
      data-kind={kind}
      role={flippable ? 'button' : undefined}
      tabIndex={flippable ? 0 : undefined}
      aria-pressed={flippable ? flipped : undefined}
      aria-label={flippable ? `${c.name} — press to flip ${flipped ? 'to the front' : 'for its rules'}` : undefined}
      onClick={flippable ? () => setFlipped((f) => !f) : undefined}
      onKeyDown={flippable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
      } : undefined}
    >
      <div className="tsf-inner">
        {/* Back is painted first so the opaque front always wins flat captures. */}
        <div className="tsf-face tsf-back">
          <div className="tsf-back-head">
            <span className="tsf-back-ops">{ops}</span>
            <div>
              <div className="tsf-back-name">{c.name}</div>
              <div className="tsf-back-period">{period}</div>
            </div>
          </div>
          <div className="tsf-rules">{c.text}</div>
          <div className="tsf-back-banner">{banner}</div>
        </div>

        <div className="tsf-face tsf-front">
          <div className="tsf-slot">
            <Motif kind={CARD_MOTIF[id] ?? 'globe'} />
            <img
              className="tsf-img"
              src={artSrc}
              alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="tsf-ops">{ops}</span>
            <span className="tsf-period">{period}</span>
          </div>
          <div className="tsf-plate">
            <div className="tsf-rule" />
            <div className="tsf-title">{c.name}</div>
            <div className="tsf-banner">{banner}</div>
          </div>
        </div>
      </div>
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

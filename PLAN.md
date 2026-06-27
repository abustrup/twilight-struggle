# Twilight Struggle — Digital Edition: Development Plan

A faithful, full-implementation of the GMT board game *Twilight Struggle* (Deluxe/2nd Edition rules),
as a web game: **React + TypeScript**, **server-authoritative online play**, and an **AI opponent**.

- **Stack:** React + Vite + TypeScript frontend · Node + TypeScript engine + Socket.IO server · monorepo
- **Modes:** Online (2 humans, server holds hidden info) · vs AI · hotseat (free, uses same engine)
- **Scope:** Full game — all 110 cards, all 10 turns, all victory conditions, all subsystems.

---

## 0. Critical data gap (read first)

The rules file (`TS_Rules_Deluxe.md`) gives us **complete rules + historical flavor**, but is **not** a usable
card/map database. Specifically, it lacks, in machine-usable form:

1. **All 110 cards** — only ~partial data is embedded (the "Card Histories" prose + some card-text scraped from
   images in the example of play). The provided `All cards.numbers` file is a proprietary Apple Numbers spreadsheet
   and cannot be directly parsed by the system. Therefore, the card data remains a manual sourcing task. We need, for every card: `id, name, ops, side(US/USSR/Neutral),
   war(Early/Mid/Late), starred(asterisk=remove), scoring(bool), event text, implementation key`.
2. **The map** — ~75 countries, each with: `id, name, region, subregion, stability, battleground(bool),
   adjacency list, connections to USSR/US, in-Southeast-Asia(bool)`. The map image has been provided and is described below for integration into `data/map.ts`.

**Resolution:** Build two clean, versioned datasets and treat them as source of truth:
- `data/cards.ts` — the 110 cards (Early: ~35, Mid: ~40, Late: ~35, incl. optional cards & The China Card).
- `data/map.ts` — countries, regions, adjacency.

Data sources to cross-reference against: the rules file itself, the in-book *Extended Example of Play*
(which names many Early War cards and their ops, and lists country control states), and the well-known public
TS card/map reference. The engine and every event implementation will be validated against these datasets via tests.

> Because a wrong ops value, adjacency, or stability silently corrupts the whole game, **the data files get the
> highest test coverage in the project** (golden tests + property checks).

### Map Description for Non-Image Model (for `data/map.ts` construction)

The game board is a stylized world map, divided into six main regions, each with a distinct background color and its own scoring area on the main board: Europe (purple), Asia (orange), Middle East (beige), Central America (light green), South America (dark green), and Africa (yellow/brown).

**Key Board Elements:**

1.  **Country Spaces:** Each country is represented by a named rectangular space with a flag and a "Stability Number" (a white number in a colored box, usually white, purple for Battlegrounds).
    *   **Battleground Countries:** Have their names highlighted in purple and a purple stability number box. These are crucial for scoring and coup attempts.
    *   **Non-Battleground Countries:** Have white names and white stability number boxes.
    *   **Influence Markers:** Not shown by default, but spaces are designed to hold circular influence markers for the US (blue) and USSR (red).

2.  **Connections:** Countries are linked by lines, indicating adjacency:
    *   **Brown Lines:** Connect countries *within* a region.
    *   **Red Dashed Lines:** Connect countries *between* different regions.
    *   **Black Lines:** Connect countries to one of the superpowers (USA or USSR home country spaces).

3.  **Superpower Home Countries:**
    *   **USA:** Large area in North America, labeled "U.S.A.". Connected to Mexico, Canada, Cuba.
    *   **USSR:** Large area in Eurasia, labeled "U.S.S.R.". Connected to Finland, East Germany, Poland, Czechoslovakia, Romania, Afghanistan, North Korea.
    *   These are not playable for influence but provide adjacency.

4.  **Regions and Sub-regions:**

    *   **Europe (Purple):**
        *   **Western Europe (Lighter Purple Sub-region):** UK (5), France (3), Benelux (3), West Germany (4), Italy (4), Spain/Portugal (2), Denmark (3), Norway (4), Sweden (4).
        *   **Eastern Europe (Darker Purple Sub-region):** East Germany (3), Poland (3), Czechoslovakia (3), Hungary (3), Romania (3), Bulgaria (3), Yugoslavia (3).
        *   **Shared European Countries:** Austria (4), Finland (4) (These are depicted visually within both Western and Eastern Europe and connected to both).
        *   **Middle Eastern Countries in Europe Region (for adjacency only):** Turkey (2), Greece (2). (This is a design note from the rulebook, map shows them linked to Europe but physically distinct).
        *   **African/Middle Eastern Countries connected to Europe (but not in Europe region):** Morocco (3), Algeria (2), Tunisia (2), Libya (2), Egypt (2), Syria (2), Lebanon (1), Israel (4), Jordan (2).

    *   **Asia (Orange):**
        *   **Countries:** Afghanistan (2), Pakistan (2), India (3), Burma (2), South Korea (3), Japan (4), Taiwan (3), Philippines (2), Australia (4), Indonesia (1), Malaysia (2), Laos/Cambodia (1), Thailand (2), Vietnam (1).
        *   **Southeast Asia (Greenish-Orange Sub-region):** Burma (2), Laos/Cambodia (1), Thailand (2), Vietnam (1), Malaysia (2), Indonesia (1), Philippines (2). (Note: rulebook states Philippines and Indonesia are in SE Asia for scoring, but map visually places Indonesia and Malaysia directly in SE Asia. Philippines is adjacent to SE Asia.)
        *   **Special:** China Civil War space (P:3), initially held by USSR; provides ops bonus when ops spent entirely in Asia.

    *   **Middle East (Beige):**
        *   **Countries:** Libya (2), Egypt (2), Sudan (1), Ethiopia (1), Somalia (2), Israel (4), Lebanon (1), Syria (2), Jordan (2), Iraq (3), Iran (2), Gulf States (3), Saudi Arabia (3).
        *   (Note: map shows connections to Africa and Europe from Middle East countries).

    *   **Central America (Light Green):**
        *   **Countries:** Mexico (2), Guatemala (1), El Salvador (1), Honduras (2), Nicaragua (1), Costa Rica (3), Panama (2), Cuba (3), Haiti (1), Dominican Republic (1), Venezuela (2), Colombia (1), Ecuador (2).

    *   **South America (Dark Green):**
        *   **Countries:** Colombia (1), Ecuador (2), Peru (2), Bolivia (2), Chile (3), Argentina (2), Paraguay (2), Uruguay (2), Brazil (2).

    *   **Africa (Yellow/Brown):**
        *   **Countries:** West African States (2), Morocco (3), Algeria (2), Tunisia (2), Libya (2), Egypt (2), Saharan States (1), Nigeria (1), Ivory Coast (2), Cameroon (1), Zaire (1), Kenya (2), Ethiopia (1), Sudan (1), Somalia (2), South Africa (3), Zimbabwe (1), Angola (1), Botswana (2), SE African States (1).

**Tracks:**

*   **Action Round Track:** Numeric sequence 1-8, indicating the current Action Round.
*   **Turn Record Track:** Images of leaders, indicating Early War (Turns 1-3), Mid War (Turns 4-7), Late War (Turns 8-10).
*   **Space Race Track:** 10 boxes, each with Ops cost, die roll range for success, and VP/special ability reward (first/second player values).
*   **DEFCON Status Track:** 5 boxes (5 Peace to 1 Nuclear War), with text indicating coup/realignment restrictions per level.
*   **Required Military Operations Track:** 0-5, showing VP penalty for unfulfilled military operations.
*   **Victory Point Track:** -20 (USSR Victory) to 0 (Start) to +20 (US Victory).

**Map Key (Bottom Right):**
- Regional Connection (brown line)
- Inter-regional Connection (red dashed line)
- Adjacency to Superpower (black line)
- Stability Number
- Country Name: Normal Country (white), Battleground Country (purple)
- Influence Marker Placement Area (not visible, implied)

---

## 1. Architecture overview

Guiding principle: a **pure, deterministic engine** that is UI-agnostic and network-agnostic. Everything
(frontend, server, AI, replay, tests) consumes the same engine.

```
                         ┌─────────────────────────────┐
                         │   packages/engine (pure TS) │   <- the brain
                         │  state + reducer + AI + data │
                         └──────────────┬──────────────┘
                  ┌─────────────────────┼─────────────────────┐
            (in-process)          (server-authoritative)    (simulator)
        ┌──────────────┐       ┌──────────────────┐     ┌──────────────┐
        │  web (React) │◄──────┤ packages/server  │     │  AI (MCTS +  │
        │  Vite + UI   │  WS   │  Socket.IO rooms │     │  heuristics) │
        └──────────────┘       └──────────────────┘     └──────────────┘
```

Why this shape works for TS specifically:
- **Hidden information** (hands, headline choice): the server holds the true state; each client receives a
  **redacted view** (own hand visible, opponent's hidden). All legality checks run server-side → no cheating.
- **Determinism + dice:** coups/realignments/space-race/wars use dice. Dice are rolled **server-side** (trusted
  RNG) so both clients agree. (Engine RNG is injectable so tests/AI are reproducible.)
- **AI** can run inside the server process (it just calls the engine's simulator).

### Monorepo layout

```
twilight-struggle/
├─ packages/
│  ├─ engine/                 # PURE. No React, no network, no I/O.
│  │  ├─ data/
│  │  │  ├─ cards.ts          # 110 cards (source of truth)
│  │  │  ├─ map.ts            # countries, regions, adjacency
│  │  │  └─ setup.ts          # initial influence / starting state
│  │  ├─ state/
│  │  │  ├─ types.ts          # GameState, PlayerState, Side, ...
│  │  │  ├─ view.ts           # state -> public/private(redacted) views
│  │  │  └─ create.ts         # newGameState()
│  │  ├─ core/
│  │  │  ├─ reducer.ts        # (state, action) -> {state, log, prompts}  (pure)
│  │  │  ├─ legality.ts       # is this action legal right now?
│  │  │  ├─ rng.ts            # injectable deterministic RNG
│  │  │  └─ ids.ts
│  │  ├─ ops/                 # the 4 Operations
│  │  │  ├─ influence.ts      # 6.1 placing influence (cost rules, adjacency)
│  │  │  ├─ realignment.ts    # 6.2 realignment rolls + modifiers
│  │  │  ├─ coup.ts           # 6.3 coups (defcon, milops, battleground)
│  │  │  └─ spacerace.ts      # 6.4 space race + special abilities
│  │  ├─ phases/
│  │  │  ├─ setupPhase.ts     # 3.0 setup / bidding (optional)
│  │  │  ├─ headline.ts       # 4.5C headline ordering & resolution
│  │  │  ├─ actionRound.ts    # 4.5D card play orchestration
│  │  │  └─ turnEnd.ts        # 4.5E–I milops, china card, scoring, deck merge
│  │  ├─ scoring/
│  │  │  ├─ region.ts         # presence/domination/control (10.1)
│  │  │  └─ final.ts          # end-of-game (10.3.2)
│  │  ├─ events/              # ONE file per card event (see §4)
│  │  │  ├─ index.ts          # registry: cardId -> event handler
│  │  │  ├─ _shared.ts        # helpers: place/remove/score/vp/war/improve-defcon
│  │  │  └─ *.ts
│  │  ├─ ai/
│  │  │  ├─ heuristics.ts     # board evaluation
│  │  │  ├─ mcts.ts           # limited-depth search over legal moves
│  │  │  └─ bot.ts            # wraps engine + search; returns chosen action
│  │  └─ __tests__/           # unit + golden tests
│  ├─ shared/
│  │  └─ protocol.ts          # WS message types (client<->server)
│  ├─ server/
│  │  ├─ rooms.ts             # match lifecycle, matchmaking
│  │  ├─ authority.ts         # runs engine; enforces whose turn; rolls dice
│  │  ├─ persistence.ts       # save/resume matches (sqlite or file)
│  │  └─ index.ts             # Socket.IO bootstrap
│  └─ web/
│     ├─ app/                 # routes, screens (menu, lobby, game, replay)
│     ├─ board/               # SVG/CSS map board (THE hardest UI piece)
│     ├─ components/          # hand, card, tracks, prompts, dialogs
│     ├─ hooks/               # useMatch(), useEngineView()
│     ├─ store/               # client UI state (Zustand)
│     └─ styles/
├─ data/                      # raw reference dumps (rules text, card list) for audits
├─ docs/                      # rules digest, glossary, edge-case log
└─ PLAN.md
```

---

## 2. Engine: the core contract

### 2.1 State shape (sketch)

```ts
type Side = 'US' | 'USSR';
type CardId = string; // e.g. 'nato', 'the_china_card'

interface GameState {
  turn: number;            // 1..10
  phase: PhaseTag;         // which phase/sub-phase we're in
  actionRound: number;     // 1..7
  phasing: Side;
  defcon: 1|2|3|4|5;
  vp: number;              // positive=US, negative=USSR (signed track, 10.2.1)
  milOps: { US: number; USSR: number };
  space: { US: SpaceBox; USSR: SpaceBox };
  chinaCard: { holder: Side; faceDown: boolean };
  countries: Record<CountryId, { us: number; ussr: number }>;
  decks: {
    draw: CardId[]; discard: CardId[]; removed: CardId[];
    early: CardId[]; mid: CardId[]; late: CardId[]; // not-yet-added piles
  };
  hands: { US: CardId[]; USSR: CardId[] };
  headline?: { US?: CardId; USSR?: CardId }; // chosen, secret until reveal
  eventsInEffect: Record<CardId, PersistentEventState>; // underlined/ongoing events (7.3)
  opModifiers: { US: number; USSR: number }; // Red Scare/Containment/Brezhnev etc. (7.4)
  srAbilities: { US: Set<SrAbility>; USSR: Set<SrAbility> };
  transient?: PendingChoice;   // mid-action prompts (targets, UN Intervention, Quagmire roll...)
  history: LogEntry[];         // full audit log
  rngState: number;            // seeded; rolled server-side for trust
  over?: { winner: Side; reason: VictoryReason };
}
```

### 2.2 Reducer is pure + driven by explicit "moves"

Every user/bot/AI input is a typed `Action` (play card as ops / as event, place influence at X, coup X,
realign X, headline pick, space race, resolve pending choice, …). The reducer:

1. validates the action against `legality(state)` → rejects illegal moves with a reason;
2. applies it, updating state and appending to `history`;
3. returns any **pending choice** the UI must prompt for next (e.g. "choose 3 countries to place influence").

This single reducer is the contract used by web, server, and AI identically.

### 2.3 Views (hidden information)

- `toPrivateView(state, side)` → a side sees: own hand, public board, opponent hand hidden (only count).
- `toPublicView(state)` → spectatable, both hands hidden.
- Server never sends raw `hands` of both sides to one client. Headline selection is committed privately.

### 2.4 Determinism / dice
- `rng.ts` exposes `rollDie()` using a seeded PRNG (`state.rngState`).
- In online play the **server** advances the seed and emits results; clients trust the server.
- Tests pass a fixed seed → reproducible coups/realignments for golden tests.

---

## 3. The six subsystems (mapped to rules sections)

| Subsystem | Rules | Engine module | Hard parts |
|---|---|---|---|
| Influence placement | 6.1 | `ops/influence.ts` | cost 1 vs 2 (enemy-controlled); "adjacent to friendly markers at start of round"; control flip re-pricing (6.1.2) |
| Realignments | 6.2 | `ops/realignment.ts` | 3 die-roll modifiers (adjacent controlled / more influence / superpower adjacency); resolve each before next target |
| Coups | 6.3 | `ops/coup.ts` | formula `die+ops vs 2×stability`; BG lowers DEFCON; free-coup ignores DEFCON geography but BG still lowers DEFCON (6.3.5) |
| Space Race | 6.4 | `ops/spacerace.ts` | 1 card/turn (unless ability); box ranges; first/second VP; 4 special abilities; "One Small Step"; end box cap |
| DEFCON + MilOps | 8.1–8.2 | `core/` + `phases/turnEnd.ts` | DEFCON geo restrictions per level; required milops = current DEFCON; DEFCON-1 = loss for phasing player |
| Scoring + Victory | 10 | `scoring/` | presence/domination/control; +adjacent-to-enemy-SP; +per-BG; auto-victory at ±20; Europe control auto-win; final scoring |

### Scoring correctness (the most error-prone area)
Implement region scoring exactly per 10.1.1–10.1.2 with golden tests covering:
- presence only, domination (needs ≥1 BG **and** ≥1 non-BG), control (all BGs),
- "+1 per controlled country adjacent to the enemy superpower" and "+1 per controlled BG",
- net difference applied to signed VP track (10.2.1, 10.2.3),
- Southeast Asia sub-scoring and its single-use removal (7.2),
- final scoring: all regions, no ±20 auto-win at T10, but Europe control still auto-wins (10.3.2).

---

## 4. The 110 events — implementation strategy

This is the **bulk of the engineering effort**. Each card's event is a handler:

```ts
interface EventHandler {
  canPlay(ctx): boolean;                 // prerequisites met? (e.g. NATO needs Marshall/Warsaw)
  prompt(ctx): PendingChoice;            // what to ask the player (targets, etc.)
  apply(ctx, choice): Partial<State>;    // mutate; returns new state slice + log
}
// registry: events/index.ts  ->  Record<CardId, EventHandler>
```

Patterns to factor into `_shared.ts` (so most events are short):
- `placeInfluence`, `removeInfluence`, `swapInfluence`, `add/removePerCountryInfluence`,
- `gainVP`, `improveDefcon`, `degradeDefcon`,
- `warEvent(target, modifiers)` (Korean/Arab-Israeli/Indo-Pak/Brush/Iran-Iraq — 7.6),
- `freeCoup(region|country)`,
- `setPersistent(card)`, `cancelPersistent(card)`,
- `scoreRegion(region)`.

**Cards that need special engine support** (not just data) — flag these early:
- **Headline-only / ordering:** headline value = ops, scoring = 0, US wins ties (4.5C).
- **UN Intervention** — cancels an opponent event played simultaneously; headline-forbidden.
- **The China Card** — own subsystem (§9): held separately, passed face-down, +1 if all ops in Asia, never headline/discard/scoring-forced.
- **Quagmire / Bear Trap** — recurring forced-discard + die-roll each action round (needs a turn-spanning state).
- **DEFCON-effect events** (Duck & Cover, Cuban Missile Crisis, Wargames, How I Learned…) — must enforce "phasing player loses on DEFCON 1".
- **Op-modifier events** (Red Scare/Purge, Containment, Brezhnev, missile envies) — aggregate ±, not transferable to opponent (7.4.1).
- **Prereq-gated cards** (NATO needs Marshall/Warsaw; Formosan; etc.) — `canPlay` + "asterisk but unplayable → discard, not removed" (5.2).
- **Wargames** — special late-war victory via DEFCON (optional rule / Late War scenario).
- **Permanent (underlined) events** — tracked in `eventsInEffect` (Flower Power, NATO, Solidarity, etc.).

Each event gets **at least one unit test**; scoring/DEFCON-sensitive ones get golden tests.

---

## 5. Online architecture

- **Socket.IO** rooms = matches. Lifecycle: lobby → matchmaking → `in_progress` → `finished`; spectatable.
- **Server = authority:** holds true `GameState`. Clients send `Action`s; server runs reducer, rolls dice,
  broadcasts each side's **private view**. Illegal/outing-turn actions rejected.
- **Hidden info safety:** never serialize the opponent's hand or the unrevealed headline choice to a client.
  Private views are computed server-side only.
- **Dice:** rolled on the server (advances `rngState`); result is part of the emitted game event so both clients
  animate the same roll.
- **Resilience:** persist match state per action (SQLite or append-only log) → refresh/reconnect resumes.
  Reconnect re-derives view from authoritative state.
- **Matchmaking:** simple queue + optional invite link / room code; ELO optional later.
- **Protocol** (`shared/protocol.ts`): typed messages — `join`, `submitAction`, `gameEvent` (view diffs or full
  view), `error`, `chat` (optional).

> Online-ready from day one because the **engine is already pure and view-redacting**; the server is a thin
> authoritative wrapper. This is why the engine is built first and built right.

---

## 6. AI opponent

TS has an enormous branching factor (any card, any target country, split ops). A perfect bot is infeasible;
target a **competent** bot:

1. **Heuristic evaluation function** (`heuristics.ts`): VP + region-control potential + DEFCON safety +
   hand quality + milops deficit + China-card value + key-country weights. Tunable weights.
2. **Move generation** that prunes aggressively: candidate coups on high-value BGs, influence into contested
   regions, space-race dumps of bad opponent events, scoring-card timing.
3. **Search:** shallow MCTS / expectimax over the *current player's* cards with opponent modeled by a
   card-distribution prior, capped at a few plies. Headline handled by a dedicated policy.
4. **Difficulty knobs:** search depth, randomness, willingness to take DEFCON risks. Lets us ship a "Casual"
   bot early and harden it later.
5. Reuses the **same legal-move generator** the UI/server use → the bot can never make an illegal move.

Ship a heuristic bot in the first playable build; iterate toward MCTS as the polish item.

---

## 7. Frontend

- **The board is the hard UI piece.** Options: (a) hand-trace the official map to an SVG with hot-spots per
  country, or (b) a stylized abstract board (regions as columns/cards). Recommend an **SVG board** for fidelity
  with country `<g>` hot-zones carrying `data-country`.
- **Influence rendering:** stacked counters; show control via the darker-side convention; numeric denomination
  chips to avoid clutter.
- **Interaction model mirrors the engine's pending-choice flow:** when you play a card for ops, the UI walks you
  through the same prompts the reducer returns (pick op type → pick targets one at a time → confirm). This keeps
  UI and rules perfectly in sync and prevents illegal intermediate states.
- **Tracks:** DEFCON, Mil Ops, VP (signed bar), Space Race, Turn/Action round, Events-in-effect tray, discards.
- **Hands:** your hand as cards; opponent shows count + "passed China Card". Headline = blind-pick UI.
- **Card UX:** clicking a card explains its two play options (Event vs Ops) and previews consequences where
  deterministic (e.g. coup success threshold, scoring result).
- **Polish:** undo-in-hotseat, action log, animations for coups/dice, sound (optional), colorblind-safe palette.

---

## 8. Build phases & milestones

Although scope is the full game, we build **vertically**: a thin playable slice end-to-end first, then widen.

### M1 — Engine skeleton + data + a 1-card smoke test
- Monorepo (pnpm workspaces) + Vite + TS + ESLint + Vitest scaffold.
- `data/map.ts`, `data/cards.ts` (full 110), `data/setup.ts`.
- `state`, `create`, `reducer` core, injectable RNG.
- One full turn playable in a **headless test**: deal, headline, action rounds, scoring, turn end.
- *Exit gate:* golden test reproduces a few turns of the in-book *Example of Play*.

### M2 — Core subsystems (influence, realign, coup, space race, defcon, milops, scoring)
- All of §3 with full test coverage.
- *Exit gate:* any region can be scored correctly; a DEFCON-1 loss triggers; space-race abilities apply.

### M3 — All 110 events
- Event registry + handlers + per-card tests (§4).
- Special-state cards (Quagmire/Bear Trap, UN Intervention, China Card, op-modifiers, permanent events).
- *Exit gate:* a scripted full 10-turn game runs to completion with all victory conditions reachable.

### M4 — Server-authoritative online
- Rooms, authority, private views, server dice, persistence, reconnect.
- *Exit gate:* two browser clients play a hidden-hands match; no info leaks; refresh resumes.

### M5 — Frontend (board + interaction)
- SVG board, tracks, hands, headline UI, prompt-driven action flow, action log.
- *Exit gate:* a full game is comfortably playable hotseat in the browser.

### M6 — AI opponent
- Heuristic bot integrated; difficulty levels; headline policy.
- *Exit gate:* beatable-but-not-trivial AI; consistent legality.

### M7 — Polish & parity with the board game
- Optional rules toggle (Chinese Civil War variant §12, tournament rules §11, Late War scenario).
- Bidding for sides, animations, accessibility, replay viewer, lobby/invite.
- *Exit gate:* matches the physical game experience; rules-parity audit complete.

---

## 9. Testing strategy

- **Unit tests** per op/event/scoring function.
- **Golden tests** from the *Example of Play*: encode the documented turn-by-turn (cards, ops, rolls, resulting
  influence/VP/DEFCON) and assert the engine reproduces it. This is our strongest correctness signal.
- **Property/invariant tests:** VP track bounds, DEFCON∈[1,5], milops≥0, hands+draw+discard+removed = total,
  no card ever in two places, removed-starred never re-enters deck.
- **Parity audit:** a manual checklist mapping every rule section (2–12) to code + test(s); track edge cases in
  `docs/edge-cases.md` (UN Intervention timing, NATO gating, China Card restrictions, event-before/after-ops
  ordering, "no effect but still played & removed" 5.2, scoring-card can't be held 10.1.5).
- **AI legality tests:** the bot only ever emits moves the reducer accepts.

---

## 10. Risk register / complexity hotspots

| Risk | Mitigation |
|---|---|
| **110 events = long tail of bugs** | Shared helpers + mandatory per-card tests; golden tests from the example of play. |
| **Scoring correctness** | Isolate `scoring/` behind exhaustive table tests covering every presence/dom/control/adjacency/BG combo. |
| **Hidden-info leakage online** | Server-only view computation; fuzz test that the public view never contains opponent hand IDs. |
| **DEFCON / "phasing player loses"** | Centralize every DEFCON mutation through one choke point that checks for level 1 and assigns the loss to `state.phasing`. |
| **China Card edge cases** | Dedicated module + tests for headline/discard/scoring prohibitions and Asia bonus. |
| **Action-round prompts** (UN Intervention, Quagmire rolls, multi-target influence) | Model as an explicit `PendingChoice` in state; UI/server/AI all resolve the same prompt type. |
| **Board UI fidelity** | SVG with hot-zones; decouple visual layout from engine adjacency. |
| **AI strength expectations** | Ship heuristic bot early; set expectations; iterate. |

---

## 11. Rough effort shape

- ~60–70% of effort is the **engine + 110 events + scoring + tests** (M1–M3).
- ~15–20% online authority (M4).
- ~10–15% board UI (M5).
- AI + polish (M6–M7) are open-ended; the heuristic bot is modest, a strong bot is a project unto itself.

This is a large but very tractable project **because the rules are fully specified** and the architecture front-loads
correctness into a pure, testable engine.

---

## 12. Immediate next steps (after this plan is approved)

1. Scaffold the monorepo (pnpm workspaces: `engine`, `shared`, `server`, `web`) with Vite + TS + ESLint + Vitest.
2. Author `data/map.ts` and `data/cards.ts` (full 110) and lock them with tests.
3. Implement `state`/`create`/`reducer`/`rng` and encode the *Example of Play* as golden tests.
4. Land M1 and play a headless full turn.

> Working directory note: implementation will go in `/Users/alexanderbustrup/Documents/GitHub/twilight-struggle`.
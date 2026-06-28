# Twilight Struggle – Digital Edition

A working, playable digital implementation of GMT's _Twilight Struggle_
(Deluxe/2nd Edition), built as a React + TypeScript web game with a pure,
testable rules engine and a heuristic AI opponent.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run build:pages
npm run preview:pages
npm test         # engine tests (autoplay full games + action-path tests)
```

## GitHub Pages deployment

This repo uses GitHub Actions for Pages. Every push to `main` installs
dependencies, runs tests, typechecks, builds the Vite app with the
`/twilight-struggle/` base path, and uploads the generated `dist/` folder as the
Pages artifact. Do not use "Deploy from branch" for this app – that serves raw
files and skips the Vite build.

One repository setting is required once: GitHub → Settings → Pages → Source →
GitHub Actions.

Use `npm run preview:pages` to test the production build locally at the same
path GitHub Pages will use.

## What works (full game loop, start to finish)

- **Setup & deal** – standard initial influence, Early War deck dealt (8 cards).
- **10-turn structure** – headline phase, action rounds (6 early / 7 mid+),
  turn-end Military Ops penalty, China Card flip, DEFCON improvement, deck
  merges at turns 4 (Mid) and 8 (Late), final scoring at end of turn 10.
- **All four Operations** – Influence placement (with 1/2 cost rule & adjacency),
  Coups (die+ops vs 2×stability, Battleground DEFCON drop, DEFCON region bans),
  Realignments (with all 3 modifiers), Space Race (8 boxes, VP, special abilities).
- **DEFCON** – geographic coup/realignment restrictions by level; DEFCON 1 ends
  the game and the phasing player loses.
- **Military Operations** – required ops = current DEFCON; VP penalty for shortfall.
- **Scoring** – all six regions with Presence / Domination / Control, adjacent-to-
  enemy & per-Battleground bonuses; Southeast Asia sub-scoring; Europe control
  auto-win; ±20 automatic victory; end-game final scoring.
- **Cards** – the 110-card dataset (ops, side, war phase, starred, scoring) with
  source rows extracted from `All cards.numbers`; Early, Mid, Late, and Optional
  card events all have registered engine handlers.
- **The China Card** – held separately, passed face-down, +1 Asia bonus, headline
  & discard prohibitions.
- **AI opponent** – DEFCON-safe heuristic bot (coups high-value Battlegrounds,
  avoids self-inflicted DEFCON-1, dumps dangerous opponent events on the Space
  Race). Beats itself to a real conclusion ~half the time each side.
- **Modes** – Hotseat (2 players, one device) and Play vs AI (as US or USSR).
- **Interactive tutorial** – a guided "How to Play" mode on the real board that
  teaches the goal/VP, influence & control, the four operations, DEFCON, and
  scoring, with hands-on practice (take control of a country, stage a coup) using
  the real rules engine.
- **Local saves** – current game, mode, side, seeded state, and Space Race
  abilities persist through browser reloads.
- **Thematic board UI** – world-map background with positioned interactive country
  boxes that show **large influence numbers** (blue US / red USSR, solid chip when
  controlled), flags, stability and Battleground stars; a board-style status bar
  (US/USSR emblems, Turn marker, DEFCON ladder, VP tug-of-war bar, MilOps/Space/
  China readouts); a **hover card preview** that renders the full thematic card
  face (ops, war period, side, event text); Hand / Discard / Removed tabs; a
  **collapsible Game Log**; and prompt-driven action flow.

See `docs/design-brief.md` for a hand-off brief to commission richer card/board art.

## Architecture

A single Vite app with a **pure, UI-agnostic engine** under `src/engine/`. The
reducer `(state, action) -> state` is the one contract consumed by the UI, the
AI, and the tests, so rules live in exactly one place.

```
src/
  engine/
    data/      map.ts (countries/adjacency/regions/BG), cards.ts (110), setup.ts
    state/     types.ts, create.ts (deal, deck merge)
    core/      reducer.ts, control.ts, effects.ts, rng.ts
    ops/       influence.ts, coup.ts, realignment.ts, spacerace.ts
    scoring/   scoring.ts (region + final + SEA)
    events/    index.ts (event registry + card handlers)
    ai/        bot.ts
    __tests__/ data/rules/events/ai/autoplay/action-path tests
  ui/          useGame.ts, components.tsx, persistence.ts
  App.tsx      menu + game screen + interaction state
```

## Status & caveats (be honest before calling it "done")

This is a **real, playable build** of the core game, not a 1:1 certified
reproduction. Known gaps to reach full parity with the board game:

1. **Card events:** all non-scoring cards now route through registered handlers.
   Many multi-target events still auto-pick deterministic reasonable targets
   rather than asking the player. The next fidelity step is typed UI prompts for
   every event choice.
2. **Map data fidelity:** Battleground flags and adjacency were reconstructed
   from memory of the canonical map – verify against the board image before
   treating scoring as authoritative (see `data/map.ts`).
3. **No online multiplayer:** intentionally out of scope for this local build.
4. **Edge-case rules:** bidding, full event-choice prompts, Quagmire/Bear Trap
   per-round discard loops, Missile Envy follow-up constraints, and several
   persistent cancellation nuances still need stricter rule tests.

The original design plan, map description, and milestone roadmap live in `PLAN.md`.

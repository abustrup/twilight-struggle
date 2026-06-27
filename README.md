# Twilight Struggle — Digital Edition

A working, playable digital implementation of GMT's _Twilight Struggle_
(Deluxe/2nd Edition), built as a React + TypeScript web game with a pure,
testable rules engine and a heuristic AI opponent.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm test         # engine tests (autoplay full games + action-path tests)
```

## What works (full game loop, start to finish)

- **Setup & deal** — standard initial influence, Early War deck dealt (8 cards).
- **10-turn structure** — headline phase, action rounds (6 early / 7 mid+),
  turn-end Military Ops penalty, China Card flip, DEFCON improvement, deck
  merges at turns 4 (Mid) and 8 (Late), final scoring at end of turn 10.
- **All four Operations** — Influence placement (with 1/2 cost rule & adjacency),
  Coups (die+ops vs 2×stability, Battleground DEFCON drop, DEFCON region bans),
  Realignments (with all 3 modifiers), Space Race (8 boxes, VP, special abilities).
- **DEFCON** — geographic coup/realignment restrictions by level; DEFCON 1 ends
  the game and the phasing player loses.
- **Military Operations** — required ops = current DEFCON; VP penalty for shortfall.
- **Scoring** — all six regions with Presence / Domination / Control, adjacent-to-
  enemy & per-Battleground bonuses; Southeast Asia sub-scoring; Europe control
  auto-win; ±20 automatic victory; end-game final scoring.
- **Cards** — the 110-card dataset (ops, side, war phase, starred, scoring) with
  Early War events implemented; Mid/Late events resolve via Ops with their text
  on hover (handlers can be added card-by-card into `events/index.ts`).
- **The China Card** — held separately, passed face-down, +1 Asia bonus, headline
  & discard prohibitions.
- **AI opponent** — DEFCON-safe heuristic bot (coups high-value Battlegrounds,
  avoids self-inflicted DEFCON-1, dumps dangerous opponent events on the Space
  Race). Beats itself to a real conclusion ~half the time each side.
- **Modes** — Hotseat (2 players, one device) and Play vs AI (as US or USSR).
- **Board UI** — region-grouped interactive board (control highlighting,
  Battleground stars, US/USSR influence), tracks (Turn/Action/DEFCON/VP/MilOps/
  Space/China), your hand, prompt-driven action flow, and an action log.

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
    events/    index.ts (event registry + Early War handlers)
    ai/        bot.ts
    __tests__/ autoplay.test.ts, actions.test.ts
  ui/          useGame.ts, components.tsx (Tracks/Board/Hand/Log)
  App.tsx      menu + game screen + interaction state
```

## Status & caveats (be honest before calling it "done")

This is a **real, playable build** of the core game, not a 1:1 certified
reproduction. Known gaps to reach full parity with the board game:

1. **Card events:** Early War events are implemented; many Mid/Late events are
   `noop` (playable for Ops, event text shown on hover). Implementing the
   remaining ~70 event handlers in `events/index.ts` is the main remaining work.
   Multi-target events auto-pick reasonable targets rather than asking the player.
2. **Map data fidelity:** Battleground flags and adjacency were reconstructed
   from memory of the canonical map — verify against the board image before
   treating scoring as authoritative (see `data/map.ts`).
3. **No online multiplayer yet:** the engine is already pure + view-redactable
   (per the original `PLAN.md` architecture), so adding a server-authoritative
   online layer is an additive change, not a rewrite.
4. **Board rendering** is an abstract region grid (fully playable) rather than a
   faithful SVG of the world map.
5. Edge-case rules (UN Intervention simultaneous cancel, Quagmire/Bear Trap
   per-round rolls, bidding) are not yet wired.

The original design plan, map description, and milestone roadmap live in `PLAN.md`.

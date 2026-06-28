# Full Local Release Design

## Goal

Build a complete local Twilight Struggle digital implementation for personal use. The release ships hotseat play, AI play, all base and optional cards, the Claude map presentation, local saves, deterministic replay/debug state, and rule tests. Online multiplayer is explicitly out of scope.

## Source Of Truth

- Card data comes from `/Users/alexanderbustrup/Documents/Game ideas /twillight struggle/All cards.numbers`.
- Rule behavior comes from `/Users/alexanderbustrup/Documents/Game ideas /twillight struggle/TS_Rules_Deluxe.md`.
- Board geography and visual target come from `/Users/alexanderbustrup/Documents/Game ideas /twillight struggle/map.jpg` and `/Users/alexanderbustrup/Documents/Game ideas /twillight struggle/Twilight Struggle Map Design`.
- Current source code is reusable only where it matches these sources.

## Architecture

The app remains a Vite React TypeScript app. The engine is rewritten as a pure state machine with serializable state, explicit pending decisions, seeded randomness, and no React dependency. The UI renders state and submits actions only. AI uses the same legal action generator as the UI, plus evaluation and shallow simulation.

## Engine Units

- `engine/data/cards.ts` stores all extracted card definitions, including ID, title, ops, side, war, starred, optional status, scoring region, and event key.
- `engine/data/map.ts` stores official playable spaces, stability, battleground flags, region membership, subregions, adjacency, and superpower adjacency.
- `engine/rules` owns control, scoring, operations, DEFCON, military operations, China Card, space race, turn structure, and persistent effects.
- `engine/events` owns card-specific event resolution. Events either apply immediately or create a typed pending choice.
- `engine/ai` owns legal action selection, candidate generation, evaluation, and deterministic simulation.

## UI

The board uses the Claude map asset as the visual base, with interactive country boxes and influence markers positioned from the map-design data. Dense rule state lives in compact panels around the board. The first screen is the game, not a landing page.

## Persistence

Local saves use JSON in `localStorage`. Save payloads contain a version number, engine state, action log, random seed state, and mode. The engine state stays serializable, so saves and replays do not depend on React or browser objects.

## Verification

The release needs tests at four layers.

- Data integrity tests verify all card IDs, ops, war sections, starred cards, scoring cards, optional cards, and map invariants.
- Rules tests cover setup, influence cost, coups, realignments, DEFCON restrictions, military operations, China Card, space race, scoring, headline order, held scoring cards, and final scoring.
- Event tests cover every non-scoring card at least once.
- Autoplay tests run AI versus AI to legal completion across fixed seeds.

## Milestone Acceptance

- `npm test` passes.
- `npm run build` passes.
- A local player can complete a game in hotseat mode.
- A local player can complete a game against AI.
- All 110 cards exist in data and have non-noop behavior or an explicit legal no-effect condition.
- The Claude map is the main board presentation.
- Save and resume work locally.

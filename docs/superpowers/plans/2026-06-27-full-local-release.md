# Full Local Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a complete local Twilight Struggle release with full rules, all cards, Claude map UI, hotseat, AI, saves, and verification.

**Architecture:** Keep the React/Vite shell and replace the prototype engine with a pure typed state machine. Use extracted card data and official map/rules references as source of truth. Route all UI and AI decisions through the same legal action and pending-choice contracts.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, localStorage, generated TypeScript data files.

---

### Task 1: Data Baseline

**Files:**
- Modify: `src/engine/data/cards.ts`
- Modify: `src/engine/data/map.ts`
- Add: `src/engine/__tests__/data.test.ts`

- [ ] Write failing tests for 110 card IDs, optional cards, scoring cards, known ops values, and map region invariants.
- [ ] Replace card data with extracted authoritative rows from the Numbers file.
- [ ] Fix map data defects such as Canada and Mexico being assigned to Europe.
- [ ] Run `npm test -- src/engine/__tests__/data.test.ts`.

### Task 2: Core Rules State Machine

**Files:**
- Modify: `src/engine/state/types.ts`
- Modify: `src/engine/state/create.ts`
- Modify: `src/engine/core/reducer.ts`
- Add or modify rules modules under `src/engine/core`, `src/engine/ops`, and `src/engine/scoring`.
- Add: `src/engine/__tests__/rules.test.ts`

- [ ] Write failing tests for setup, turn sequence, scoring-card holding, influence placement, coups, realignments, DEFCON, military operations, China Card, space race, and final scoring.
- [ ] Rewrite reducer around explicit pending decisions and legal actions.
- [ ] Make state fully serializable.
- [ ] Run focused and full rule tests.

### Task 3: Event System

**Files:**
- Modify: `src/engine/events/index.ts`
- Add: `src/engine/events/helpers.ts`
- Add: `src/engine/__tests__/events.test.ts`

- [ ] Write failing event coverage tests for all non-scoring card keys.
- [ ] Implement immediate events, persistent events, delayed events, discard events, war events, and operation-granting events.
- [ ] Implement typed pending choices for target selection, discard selection, region selection, war targets, and event follow-up operations.
- [ ] Run event tests and autoplay tests.

### Task 4: AI

**Files:**
- Modify: `src/engine/ai/bot.ts`
- Add: `src/engine/__tests__/ai.test.ts`

- [ ] Write failing tests that AI produces legal actions for headline, card play, operations, and event choices.
- [ ] Implement candidate generation through legal action helpers.
- [ ] Add board evaluation and shallow simulation.
- [ ] Run AI-vs-AI completion tests across fixed seeds.

### Task 5: UI And Persistence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/useGame.ts`
- Modify: `src/ui/components.tsx`
- Modify: `src/styles.css`
- Add: `src/ui/persistence.ts`

- [ ] Write focused tests or type-level checks for save serialization.
- [ ] Wire the new pending-choice contract into the UI.
- [ ] Add local save, resume, restart, and action log controls.
- [ ] Keep the Claude map as the primary board view.
- [ ] Run build and browser smoke verification.

### Task 6: Release Verification

**Files:**
- Modify: `README.md`

- [ ] Update status and run instructions.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start local dev server and smoke test hotseat and AI start paths.

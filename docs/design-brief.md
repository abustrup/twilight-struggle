# Visual asset design brief — Twilight Struggle (Digital Edition)

This file is a hand-off brief you can paste into a design/image tool (Canva,
Midjourney, DALL·E, Figma AI, etc.) to commission richer art for the game. The
current build is fully playable with **pure CSS/SVG theming** — no external image
assets are required — but these assets would deepen the look toward the physical
board game.

The app already consumes one image: `public/ts-map.jpg` (the world map
background). Everything else (country boxes, cards, status bar, emblems) is drawn
with CSS/SVG. Drop replacement art into `public/` and wire it in
`src/ui/components.tsx` / `src/styles.css`.

## Art direction

- **Era & mood:** Cold War, 1945–1989. Tense, propaganda-poster energy. Aged
  paper, ink, muted desaturated palette with two faction accents.
- **US accent:** navy/steel blue `#236fb4`. **USSR accent:** crimson `#ba332b`.
- **Neutral:** slate gray `#5b6066`. **Parchment:** `#e8dfc9`. **Gold trim:** `#d8b35d`.
- **Tone:** serious historical strategy, not cartoonish. Think GMT Games' board
  art and mid-century propaganda lithography.

## Assets wanted (in priority order)

### 1. Card illustrations (highest value) — 110 cards
For each event card, a small square/portrait illustration (target ~512×512,
transparent or paper background) evoking the event. Style: duotone or limited-
palette propaganda-poster illustration tinted toward the owning faction
(US = blue wash, USSR = red wash, Neutral = sepia).

> Prompt template (fill in per card):
> "Cold War propaganda-poster style illustration of **{EVENT}**, limited palette,
> {blue for US / red for USSR / sepia for neutral} duotone on aged paper, mid-
> century lithograph texture, no text, no borders, centered subject, 512×512."

Example fills: *De-Stalinization* (Soviet leaders, statue toppling, red duotone);
*NATO* (interlocked allied flags, blue duotone); *Cuban Missile Crisis* (missiles
on a map, tense red/black); *Olympic Games* (mid-century stadium torch, sepia).

The metadata that drives each card (name, ops, side, war period, full text) lives
in `src/engine/data/cards.ts` — use the `name` and `text` fields as the source of
truth for what each illustration should depict.

### 2. Faction emblems (replace the inline SVGs)
Crisp vector emblems at ~256×256, transparent PNG/SVG:
- **US:** white five-point star in a navy roundel, subtle worn edges.
- **USSR:** gold hammer-and-sickle + star in a crimson roundel.
- **Neutral:** a globe/olive-branch motif in slate.

### 3. Title / menu key art
A wide hero image (~2560×1440) for the menu background: a stylized world map
split blue/red down the middle, dramatic spotlight, propaganda texture. Should
read well behind large uppercase "TWILIGHT STRUGGLE" type with a dark overlay.

### 4. Board polish (optional)
A higher-resolution, more illustrative world map to replace `public/ts-map.jpg`
(2435×1536 canvas; country boxes are positioned in `src/engine/data/boardLayout.ts`
against that exact size, so keep the same aspect ratio and recognizable
coastlines, or the box positions will need re-tuning).

## Deliverable format

- PNG with transparency (or SVG) for emblems and card art.
- JPG/WEBP for the large backgrounds.
- Name card art by the card `id` from `cards.ts` (e.g. `destalinization.png`,
  `nato.png`) so it can be auto-loaded by id.

## Where it plugs in

- Card art → `CardFace` in `src/ui/components.tsx` (the `.cf-art` block currently
  renders an emblem; swap in `<img src={…cardId.png}>`).
- Emblems → the `Emblem` component in `src/ui/components.tsx`.
- Menu key art → `.menu::before` background in `src/styles.css`.
- Board map → `public/ts-map.jpg`.

import { useMemo, useState, type ReactNode } from 'react';
import { createGame } from '../engine/state/create';
import { clone } from '../engine/core/reducer';
import { performCoup } from '../engine/ops/coup';
import { controller } from '../engine/core/control';
import { Board, Tracks } from './components';
import type { GameState } from '../engine/state/types';

type StepKind = 'info' | 'place' | 'coup';
interface Step {
  kind: StepKind;
  title: string;
  body: ReactNode;
}

const PLACE_TARGET = 'poland';
const COUP_TARGET = 'italy';
const COUP_OPS = 4;

// A clean teaching board: standard opening, but Poland is left contestable so the
// player can practice taking control, and Italy is a US-held battleground to coup.
function tutorialState(): GameState {
  const s = createGame(424242);
  s.defcon = 5;
  s.countries = { ...s.countries, [PLACE_TARGET]: { us: 0, ussr: 1 }, [COUP_TARGET]: { us: 3, ussr: 0 } };
  s.log = [];
  return s;
}

const STEPS: Step[] = [
  {
    kind: 'info',
    title: 'Welcome, Comrade General',
    body: (
      <>
        <p>In <b>Twilight Struggle</b> you command a superpower during the Cold War. In this
          tutorial you play the <b className="ussr">USSR (red)</b>.</p>
        <p>You'll spend <b>Operations</b> to spread <b>Influence</b>, topple governments, and race
          to space — all while keeping the world off the brink of nuclear war.</p>
        <p>It takes about three minutes. Use <b>Next</b> to advance.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'How You Win',
    body: (
      <>
        <p>One shared <b>Victory Point</b> track (top bar) decides the game. The USSR pushes it
          <b className="ussr"> left</b>; the US pushes it <b className="us">right</b>.</p>
        <ul>
          <li>Reach <b>+20 / −20</b> and you win instantly.</li>
          <li>Control all of <b>Europe</b> when Europe is scored → instant win.</li>
          <li>Otherwise, whoever leads in VP after <b>Turn 10</b> wins.</li>
        </ul>
        <p>Glance at the VP bar in the top bar — right now it's tied at 0.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'The Board & Influence',
    body: (
      <>
        <p>The world is divided into <b>countries</b> grouped into colored <b>regions</b>
          (Europe, Asia, Africa, the Americas, the Middle East).</p>
        <p>Each country shows its <b>Influence</b> as big numbers: <b className="us">blue = US</b>,
          <b className="ussr"> red = USSR</b>. The small number top-right is the country's
          <b> Stability</b>. A <b>★</b> marks a <b>Battleground</b> — the most valuable countries.</p>
        <p>Drag/scroll the map and use the zoom buttons to look around.</p>
      </>
    ),
  },
  {
    kind: 'place',
    title: 'Practice: Take Control',
    body: (
      <>
        <p>A country is <b>Controlled</b> when one side's Influence is at least the country's
          <b> Stability</b> number <i>and</i> exceeds the enemy's by that much.</p>
        <p><b>Poland</b> (glowing) has Stability <b>3</b> and just <b>1</b> USSR Influence.
          Click it to add Influence until you reach <b>3</b> and take control — watch the
          red border appear.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'Why Control Matters',
    body: (
      <>
        <p>Control wins you points when a region is <b>scored</b>, and it lets your Influence
          spread to <b>adjacent</b> countries.</p>
        <p><b>Battlegrounds</b> (★) are worth extra VP and are the real prizes — most of the game
          is a tug-of-war over them.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'Operations: Your Four Tools',
    body: (
      <>
        <p>Most cards have an <b>Operations</b> value (1–4). When you play a card for Ops, you pick
          <b> one</b> of four actions:</p>
        <ul>
          <li><b>Place Influence</b> — spread into reachable countries.</li>
          <li><b>Coup</b> — gamble to flip a country instantly.</li>
          <li><b>Realignment</b> — roll to knock out enemy Influence.</li>
          <li><b>Space Race</b> — discard a card to climb the space track for VP.</li>
        </ul>
        <p>The <b>China Card</b> is a special card passed between the superpowers — play it
          for a <b>bonus Operation</b> (it's worth 5 here).</p>
      </>
    ),
  },
  {
    kind: 'coup',
    title: 'Practice: Stage a Coup',
    body: (
      <>
        <p>A <b>Coup</b> tries to flip a country at once. Roll a die, add your Ops; if the total
          beats <b>twice</b> the Stability, you remove enemy Influence and add your own.</p>
        <p><b>Italy</b> (glowing) is a US-held Battleground, Stability 3. Click it to coup with a
          <b> {COUP_OPS}-Op</b> card. Couping a Battleground also drops <b>DEFCON</b> — watch the
          ladder in the top bar.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'DEFCON & Nuclear War',
    body: (
      <>
        <p>The <b>DEFCON</b> ladder (top bar) runs 5 → 1. <b>5</b> is peace; <b>1</b> is global
          thermonuclear war.</p>
        <ul>
          <li>Battleground coups and some events <b>lower</b> DEFCON.</li>
          <li>At lower DEFCON, coups/realignments are <b>banned</b> in tense regions (Europe first,
            then Asia, then the Middle East).</li>
          <li>Whoever pushes the world to <b>DEFCON 1 loses immediately</b> — handle with care.</li>
        </ul>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'Cards, Events & Headlines',
    body: (
      <>
        <p>Every card carries an <b>Event</b> tied to a side. You may play a card for its <b>Ops</b>
          <i> or</i> its <b>Event</b> — but beware: playing an <b>opponent's</b> card for Ops still
          triggers their Event.</p>
        <p>Each turn opens with a simultaneous <b>Headline</b>: both players secretly pick a card,
          then reveal and resolve them. After that you alternate <b>action rounds</b>.</p>
        <p><b>Hover any card</b> in your hand to read its full effect.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: 'Scoring & the Long Game',
    body: (
      <>
        <p><b>Scoring cards</b> (shown with a <b>★</b> ops badge) <i>must</i> be played the turn you
          hold them. They award VP for <b>Presence / Domination / Control</b> of a region, plus a
          bonus per controlled Battleground.</p>
        <p>So the game is a balance: build Influence quietly, win the regions when they're scored,
          and never let DEFCON get away from you.</p>
      </>
    ),
  },
  {
    kind: 'info',
    title: "You're Ready",
    body: (
      <>
        <p>That's the core loop: <b>spend Ops → build Influence → win regions → manage DEFCON</b>.</p>
        <p>Everything else is learned by playing. Exit now and start a game vs the AI (try playing
          USSR first), or jump into Hotseat with a friend.</p>
        <p>Good luck out there.</p>
      </>
    ),
  },
];

export function Tutorial({ onExit }: { onExit: () => void }) {
  const [tut, setTut] = useState<GameState>(tutorialState);
  const [step, setStep] = useState(0);
  const [couped, setCouped] = useState(false);
  const [coupText, setCoupText] = useState<string | null>(null);

  const s = STEPS[step];
  const placeControlled = controller(PLACE_TARGET, tut.countries[PLACE_TARGET]) === 'USSR';
  const placeNeeded = Math.max(0, 3 - tut.countries[PLACE_TARGET].ussr);
  const interactiveDone = s.kind === 'place' ? placeControlled : s.kind === 'coup' ? couped : true;

  function highlight(id: string): boolean {
    if (s.kind === 'place') return id === PLACE_TARGET && !placeControlled;
    if (s.kind === 'coup') return id === COUP_TARGET && !couped;
    return false;
  }

  function onClickCountry(id: string) {
    if (s.kind === 'place' && id === PLACE_TARGET && !placeControlled) {
      setTut((prev) => ({
        ...prev,
        countries: { ...prev.countries, [id]: { ...prev.countries[id], ussr: prev.countries[id].ussr + 1 } },
      }));
    } else if (s.kind === 'coup' && id === COUP_TARGET && !couped) {
      setTut((prev) => {
        const next = clone(prev);
        const r = performCoup(next, { countryId: COUP_TARGET, ops: COUP_OPS, side: 'USSR' });
        if (r.success) {
          setCoupText(`Rolled ${r.roll} + ${COUP_OPS} Ops = ${r.total} vs ${3 * 2} → success! Removed ${r.removed} US Influence${r.added ? `, added ${r.added} USSR` : ''}. DEFCON dropped to ${next.defcon}.`);
        } else {
          setCoupText(`Rolled ${r.roll} + ${COUP_OPS} Ops = ${r.total} vs ${3 * 2} → it failed. Coups are a gamble! DEFCON still dropped to ${next.defcon} (battleground). In a real game you could try again with another card.`);
        }
        return next;
      });
      setCouped(true);
    }
  }

  function next() {
    if (step >= STEPS.length - 1) { onExit(); return; }
    setStep((i) => i + 1);
  }
  function back() { setStep((i) => Math.max(0, i - 1)); }

  const progress = useMemo(() => STEPS.map((_, i) => i), []);

  return (
    <div className="app tutorial">
      <header className="app-header">
        <button className="exit" onClick={onExit}>✕ Exit Tutorial</button>
        <Tracks state={tut} />
        <div className="tut-progress">
          {progress.map((i) => <span key={i} className={`pip${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} />)}
        </div>
      </header>

      <main className="main">
        <Board state={tut} onClickCountry={onClickCountry} highlight={highlight} />

        <aside className="sidebar tut-coach">
          <div className="coach-card">
            <div className="coach-step">Lesson {step + 1} of {STEPS.length}</div>
            <h2>{s.title}</h2>
            <div className="coach-body">{s.body}</div>

            {s.kind === 'place' && (
              <div className={`coach-status${placeControlled ? ' ok' : ''}`}>
                {placeControlled
                  ? '✓ Poland is USSR-controlled! Notice the red control border.'
                  : `USSR Influence in Poland: ${tut.countries[PLACE_TARGET].ussr} / 3 needed${placeNeeded ? ` — click ${placeNeeded} more time${placeNeeded > 1 ? 's' : ''}.` : '.'}`}
              </div>
            )}
            {s.kind === 'coup' && (
              <div className={`coach-status${couped ? ' ok' : ''}`}>
                {coupText ?? 'Click the glowing Italy to attempt your coup.'}
              </div>
            )}

            <div className="coach-nav">
              <button onClick={back} disabled={step === 0}>← Back</button>
              {interactiveDone ? (
                <button className="primary" onClick={next}>{step >= STEPS.length - 1 ? 'Finish ✓' : 'Next →'}</button>
              ) : (
                <button onClick={next}>Skip →</button>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

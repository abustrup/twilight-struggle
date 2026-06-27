// ============================================================================
// cards.ts — The 110-card deck (base game). Each card: ops, side, war phase,
// starred (asterisk = removed after event), scoring region (if any), and an
// `impl` key matching an event handler in events/index.ts.
//
// NOTE: Ops values / sides reconstructed from the canonical GMT card set.
// Values should be cross-checked against the official cards. Events with
// impl 'noop' are playable for Ops; their event is a safe no-op until wired.
// ============================================================================

export type Side = 'US' | 'USSR';
export type Affiliation = Side | 'Neutral';
export type War = 'Early' | 'Mid' | 'Late';

export interface CardDef {
  id: string;
  name: string;
  ops: number;
  side: Affiliation;
  war: War;
  starred: boolean; // asterisk: removed from game after played as event
  scoring?: import('./map.ts').Region; // set for scoring cards
  impl: string; // event handler key (see events/index.ts)
  text: string;
}

// Scoring cards
const SCORING = (region: import('./map.ts').Region): Omit<CardDef, 'id' | 'name' | 'war' | 'text'> => ({
  ops: 0,
  side: 'Neutral',
  starred: false,
  scoring: region,
  impl: `score:${region}`,
});

export const CARDS: CardDef[] = [
  // ---------------- EARLY WAR ----------------
  { id: 'asiascoring', name: 'Asia Scoring', war: 'Early', text: 'Score Asia.', ...SCORING('Asia') },
  { id: 'europescoring', name: 'Europe Scoring', war: 'Early', text: 'Score Europe.', ...SCORING('Europe') },
  { id: 'mideastscoring', name: 'Middle East Scoring', war: 'Early', text: 'Score Middle East.', ...SCORING('MiddleEast') },
  { id: 'duckandcover', name: 'Duck and Cover', ops: 3, side: 'US', war: 'Early', starred: true, impl: 'duckandcover', text: 'Degrade DEFCON 1. US gains VP = 5 - DEFCON.' },
  { id: 'fiveyearplan', name: 'Five Year Plan', ops: 3, side: 'US', war: 'Early', starred: false, impl: 'noop', text: 'USSR discards a card at random; if starred, US gains 1 VP.' },
  { id: 'socialistgovs', name: 'Socialist Governments', ops: 3, side: 'USSR', war: 'Early', starred: false, impl: 'removeinfluence', text: 'Remove 3 US Influence from Europe (max 2 per country).' },
  { id: 'fidel', name: 'Fidel', ops: 2, side: 'USSR', war: 'Early', starred: true, impl: 'fidel', text: 'USSR gains Cuba.' },
  { id: 'vietnamrevolts', name: 'Vietnam Revolts', ops: 2, side: 'USSR', war: 'Early', starred: true, impl: 'vietnamrevolts', text: 'Add 2 USSR Influence to Vietnam. +1 to all USSR Ops in SE Asia this turn.' },
  { id: 'blockade', name: 'Blockade', ops: 1, side: 'USSR', war: 'Early', starred: true, impl: 'blockade', text: 'US discards a 3+ Op card or USSR gains West Germany.' },
  { id: 'koreanwar', name: 'Korean War', ops: 2, side: 'USSR', war: 'Early', starred: false, impl: 'war', text: 'USSR invades South Korea. Roll: -1 per US-controlled adjacent country.' },
  { id: 'romanianabdication', name: 'Romanian Abdication', ops: 1, side: 'USSR', war: 'Early', starred: true, impl: 'influence', text: 'USSR gains Romania.' },
  { id: 'arabisraeliwar', name: 'Arab-Israeli War', ops: 2, side: 'USSR', war: 'Early', starred: false, impl: 'war', text: 'USSR invades Israel. Roll: -1 per US-controlled adjacent country.' },
  { id: 'comecon', name: 'COMECON', ops: 3, side: 'USSR', war: 'Early', starred: true, impl: 'influence', text: '+1 USSR Influence to 4 uncontrolled/E.Europe countries.' },
  { id: 'nasser', name: 'Nasser', ops: 1, side: 'USSR', war: 'Early', starred: true, impl: 'nasser', text: '+2 USSR Egypt, -1 US Egypt.' },
  { id: 'warsawpact', name: 'Warsaw Pact Formed', ops: 3, side: 'USSR', war: 'Early', starred: true, impl: 'warsawpact', text: 'Remove all US Influence from one E.Europe country, or add 5 USSR to E.Europe.' },
  { id: 'degaulle', name: 'De Gaulle Leads France', ops: 3, side: 'USSR', war: 'Early', starred: true, impl: 'degaulle', text: '-2 US France, +1 USSR France. Cancels NATO for France.' },
  { id: 'capturednazi', name: 'Captured Nazi Scientists', ops: 1, side: 'Neutral', war: 'Early', starred: false, impl: 'spaceraceadvance', text: 'Advance 1 box on Space Race.' },
  { id: 'trumandoctrine', name: 'Truman Doctrine', ops: 1, side: 'US', war: 'Early', starred: true, impl: 'trumandoctrine', text: 'Remove all USSR Influence from one uncontrolled country in Europe.' },
  { id: 'olympicgames', name: 'Olympic Games', ops: 2, side: 'Neutral', war: 'Early', starred: false, impl: 'olympicgames', text: 'Host Olympics; +2 VP or opponent boycotts (degrade DEFCON 1).' },
  { id: 'nato', name: 'NATO', ops: 4, side: 'US', war: 'Early', starred: true, impl: 'nato', text: 'USSR may not coup/realign US-controlled countries in Europe. Requires Warsaw Pact or Marshall Plan.' },
  { id: 'independentreds', name: 'Independent Reds', ops: 3, side: 'US', war: 'Early', starred: true, impl: 'independentreds', text: 'US gains Influence equal to Stability in Yugoslavia, Romania, Bulgaria, Hungary, Czech (one each).' },
  { id: 'marshallplan', name: 'Marshall Plan', ops: 4, side: 'US', war: 'Early', starred: true, impl: 'marshallplan', text: '+1 US Influence to 7 W.Europe countries. Allows NATO.' },
  { id: 'indopakiwar', name: 'Indo-Pakistani War', ops: 2, side: 'Neutral', war: 'Early', starred: false, impl: 'war', text: 'Invade either India or Pakistan. Roll: -1 per opponent-controlled adjacent country.' },
  { id: 'containment', name: 'Containment', ops: 3, side: 'US', war: 'Early', starred: false, impl: 'opmod', text: '+1 to all US Operations this turn.' },
  { id: 'ciacreated', name: 'CIA Created', ops: 1, side: 'US', war: 'Early', starred: true, impl: 'noop', text: 'USSR reveals hand; then US performs 1 Op.' },
  { id: 'usjapan', name: 'US/Japan Mutual Defense Pact', ops: 4, side: 'US', war: 'Early', starred: true, impl: 'usjapan', text: 'US gains Japan. USSR may not coup/realign Japan.' },
  { id: 'suezcrisis', name: 'Suez Crisis', ops: 3, side: 'USSR', war: 'Early', starred: true, impl: 'removeinfluence', text: 'Remove up to 4 US Influence from Middle East (max 2 per country).' },
  { id: 'easteurunrest', name: 'East European Unrest', ops: 3, side: 'US', war: 'Early', starred: true, impl: 'removeinfluence', text: 'Remove up to 3 USSR Influence from E.Europe (max 2 per country).' },
  { id: 'decolonization', name: 'Decolonization', ops: 2, side: 'USSR', war: 'Early', starred: false, impl: 'influence', text: '+1 USSR Influence to 4 African/Asian countries.' },
  { id: 'redscare', name: 'Red Scare/Purge', ops: 4, side: 'Neutral', war: 'Early', starred: false, impl: 'opmod', text: '-1 to all opponent Operations this turn.' },
  { id: 'unintervention', name: 'UN Intervention', ops: 1, side: 'Neutral', war: 'Early', starred: false, impl: 'noop', text: 'Play with opponent card; cancel its event, use Ops. Not in headline.' },
  { id: 'destalinization', name: 'De-Stalinization', ops: 3, side: 'USSR', war: 'Early', starred: false, impl: 'destalinization', text: 'Redistribute up to 4 USSR Influence among countries (must leave 2 behind in sources).' },
  { id: 'nucleartestban', name: 'Nuclear Test Ban', ops: 4, side: 'Neutral', war: 'Early', starred: false, impl: 'defcon', text: 'Improve DEFCON 2; gain VP = DEFCON - 2.' },
  { id: 'formosan', name: 'Formosan Resolution', ops: 2, side: 'US', war: 'Early', starred: true, impl: 'noop', text: '+2 US VP if Taiwan controlled during Asia Scoring.' },
  { id: 'brushwar', name: 'Brush War', ops: 2, side: 'Neutral', war: 'Early', starred: false, impl: 'brushwar', text: 'Coup any non-adjacent-to-SP country; on 4-6 gain country +1 VP.' },
  { id: 'camscoring', name: 'Central America Scoring', war: 'Early', text: 'Score Central America.', ...SCORING('CentralAmerica') },
  { id: 'sascoring', name: 'South America Scoring', war: 'Early', text: 'Score South America.', ...SCORING('SouthAmerica') },
  { id: 'seascoring', name: 'Southeast Asia Scoring', war: 'Early', text: 'Score Southeast Asia.', ...SCORING('Asia'), starred: true, impl: 'score:SoutheastAsia' },

  // ---------------- MID WAR ----------------
  { id: 'cubanmissile', name: 'Cuban Missile Crisis', ops: 3, side: 'USSR', war: 'Mid', starred: true, impl: 'cubanmissile', text: 'Set DEFCON to 2. Opponent loses if they coup. Cancel by removing 2 Inf.' },
  { id: 'nuclearsubs', name: 'Nuclear Subs', ops: 2, side: 'US', war: 'Mid', starred: false, impl: 'noop', text: 'US coups do not degrade DEFCON this turn (while subs help).' },
  { id: 'quagmire', name: 'Quagmire', ops: 3, side: 'US', war: 'Mid', starred: true, impl: 'quagmire', text: 'USSR must discard a 2+ Op card and roll 1-4 to cancel, each action round.' },
  { id: 'salt', name: 'SALT Negotiations', ops: 3, side: 'Neutral', war: 'Mid', starred: false, impl: 'noop', text: 'Improve DEFCON 2. Take 1 card from discard or opponent draws.' },
  { id: 'beartrap', name: 'Bear Trap', ops: 3, side: 'US', war: 'Mid', starred: true, impl: 'beartrap', text: 'USSR must discard a 2+ Op card and roll 1-4 to cancel, each action round.' },
  { id: 'summit', name: 'Summit', ops: 3, side: 'Neutral', war: 'Mid', starred: false, impl: 'summit', text: 'Roll 1 die: improve DEFCON that much; +2 VP or cancel opponent headline ability.' },
  { id: 'worrying', name: 'How I Learned to Stop Worrying', ops: 2, side: 'Neutral', war: 'Mid', starred: true, impl: 'worrying', text: 'Set DEFCON to any level (1-5). Gain VP = 5 - new DEFCON.' },
  { id: 'junta', name: 'Junta', ops: 2, side: 'US', war: 'Mid', starred: false, impl: 'influence', text: '+2 US or remove 2 USSR in Central/South America.' },
  { id: 'kitchendebates', name: 'Kitchen Debates', ops: 1, side: 'US', war: 'Mid', starred: true, impl: 'kitchendebates', text: 'If US controls more Battlegrounds than USSR, US gains 2 VP.' },
  { id: 'missileenvy', name: 'Missile Envy', ops: 2, side: 'Neutral', war: 'Mid', starred: true, impl: 'noop', text: 'Exchange with opponent\'s highest Ops card; if only 1-2 Ops, +1 to it.' },
  { id: 'wewillburyyou', name: 'We Will Bury You', ops: 4, side: 'USSR', war: 'Mid', starred: true, impl: 'wewillburyyou', text: 'Degrade DEFCON 1. USSR gains 3 VP if US has not played this card.' },
  { id: 'brezhnev', name: 'Brezhnev Doctrine', ops: 3, side: 'USSR', war: 'Mid', starred: false, impl: 'opmod', text: '+1 to all USSR Operations this turn.' },
  { id: 'portugalempire', name: 'Portuguese Empire Crumbles', ops: 2, side: 'USSR', war: 'Mid', starred: true, impl: 'influence', text: '+2 USSR Influence to Angola and SE African States.' },
  { id: 'southafricanunrest', name: 'South African Unrest', ops: 2, side: 'USSR', war: 'Mid', starred: true, impl: 'removeinfluence', text: '-1 US Influence each in South Africa, Zaire, Botswana; +1 USSR South Africa.' },
  { id: 'allende', name: 'Allende', ops: 1, side: 'USSR', war: 'Mid', starred: true, impl: 'influence', text: 'USSR gains Chile.' },
  { id: 'willybrandt', name: 'Willy Brandt', ops: 2, side: 'USSR', war: 'Mid', starred: true, impl: 'noop', text: '+2 USSR W. Germany, -1 US W. Germany. Cancels NATO for W. Germany. +1 USSR VP.' },
  { id: 'muslimrevolution', name: 'Muslim Revolution', ops: 2, side: 'USSR', war: 'Mid', starred: true, impl: 'noop', text: 'Remove all US Influence from 2 Middle East countries (no Iran/Iraq). Removed if unplayable.' },
  { id: 'abm', name: 'ABM Treaty', ops: 3, side: 'Neutral', war: 'Mid', starred: false, impl: 'defcon', text: 'Improve DEFCON 2. US gains 1 VP.' },
  { id: 'culturalrevolution', name: 'Cultural Revolution', ops: 3, side: 'USSR', war: 'Mid', starred: true, impl: 'noop', text: 'If USSR holds The China Card, +1 VP; otherwise USSR takes The China Card face up.' },
  { id: 'flowerpower', name: 'Flower Power', ops: 4, side: 'USSR', war: 'Mid', starred: false, impl: 'noop', text: 'Permanent: USSR gains 2 VP whenever US plays a War card.' },
  { id: 'u2incident', name: 'U-2 Incident', ops: 1, side: 'USSR', war: 'Mid', starred: true, impl: 'u2incident', text: 'USSR gains 1 VP (and another if UN Intervention later).' },
  { id: 'opec', name: 'OPEC', ops: 3, side: 'USSR', war: 'Mid', starred: true, impl: 'opec', text: 'USSR gains 1 VP per controlled: Egypt, Iran, Libya, Saudi Arabia, Gulf States, Venezuela, Iraq.' },
  { id: 'lonegunman', name: '"Lone Gunman"', ops: 1, side: 'USSR', war: 'Mid', starred: true, impl: 'noop', text: 'US reveals hand; USSR gains 1 VP.' },
  { id: 'colonialrearguards', name: 'Colonial Rearguards', ops: 2, side: 'Neutral', war: 'Mid', starred: false, impl: 'influence', text: '+1 US Influence to 4 countries in Africa/Asia/SE Asia.' },
  { id: 'panamacanal', name: 'Panama Canal Returned', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'influence', text: '+1 US Influence to Panama, Venezuela, Colombia, Costa Rica.' },
  { id: 'campdavid', name: 'Camp David Accords', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'campdavid', text: '+1 US each to Israel, Egypt, Jordan. Cancels Arab-Israeli War event.' },
  { id: 'puppetgovs', name: 'Puppet Governments', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'influence', text: '+1 US Influence to 3 uncontrolled countries.' },
  { id: 'grainsales', name: 'Grain Sales to Soviets', ops: 2, side: 'US', war: 'Mid', starred: false, impl: 'noop', text: 'Randomly take 1 USSR card; play it or return it and use 2 Ops.' },
  { id: 'johnpaul', name: 'John Paul II Elected Pope', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'johnpaul', text: '-2 USSR Poland, +1 US Poland, +1 US E. Europe (allows Solidarity).' },
  { id: 'deathsquads', name: 'Latin American Death Squads', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'noop', text: 'Kill 2 Influence in Central/South America realign? Free realign.' },
  { id: 'oasfounded', name: 'OAS Founded', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'influence', text: '+2 US Influence in Central/South America.' },
  { id: 'nixonchina', name: 'Nixon Plays the China Card', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'noop', text: 'US takes The China Card (face up) if USSR holds it; +1 US VP.' },
  { id: 'sadatexpels', name: 'Sadat Expels Soviets', ops: 1, side: 'US', war: 'Mid', starred: true, impl: 'sadatexpels', text: '-3 USSR Egypt, +1 US Egypt, +1 US VP.' },
  { id: 'shuttlediplomacy', name: 'Shuttle Diplomacy', ops: 3, side: 'US', war: 'Mid', starred: false, impl: 'noop', text: 'Permanent: -1 USSR VP per中东 scoring? Reduce USSR Mideast score by 1.' },
  { id: 'voiceofamerica', name: 'The Voice of America', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'voiceofamerica', text: 'Remove up to 4 USSR Influence from non-European countries (max 2 each).' },
  { id: 'liberationtheology', name: 'Liberation Theology', ops: 2, side: 'USSR', war: 'Mid', starred: true, impl: 'influence', text: '+2 USSR Influence to 2 Central American countries.' },
  { id: 'ussuri', name: 'Ussuri River Skirmish', ops: 3, side: 'US', war: 'Mid', starred: true, impl: 'ussuri', text: '+2 USSR? USSR loses 2, China to US: -2 USSR anywhere, +1 US Asia, US takes China Card if held by USSR.' },
  { id: 'asknot', name: '"Ask Not..."', ops: 3, side: 'US', war: 'Mid', starred: true, impl: 'noop', text: 'Discard up to your whole hand (incl. this) and draw replacements.' },
  { id: 'allianceforprogress', name: 'Alliance for Progress', ops: 3, side: 'US', war: 'Mid', starred: true, impl: 'noop', text: 'US gains 1 VP per US-controlled Battleground in Central/South America.' },
  { id: 'africascoring', name: 'Africa Scoring', war: 'Mid', text: 'Score Africa.', ...SCORING('Africa') },
  { id: 'onesmallstep', name: '"One Small Step..."', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'onesmallstep', text: 'If behind on Space Race, move 2 boxes forward (gain 2nd-box VP only).' },
  { id: 'armsrace', name: 'Arms Race', ops: 3, side: 'Neutral', war: 'Mid', starred: false, impl: 'armsrace', text: '+3 VP if ahead on Space Race, +1 if tied, else 0.' },
  { id: 'solidarity', name: 'Solidarity', ops: 2, side: 'US', war: 'Mid', starred: true, impl: 'noop', text: '+3 US Poland. Requires John Paul II. Permanent until Martial Law.' },
  { id: 'iranianhostage', name: 'Iranian Hostage Crisis', ops: 3, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: 'USSR gains Iran. -1 US VP.' },

  // ---------------- LATE WAR ----------------
  { id: 'ironlady', name: 'The Iron Lady', ops: 3, side: 'US', war: 'Late', starred: true, impl: 'noop', text: '+1 US Argentina, USSR loses all Argentina, +1 US VP. Cancels Socialist Govs in UK.' },
  { id: 'reganlibya', name: 'Reagan Bombs Libya', ops: 2, side: 'US', war: 'Late', starred: true, impl: 'noop', text: 'US gains 1 VP; USSR loses all Influence in Libya.' },
  { id: 'starwars', name: 'Star Wars', ops: 2, side: 'US', war: 'Late', starred: true, impl: 'noop', text: 'If US ahead on Space Race, reveal USSR headline then discard a card.' },
  { id: 'northseaoil', name: 'North Sea Oil', ops: 1, side: 'US', war: 'Late', starred: false, impl: 'noop', text: '+1 US W.Europe. Cancels OPEC permanent event.' },
  { id: 'reformer', name: 'The Reformer', ops: 3, side: 'USSR', war: 'Late', starred: false, impl: 'noop', text: 'Permanent: USSR may place 2 Influence free in Europe, ignoring adjacency; +1 in E. Europe.' },
  { id: 'marinebarracks', name: 'Marine Barracks Bombing', ops: 1, side: 'USSR', war: 'Late', starred: false, impl: 'noop', text: '-2 US Influence each in Lebanon, Israel, plus 1 random Middle East.' },
  { id: 'kal007', name: 'Soviets Shoot Down KAL-007', ops: 2, side: 'US', war: 'Late', starred: true, impl: 'noop', text: 'US gains 2 VP, +1 US South Korea. Degrade DEFCON 1.' },
  { id: 'glasnost', name: 'Glasnost', ops: 3, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: 'Improve DEFCON 2. +2 USSR Poland, +1 USSR E. Europe.' },
  { id: 'ortega', name: 'Ortega Elected in Nicaragua', ops: 2, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: 'USSR gains Nicaragua; cancels All influence in... +1 USSR Central America.' },
  { id: 'terrorism', name: 'Terrorism', ops: 2, side: 'USSR', war: 'Late', starred: false, impl: 'noop', text: 'Opponent discards a random card (2 if Terrorism starred).' },
  { id: 'irancontra', name: 'Iran-Contra Scandal', ops: 2, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: '-2 US Influence in 2 Central American countries.' },
  { id: 'chernobyl', name: 'Chernobyl', ops: 3, side: 'US', war: 'Late', starred: true, impl: 'noop', text: 'Prevent USSR from placing Influence in one region this turn (Ops events fail there).' },
  { id: 'debtcrisis', name: 'Latin American Debt Crisis', ops: 2, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: 'US discards a 3+ Op card or USSR gains influence in S. America (2 countries).' },
  { id: 'teardown', name: '"Tear Down This Wall"', ops: 3, side: 'US', war: 'Late', starred: true, impl: 'noop', text: '+3 US E. Germany. Cancel Socialist Govs + Reformer + Solidarity in E. Europe.' },
  { id: 'evilempire', name: '"An Evil Empire"', ops: 3, side: 'US', war: 'Late', starred: true, impl: 'noop', text: '+1 US VP, +2 US Influence in Central America, cancel Flower Power.' },
  { id: 'aldrichames', name: 'Aldrich Ames', ops: 2, side: 'USSR', war: 'Late', starred: true, impl: 'noop', text: 'Permanent: reveal US headline, US discards a card each turn.' },
  { id: 'pershing2', name: 'Pershing II Deployed', ops: 3, side: 'US', war: 'Late', starred: false, impl: 'noop', text: 'US gains 1 VP; all USSR realignments in Europe +1.' },
  { id: 'wargames', name: 'Wargames', ops: 2, side: 'Neutral', war: 'Late', starred: true, impl: 'noop', text: 'Set DEFCON to 1; if US at 7+ VP, US holds a "drill" (US wins at 7+). Defcon race.' },
  { id: 'iraniraqwar', name: 'Iran-Iraq War', ops: 2, side: 'Neutral', war: 'Late', starred: true, impl: 'war', text: 'Invade Iran or Iraq. Roll: -1 per opponent-controlled adjacent country.' },
  { id: 'defectors', name: 'Defectors', ops: 2, side: 'US', war: 'Early', starred: false, impl: 'noop', text: 'Cancel USSR headline if played as headline.' },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((card) => [card.id, card]),
);

export function getCard(id: string): CardDef {
  const c = CARD_BY_ID[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}

export function isScoring(id: string): boolean {
  return !!CARD_BY_ID[id]?.scoring;
}

export const SCORING_CARDS = CARDS.filter((c) => c.scoring).map((c) => c.id);

// The China Card is not part of any deck pile; held separately.
export const CHINA_CARD_ID = 'thechinacard';
export const CHINA_CARD: CardDef = {
  id: CHINA_CARD_ID,
  name: 'The China Card',
  ops: 4,
  side: 'Neutral',
  war: 'Early',
  starred: false,
  impl: 'noop',
  text: 'Play as 4 Ops (5 if all spent in Asia). Passed face-down to opponent when played.',
};

export function warCards(): CardDef[] {
  return CARDS.filter((c) => c.impl === 'war');
}

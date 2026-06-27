// ============================================================================
// setup.ts — Initial influence placement (rules 3.2, 3.3, 3.4).
// ============================================================================

import { Side } from './cards';

export interface SetupEntry {
  country: string;
  side: Side;
  amount: number;
}

// USSR setup: 15 influence (rule 3.2). Fixed portion + 6 flexible in E. Europe.
export const USSR_FIXED_SETUP: SetupEntry[] = [
  { country: 'syria', side: 'USSR', amount: 1 },
  { country: 'iraq', side: 'USSR', amount: 1 },
  { country: 'nkorea', side: 'USSR', amount: 3 },
  { country: 'egermany', side: 'USSR', amount: 3 },
  { country: 'finland', side: 'USSR', amount: 1 },
];

// US setup: 25 influence (rule 3.3). Fixed portion + 7 flexible in W. Europe.
export const US_FIXED_SETUP: SetupEntry[] = [
  { country: 'canada', side: 'US', amount: 2 },
  { country: 'iran', side: 'US', amount: 1 },
  { country: 'israel', side: 'US', amount: 1 },
  { country: 'japan', side: 'US', amount: 1 },
  { country: 'australia', side: 'US', amount: 4 },
  { country: 'philippines', side: 'US', amount: 1 },
  { country: 'skorea', side: 'US', amount: 1 },
  { country: 'panama', side: 'US', amount: 1 },
  { country: 'southafrica', side: 'US', amount: 1 },
  { country: 'uk', side: 'US', amount: 5 },
];

// Flex pools (placed by the players at setup). For automated setup we just
// distribute the flex into sensible default countries.
export const USSR_FLEX = { amount: 6, region: 'EasternEurope' as const };
export const US_FLEX = { amount: 7, region: 'WesternEurope' as const };

export const USSR_DEFAULT_FLEX: SetupEntry[] = [
  { country: 'poland', side: 'USSR', amount: 4 },
  { country: 'yugoslavia', side: 'USSR', amount: 1 },
  { country: 'romania', side: 'USSR', amount: 1 },
];

export const US_DEFAULT_FLEX: SetupEntry[] = [
  { country: 'wgermany', side: 'US', amount: 2 },
  { country: 'italy', side: 'US', amount: 3 },
  { country: 'france', side: 'US', amount: 1 },
  { country: 'spain', side: 'US', amount: 1 },
];

import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS, CHINA_CARD_ID, SCORING_CARDS, getCard } from '../data/cards';
import { COUNTRIES, COUNTRY_IDS } from '../data/map';

describe('source data', () => {
  it('loads the full 110-card source list while excluding China from the draw deck', () => {
    expect(ALL_CARDS).toHaveLength(110);
    expect(new Set(ALL_CARDS.map((card) => card.id)).size).toBe(110);
    expect(getCard(CHINA_CARD_ID).number).toBe(6);
    expect(CARDS).toHaveLength(109);
    expect(CARDS.some((card) => card.id === CHINA_CARD_ID)).toBe(false);
  });

  it('matches known card values from the extracted card table', () => {
    expect(getCard('brushwar')).toMatchObject({ number: 36, ops: 3, war: 'Mid', side: 'Neutral' });
    expect(getCard('summit')).toMatchObject({ number: 45, ops: 1, war: 'Mid', side: 'Neutral' });
    expect(getCard('muslimrevolution')).toMatchObject({ number: 56, ops: 4, war: 'Mid', side: 'USSR' });
    expect(getCard('abm')).toMatchObject({ number: 57, ops: 4, war: 'Mid', side: 'Neutral' });
    expect(getCard('ironlady')).toMatchObject({ number: 83, ops: 3, war: 'Late', side: 'US' });
    expect(getCard('optional-awacs')).toMatchObject({ number: 110, ops: 3, war: 'Mid', optional: true });
  });

  it('has the seven official scoring cards and removes Southeast Asia after play', () => {
    expect(SCORING_CARDS.sort()).toEqual([
      'africascoring',
      'asiascoring',
      'camscoring',
      'europescoring',
      'mideastscoring',
      'sascoring',
      'seascoring',
    ].sort());
    expect(getCard('seascoring')).toMatchObject({ starred: true, scoring: 'SoutheastAsia' });
  });

  it('does not put non-European setup countries into Europe scoring', () => {
    expect(COUNTRIES.canada.region).toBe('NorthAmerica');
    expect(COUNTRIES.mexico.region).toBe('CentralAmerica');
    expect(COUNTRIES.canada.scoringRegion).toBeUndefined();
    expect(COUNTRIES.mexico.scoringRegion).toBe('CentralAmerica');
    expect(COUNTRY_IDS).toContain('canada');
  });
});

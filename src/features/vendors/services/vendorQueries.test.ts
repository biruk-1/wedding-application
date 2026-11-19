import { describe, expect, it } from 'vitest';

import {
  categoryIdsMatching,
  searchPattern,
  startingPrice,
  summarizeRatings,
} from '@/features/vendors/services/vendorQueries';

describe('vendor search helpers', () => {
  it('strips characters that could alter a PostgREST filter', () => {
    expect(searchPattern('lumen lace')).toBe('%lumen%lace%');
    expect(searchPattern('a,b),id.eq.x')).toBe('%a%b%id%eq%x%');
    expect(searchPattern('  %%  ')).toBeNull();
  });

  it('matches categories by English or Amharic name', () => {
    const categories = [
      { id: 'c1', name_en: 'Photographer', name_am: 'ፎቶግራፈር' },
      { id: 'c2', name_en: 'Venue', name_am: null },
    ];
    expect(categoryIdsMatching('photo', categories)).toEqual(['c1']);
    expect(categoryIdsMatching('ፎቶ', categories)).toEqual(['c1']);
    expect(categoryIdsMatching('', categories)).toEqual([]);
  });

  it('uses the lowest priced service as the starting price', () => {
    expect(
      startingPrice([
        { base_price: 45000, currency_code: 'ETB', price_unit: 'package' },
        { base_price: null, currency_code: 'ETB', price_unit: 'custom' },
        { base_price: 12000, currency_code: 'ETB', price_unit: 'hour' },
      ]),
    ).toEqual({ amount: 12000, currencyCode: 'ETB', priceUnit: 'hour' });
    expect(startingPrice([])).toBeNull();
  });

  it('only reports a rating when real reviews exist', () => {
    expect(summarizeRatings([])).toBeNull();
    expect(summarizeRatings([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});

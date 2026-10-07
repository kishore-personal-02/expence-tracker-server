import { CATEGORY_ICONS, getCategoryIcon } from './expense-icons';

describe('getCategoryIcon', () => {
  it('returns the mapped phosphor icon for known categories', () => {
    expect(getCategoryIcon('Food')).toBe('phosphorBowlFood');
    expect(getCategoryIcon('Transport')).toBe('phosphorCar');
    expect(getCategoryIcon('Housing')).toBe('phosphorHouseLine');
  });

  it('falls back to a stable derived icon for unknown categories', () => {
    const icon = getCategoryIcon('Pets');
    expect(icon).toBeTruthy();
    expect(getCategoryIcon('Pets')).toBe(icon);
    expect(getCategoryIcon(null)).toBe('phosphorPackage');
    expect(getCategoryIcon('')).toBe('phosphorPackage');
  });

  it('covers every standard category', () => {
    for (const key of Object.keys(CATEGORY_ICONS)) {
      expect(getCategoryIcon(key)).toBe(CATEGORY_ICONS[key]);
    }
  });
});
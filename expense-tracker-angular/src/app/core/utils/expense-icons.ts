export const CATEGORY_ICONS: Record<string, string> = {
  Food: 'phosphorBowlFood',
  Transport: 'phosphorCar',
  Housing: 'phosphorHouseLine',
  Utilities: 'phosphorLightbulb',
  Entertainment: 'phosphorFilmStrip',
  Healthcare: 'phosphorFirstAid',
  Shopping: 'phosphorShoppingBag',
  Education: 'phosphorBookOpen',
  Other: 'phosphorPackage',
};

const FALLBACK_ICONS = [
  'phosphorPackage',
  'phosphorReceipt',
  'phosphorBriefcase',
  'phosphorGift',
  'phosphorCoffee',
  'phosphorPawPrint',
  'phosphorUmbrella',
  'phosphorGameController',
  'phosphorChartLineUp',
  'phosphorShoppingCart',
];

const DEFAULT_ICON = 'phosphorPackage';

export function getCategoryIcon(category: string | null | undefined): string {
  if (!category) return DEFAULT_ICON;
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  const hash = category.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return FALLBACK_ICONS[hash % FALLBACK_ICONS.length];
}
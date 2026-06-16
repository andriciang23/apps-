export interface DrinkEntry {
  id: string;
  name: string;
  shopName: string;
  price: number;
  currency: string;
  photoUri?: string;
  photoStorageUrl?: string;
  location?: DrinkLocation;
  tags: DrinkTag[];
  notes?: string;
  createdAt: string; // ISO string
  userId?: string;
}

export interface DrinkLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
  address?: string;
}

export type DrinkTag =
  | 'coffee'
  | 'tea'
  | 'bubble_tea'
  | 'juice'
  | 'smoothie'
  | 'soda'
  | 'water'
  | 'alcohol'
  | 'energy_drink'
  | 'other';

export const TAG_LABELS: Record<DrinkTag, string> = {
  coffee: 'Coffee',
  tea: 'Tea',
  bubble_tea: 'Bubble Tea',
  juice: 'Juice',
  smoothie: 'Smoothie',
  soda: 'Soda',
  water: 'Water',
  alcohol: 'Alcohol',
  energy_drink: 'Energy Drink',
  other: 'Other',
};

export const TAG_EMOJIS: Record<DrinkTag, string> = {
  coffee: '☕',
  tea: '🍵',
  bubble_tea: '🧋',
  juice: '🧃',
  smoothie: '🥤',
  soda: '🥤',
  water: '💧',
  alcohol: '🍹',
  energy_drink: '⚡',
  other: '🫙',
};

export interface AnalyticsSummary {
  totalSpent: number;
  drinkCount: number;
  averagePerDrink: number;
  mostVisitedShop?: string;
  topCategory?: DrinkTag;
  streak: number;
}

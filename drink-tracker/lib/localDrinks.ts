import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrinkEntry, DrinkTag, AnalyticsSummary } from '../types';
import { getDay, parseISO } from 'date-fns';

const KEY = 'siplog_drinks';

async function readAll(): Promise<DrinkEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as DrinkEntry[]) : [];
}

async function writeAll(drinks: DrinkEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(drinks));
}

export async function addDrinkLocal(
  data: Omit<DrinkEntry, 'id' | 'createdAt'>
): Promise<string> {
  const drinks = await readAll();
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const entry: DrinkEntry = { ...data, id, createdAt: new Date().toISOString() };
  await writeAll([entry, ...drinks]);
  return id;
}

export async function updateDrinkLocal(
  id: string,
  data: Partial<Omit<DrinkEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const drinks = await readAll();
  await writeAll(drinks.map((d) => (d.id === id ? { ...d, ...data } : d)));
}

export async function deleteDrinkLocal(id: string): Promise<void> {
  const drinks = await readAll();
  await writeAll(drinks.filter((d) => d.id !== id));
}

export async function getDrinkLocal(id: string): Promise<DrinkEntry | null> {
  const drinks = await readAll();
  return drinks.find((d) => d.id === id) ?? null;
}

export async function getAllDrinksLocal(): Promise<DrinkEntry[]> {
  return readAll();
}

export async function getRecentDrinksLocal(count = 20): Promise<DrinkEntry[]> {
  const drinks = await readAll();
  return drinks.slice(0, count);
}

export async function getDrinksByDateRangeLocal(
  start: Date,
  end: Date
): Promise<DrinkEntry[]> {
  const drinks = await readAll();
  return drinks.filter((d) => {
    const t = new Date(d.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

export async function getAnalyticsLocal(
  start: Date,
  end: Date
): Promise<AnalyticsSummary> {
  const drinks = await getDrinksByDateRangeLocal(start, end);
  if (drinks.length === 0) return { totalSpent: 0, drinkCount: 0, averagePerDrink: 0, streak: 0 };

  const totalSpent = drinks.reduce((s, d) => s + d.price, 0);
  const shopCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  for (const d of drinks) {
    shopCounts[d.shopName] = (shopCounts[d.shopName] ?? 0) + 1;
    for (const t of d.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const mostVisitedShop = Object.entries(shopCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCategory = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as DrinkTag | undefined;

  const allDrinks = await readAll();
  const days = new Set(allDrinks.map((d) => d.createdAt.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    drinkCount: drinks.length,
    averagePerDrink: Math.round((totalSpent / drinks.length) * 100) / 100,
    mostVisitedShop,
    topCategory,
    streak,
  };
}

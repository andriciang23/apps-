// Automatically uses local storage if Firebase is not configured.
// To enable Firebase: copy .env.example to .env and fill in your keys.

const hasFirebase =
  !!process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== 'YOUR_PROJECT_ID';

export { hasFirebase };

export async function addDrink(data: Parameters<typeof import('./drinks')['addDrink']>[0]) {
  if (hasFirebase) {
    const { addDrink: fn } = await import('./drinks');
    return fn(data);
  }
  const { addDrinkLocal: fn } = await import('./localDrinks');
  return fn(data);
}

export async function updateDrink(
  id: string,
  data: Parameters<typeof import('./drinks')['updateDrink']>[1]
) {
  if (hasFirebase) {
    const { updateDrink: fn } = await import('./drinks');
    return fn(id, data);
  }
  const { updateDrinkLocal: fn } = await import('./localDrinks');
  return fn(id, data);
}

export async function deleteDrink(id: string, photoStorageUrl?: string) {
  if (hasFirebase) {
    const { deleteDrink: fn } = await import('./drinks');
    return fn(id, photoStorageUrl);
  }
  const { deleteDrinkLocal: fn } = await import('./localDrinks');
  return fn(id);
}

export async function getDrink(id: string) {
  if (hasFirebase) {
    const { getDrink: fn } = await import('./drinks');
    return fn(id);
  }
  const { getDrinkLocal: fn } = await import('./localDrinks');
  return fn(id);
}

export async function getAllDrinks() {
  if (hasFirebase) {
    const { getAllDrinks: fn } = await import('./drinks');
    return fn();
  }
  const { getAllDrinksLocal: fn } = await import('./localDrinks');
  return fn();
}

export async function getRecentDrinks(count?: number) {
  if (hasFirebase) {
    const { getRecentDrinks: fn } = await import('./drinks');
    return fn(count);
  }
  const { getRecentDrinksLocal: fn } = await import('./localDrinks');
  return fn(count);
}

export async function getDrinksByDateRange(start: Date, end: Date) {
  if (hasFirebase) {
    const { getDrinksByDateRange: fn } = await import('./drinks');
    return fn(start, end);
  }
  const { getDrinksByDateRangeLocal: fn } = await import('./localDrinks');
  return fn(start, end);
}

export async function getAnalytics(start: Date, end: Date) {
  if (hasFirebase) {
    const { getAnalytics: fn } = await import('./drinks');
    return fn(start, end);
  }
  const { getAnalyticsLocal: fn } = await import('./localDrinks');
  return fn(start, end);
}

export async function uploadDrinkPhoto(localUri: string, drinkId: string) {
  if (hasFirebase) {
    const { uploadDrinkPhoto: fn } = await import('./drinks');
    return fn(localUri, drinkId);
  }
  // In local mode, just return the local URI as-is
  return localUri;
}

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type { DrinkEntry, DrinkTag, AnalyticsSummary } from '../types';

const COLLECTION = 'drinks';

export async function uploadDrinkPhoto(
  localUri: string,
  drinkId: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `drinks/${drinkId}/photo.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

export async function addDrink(
  data: Omit<DrinkEntry, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateDrink(
  id: string,
  data: Partial<Omit<DrinkEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, data);
}

export async function deleteDrink(id: string, photoStorageUrl?: string): Promise<void> {
  if (photoStorageUrl) {
    try {
      const photoRef = ref(storage, `drinks/${id}/photo.jpg`);
      await deleteObject(photoRef);
    } catch {
      // ignore if file doesn't exist
    }
  }
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getDrink(id: string): Promise<DrinkEntry | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return firestoreDocToDrink(snap.id, snap.data());
}

export async function getAllDrinks(): Promise<DrinkEntry[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => firestoreDocToDrink(d.id, d.data()));
}

export async function getDrinksByDateRange(
  start: Date,
  end: Date
): Promise<DrinkEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<=', Timestamp.fromDate(end)),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => firestoreDocToDrink(d.id, d.data()));
}

export async function getRecentDrinks(count = 20): Promise<DrinkEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => firestoreDocToDrink(d.id, d.data()));
}

export async function getAnalytics(
  start: Date,
  end: Date
): Promise<AnalyticsSummary> {
  const drinks = await getDrinksByDateRange(start, end);

  if (drinks.length === 0) {
    return {
      totalSpent: 0,
      drinkCount: 0,
      averagePerDrink: 0,
      streak: 0,
    };
  }

  const totalSpent = drinks.reduce((s, d) => s + d.price, 0);
  const shopCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  for (const d of drinks) {
    shopCounts[d.shopName] = (shopCounts[d.shopName] ?? 0) + 1;
    for (const t of d.tags) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }

  const mostVisitedShop = Object.entries(shopCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCategory = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | DrinkTag
    | undefined;

  const streak = calculateStreak(drinks);

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    drinkCount: drinks.length,
    averagePerDrink: Math.round((totalSpent / drinks.length) * 100) / 100,
    mostVisitedShop,
    topCategory,
    streak,
  };
}

function calculateStreak(drinks: DrinkEntry[]): number {
  if (drinks.length === 0) return 0;
  const days = new Set(drinks.map((d) => d.createdAt.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function firestoreDocToDrink(id: string, data: Record<string, unknown>): DrinkEntry {
  let createdAt: string;
  if (data.createdAt instanceof Timestamp) {
    createdAt = data.createdAt.toDate().toISOString();
  } else if (typeof data.createdAt === 'string') {
    createdAt = data.createdAt;
  } else {
    createdAt = new Date().toISOString();
  }
  return {
    id,
    name: String(data.name ?? ''),
    shopName: String(data.shopName ?? ''),
    price: Number(data.price ?? 0),
    currency: String(data.currency ?? 'USD'),
    photoUri: data.photoUri as string | undefined,
    photoStorageUrl: data.photoStorageUrl as string | undefined,
    location: data.location as DrinkEntry['location'],
    tags: (data.tags as DrinkTag[]) ?? [],
    notes: data.notes as string | undefined,
    createdAt,
    userId: data.userId as string | undefined,
  };
}

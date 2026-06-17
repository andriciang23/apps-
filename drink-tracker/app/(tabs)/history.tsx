import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { getAllDrinks, deleteDrink } from '../../lib/storage';
import DrinkCard from '../../components/DrinkCard';
import { TAG_EMOJIS, TAG_LABELS } from '../../types';
import type { DrinkEntry, DrinkTag } from '../../types';

type Period = 'all' | 'this_month' | 'last_month';

export default function HistoryScreen() {
  const router = useRouter();
  const [drinks, setDrinks] = useState<DrinkEntry[]>([]);
  const [filtered, setFiltered] = useState<DrinkEntry[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<DrinkTag | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await getAllDrinks();
      setDrinks(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = drinks;

    // period filter
    const now = new Date();
    if (period === 'this_month') {
      const s = startOfMonth(now);
      const e = endOfMonth(now);
      result = result.filter((d) => {
        const date = parseISO(d.createdAt);
        return date >= s && date <= e;
      });
    } else if (period === 'last_month') {
      const last = subMonths(now, 1);
      const s = startOfMonth(last);
      const e = endOfMonth(last);
      result = result.filter((d) => {
        const date = parseISO(d.createdAt);
        return date >= s && date <= e;
      });
    }

    // tag filter
    if (tagFilter) {
      result = result.filter((d) => d.tags.includes(tagFilter));
    }

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.shopName.toLowerCase().includes(q) ||
          (d.notes ?? '').toLowerCase().includes(q) ||
          (d.location?.placeName ?? '').toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [drinks, search, tagFilter, period]);

  const handleDelete = useCallback((drink: DrinkEntry) => {
    Alert.alert(
      'Delete drink?',
      `Remove "${drink.name}" from your log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDrink(drink.id, drink.photoStorageUrl);
              setDrinks((prev) => prev.filter((d) => d.id !== drink.id));
            } catch {
              Alert.alert('Error', 'Could not delete drink.');
            }
          },
        },
      ]
    );
  }, []);

  const totalFiltered = filtered.reduce((s, d) => s + d.price, 0);
  const currency = drinks[0]?.currency ?? 'USD';

  const TAGS_TO_SHOW: DrinkTag[] = ['coffee', 'tea', 'bubble_tea', 'juice', 'smoothie', 'soda', 'other'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>

        {/* Search */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search drinks, shops..."
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Period filter */}
        <View style={styles.filterRow}>
          {(['all', 'this_month', 'last_month'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.filterChip, period === p && styles.filterChipActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.filterChipText, period === p && styles.filterChipTextActive]}>
                {p === 'all' ? 'All time' : p === 'this_month' ? 'This month' : 'Last month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tag filter */}
        <View style={styles.tagScrollRow}>
          <TouchableOpacity
            style={[styles.tagFilterChip, !tagFilter && styles.tagFilterChipActive]}
            onPress={() => setTagFilter(null)}
          >
            <Text style={[styles.tagFilterText, !tagFilter && styles.tagFilterTextActive]}>All</Text>
          </TouchableOpacity>
          {TAGS_TO_SHOW.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagFilterChip,
                tagFilter === tag && { backgroundColor: Colors.tags[tag], borderColor: Colors.tags[tag] },
              ]}
              onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              <Text style={[styles.tagFilterText, tagFilter === tag && { color: '#fff' }]}>
                {TAG_EMOJIS[tag]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary bar */}
        {filtered.length > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {filtered.length} drinks · {currency} {totalFiltered.toFixed(2)}
            </Text>
          </View>
        )}

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DrinkCard
              drink={item}
              onPress={() => router.push(`/drink/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{loading ? '⏳' : '📭'}</Text>
              <Text style={styles.emptyText}>
                {loading ? 'Loading...' : search ? 'No results found.' : 'No drinks logged yet.'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: 16 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingTop: 8,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: Colors.text },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  filterChipTextActive: { color: '#fff' },
  tagScrollRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  tagFilterChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagFilterText: { fontSize: 16 },
  tagFilterTextActive: { color: '#fff', fontWeight: '700' },
  summaryBar: {
    backgroundColor: Colors.secondary + '20',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  list: { paddingTop: 4, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});

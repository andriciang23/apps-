import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { getRecentDrinks, getAnalytics } from '../../lib/drinks';
import DrinkCard from '../../components/DrinkCard';
import StatsCard from '../../components/StatsCard';
import StickerImage from '../../components/StickerImage';
import type { DrinkEntry, AnalyticsSummary } from '../../types';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [drinks, setDrinks] = useState<DrinkEntry[]>([]);
  const [todayDrinks, setTodayDrinks] = useState<DrinkEntry[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const recent = await getRecentDrinks(30);
      setDrinks(recent);
      const today = recent.filter((d) => isToday(parseISO(d.createdAt)));
      setTodayDrinks(today);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = await getAnalytics(monthStart, now);
      setSummary(stats);
    } catch (e) {
      console.error('Failed to load drinks:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const todayTotal = todayDrinks.reduce((s, d) => s + d.price, 0);
  const currency = drinks[0]?.currency ?? 'USD';

  const grouped = drinks.reduce<Record<string, DrinkEntry[]>>((acc, d) => {
    const date = parseISO(d.createdAt);
    const key = isToday(date)
      ? 'Today'
      : isYesterday(date)
      ? 'Yesterday'
      : format(date, 'MMMM d, yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Sip Log 🥤</Text>
            <Text style={styles.subGreeting}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/add')}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Today's sticker wall */}
        {todayDrinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Sips</Text>
            <View style={styles.stickerWall}>
              {todayDrinks.map((d, i) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => router.push(`/drink/${d.id}`)}
                  activeOpacity={0.85}
                >
                  <StickerImage
                    uri={d.photoStorageUrl ?? d.photoUri}
                    tag={d.tags[0]}
                    size={72}
                    rotation={(i % 2 === 0 ? 1 : -1) * (2 + (i % 3))}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Today stats */}
        <View style={styles.statsRow}>
          <StatsCard
            icon="💰"
            label="Spent today"
            value={`${currency} ${todayTotal.toFixed(2)}`}
            accent={Colors.primary}
          />
          <View style={{ width: 10 }} />
          <StatsCard
            icon="🫙"
            label="Drinks today"
            value={String(todayDrinks.length)}
            accent={Colors.secondary}
          />
        </View>

        {/* Month stats */}
        {summary && (
          <View style={styles.statsRow}>
            <StatsCard
              icon="📅"
              label="This month"
              value={`${currency} ${summary.totalSpent.toFixed(2)}`}
              accent={Colors.warning}
              small
            />
            <View style={{ width: 10 }} />
            <StatsCard
              icon="🔥"
              label="Day streak"
              value={`${summary.streak} days`}
              accent={Colors.error}
              small
            />
            <View style={{ width: 10 }} />
            <StatsCard
              icon="🏪"
              label="Fav shop"
              value={summary.mostVisitedShop ? summary.mostVisitedShop.split(' ')[0] : '—'}
              accent={Colors.secondary}
              small
            />
          </View>
        )}

        {/* Recent drinks by date */}
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : drinks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🥤</Text>
            <Text style={styles.emptyTitle}>No drinks yet!</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Add" to log your first sip.</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <View key={dateLabel} style={styles.group}>
              <Text style={styles.groupLabel}>{dateLabel}</Text>
              {items.map((d) => (
                <DrinkCard
                  key={d.id}
                  drink={d}
                  onPress={() => router.push(`/drink/${d.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  stickerWall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  group: { marginBottom: 16 },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textLight, textAlign: 'center' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});

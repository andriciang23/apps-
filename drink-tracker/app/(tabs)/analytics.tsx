import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { getDrinksByDateRange, getAnalytics } from '../../lib/storage';
import StatsCard from '../../components/StatsCard';
import { TAG_EMOJIS, TAG_LABELS } from '../../types';
import type { DrinkEntry, DrinkTag, AnalyticsSummary } from '../../types';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

type Period = '7d' | '30d' | 'this_month' | 'last_month';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  this_month: 'This Month',
  last_month: 'Last Month',
};

const chartConfig = {
  backgroundColor: Colors.card,
  backgroundGradientFrom: Colors.card,
  backgroundGradientTo: Colors.card,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
  labelColor: () => Colors.textLight,
  style: { borderRadius: 12 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<Period>('30d');
  const [drinks, setDrinks] = useState<DrinkEntry[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const getRange = useCallback((): [Date, Date] => {
    const now = new Date();
    if (period === '7d') return [new Date(now.getTime() - 7 * 86400000), now];
    if (period === '30d') return [new Date(now.getTime() - 30 * 86400000), now];
    if (period === 'this_month') return [startOfMonth(now), endOfMonth(now)];
    const last = subMonths(now, 1);
    return [startOfMonth(last), endOfMonth(last)];
  }, [period]);

  const load = useCallback(async () => {
    try {
      const [start, end] = getRange();
      const [data, stats] = await Promise.all([
        getDrinksByDateRange(start, end),
        getAnalytics(start, end),
      ]);
      setDrinks(data);
      setSummary(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getRange]);

  useEffect(() => { load(); }, [load]);

  const currency = drinks[0]?.currency ?? 'USD';

  // Spending by day (last N days)
  const spendByDay = useMemo(() => {
    const [start, end] = getRange();
    const days = eachDayOfInterval({ start, end });
    const labels = days.map((d) => format(d, 'M/d'));
    const data = days.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      return drinks
        .filter((dr) => dr.createdAt.startsWith(key))
        .reduce((s, dr) => s + dr.price, 0);
    });
    // Thin out labels to avoid crowding
    const step = Math.max(1, Math.floor(labels.length / 6));
    const sparseLabels = labels.map((l, i) => (i % step === 0 ? l : ''));
    return { labels: sparseLabels, data };
  }, [drinks, getRange]);

  // Drinks by category (pie)
  const byCategory = useMemo(() => {
    const counts: Partial<Record<DrinkTag, number>> = {};
    for (const d of drinks) {
      for (const t of d.tags) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    const tagColors = [
      '#FF6B6B', '#4ECDC4', '#FFE66D', '#9B59B6', '#3498DB',
      '#E67E22', '#E84393', '#2ECC71', '#F1C40F', '#95A5A6',
    ];
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([tag, count], i) => ({
        name: TAG_LABELS[tag as DrinkTag] ?? tag,
        count,
        color: tagColors[i % tagColors.length],
        legendFontColor: Colors.text,
        legendFontSize: 12,
      }));
  }, [drinks]);

  // Drinks by day of week
  const byDOW = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of drinks) {
      const dow = getDay(parseISO(d.createdAt));
      counts[dow]++;
    }
    return { labels: DOW_LABELS, data: counts };
  }, [drinks]);

  // Top shops
  const topShops = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    for (const d of drinks) {
      if (!counts[d.shopName]) counts[d.shopName] = { count: 0, total: 0 };
      counts[d.shopName].count++;
      counts[d.shopName].total += d.price;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);
  }, [drinks]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
      >
        <Text style={styles.title}>Analytics</Text>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading analytics...</Text>
        ) : summary && summary.drinkCount === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No data for this period.</Text>
          </View>
        ) : (
          <>
            {/* Summary stats */}
            {summary && (
              <>
                <View style={styles.statsRow}>
                  <StatsCard
                    icon="💰"
                    label="Total spent"
                    value={`${currency} ${summary.totalSpent.toFixed(2)}`}
                    accent={Colors.primary}
                  />
                  <View style={{ width: 10 }} />
                  <StatsCard
                    icon="🫙"
                    label="Total drinks"
                    value={String(summary.drinkCount)}
                    accent={Colors.secondary}
                  />
                </View>
                <View style={styles.statsRow}>
                  <StatsCard
                    icon="💸"
                    label="Avg per drink"
                    value={`${currency} ${summary.averagePerDrink.toFixed(2)}`}
                    accent={Colors.warning}
                    small
                  />
                  <View style={{ width: 10 }} />
                  {summary.topCategory && (
                    <StatsCard
                      icon={TAG_EMOJIS[summary.topCategory]}
                      label="Top category"
                      value={TAG_LABELS[summary.topCategory]}
                      accent={Colors.tags[summary.topCategory]}
                      small
                    />
                  )}
                  <View style={{ width: 10 }} />
                  <StatsCard
                    icon="🔥"
                    label="Day streak"
                    value={`${summary.streak}d`}
                    accent={Colors.error}
                    small
                  />
                </View>
              </>
            )}

            {/* Spend over time */}
            {spendByDay.data.some((v) => v > 0) && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Spend Over Time ({currency})</Text>
                <LineChart
                  data={{ labels: spendByDay.labels, datasets: [{ data: spendByDay.data }] }}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withDots
                  withInnerLines={false}
                  withOuterLines={false}
                />
              </View>
            )}

            {/* Drinks by day of week */}
            {byDOW.data.some((v) => v > 0) && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Drinks by Day of Week</Text>
                <BarChart
                  data={{ labels: byDOW.labels, datasets: [{ data: byDOW.data }] }}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(78, 205, 196, ${opacity})`,
                  }}
                  style={styles.chart}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              </View>
            )}

            {/* Category breakdown */}
            {byCategory.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>By Category</Text>
                <PieChart
                  data={byCategory.map((c) => ({ ...c, population: c.count }))}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="8"
                  style={styles.chart}
                />
              </View>
            )}

            {/* Top shops */}
            {topShops.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top Shops</Text>
                {topShops.map(([shop, info], i) => (
                  <View key={shop} style={styles.shopRow}>
                    <Text style={styles.shopRank}>#{i + 1}</Text>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName} numberOfLines={1}>{shop}</Text>
                      <View style={styles.shopBar}>
                        <View
                          style={[
                            styles.shopBarFill,
                            {
                              width: `${(info.count / topShops[0][1].count) * 100}%`,
                              backgroundColor: Colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.shopStats}>
                      <Text style={styles.shopCount}>{info.count}x</Text>
                      <Text style={styles.shopTotal}>{currency} {info.total.toFixed(0)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  periodChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodText: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  periodTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', marginBottom: 10 },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  chart: { borderRadius: 8, marginLeft: -8 },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  shopRank: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    width: 24,
  },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  shopBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
  },
  shopBarFill: {
    height: 6,
    borderRadius: 3,
    minWidth: 6,
  },
  shopStats: { alignItems: 'flex-end' },
  shopCount: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  shopTotal: { fontSize: 11, color: Colors.textMuted },
  loadingText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});

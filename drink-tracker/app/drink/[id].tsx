import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { getDrink, deleteDrink } from '../../lib/storage';
import StickerImage from '../../components/StickerImage';
import { TAG_EMOJIS, TAG_LABELS } from '../../types';
import type { DrinkEntry } from '../../types';

export default function DrinkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [drink, setDrink] = useState<DrinkEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDrink(id)
      .then(setDrink)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = useCallback(() => {
    if (!drink) return;
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
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete drink.');
            }
          },
        },
      ]
    );
  }, [drink, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!drink) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Text style={styles.notFound}>Drink not found.</Text>
      </SafeAreaView>
    );
  }

  const date = parseISO(drink.createdAt);
  const primaryTag = drink.tags[0];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Sticker hero */}
        <View style={styles.hero}>
          <StickerImage
            uri={drink.photoStorageUrl ?? drink.photoUri}
            tag={primaryTag}
            size={160}
            rotation={-2}
          />
        </View>

        {/* Name & shop */}
        <Text style={styles.name}>{drink.name}</Text>
        <Text style={styles.shop}>📍 {drink.shopName}</Text>

        {/* Tags */}
        {drink.tags.length > 0 && (
          <View style={styles.tagRow}>
            {drink.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: Colors.tags[tag] + '25', borderColor: Colors.tags[tag] }]}
              >
                <Text style={[styles.tagText, { color: Colors.tags[tag] }]}>
                  {TAG_EMOJIS[tag]} {TAG_LABELS[tag]}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Details grid */}
        <View style={styles.detailsCard}>
          <DetailRow icon="💰" label="Price" value={`${drink.currency} ${drink.price.toFixed(2)}`} />
          <DetailRow icon="🗓️" label="Date" value={format(date, 'EEEE, MMMM d yyyy')} />
          <DetailRow icon="⏰" label="Time" value={format(date, 'h:mm a')} />
          {drink.location && (
            <>
              {drink.location.placeName && (
                <DetailRow icon="📍" label="Place" value={drink.location.placeName} />
              )}
              {drink.location.address && (
                <DetailRow icon="🗺️" label="Address" value={drink.location.address} />
              )}
            </>
          )}
          {drink.notes && (
            <DetailRow icon="📝" label="Notes" value={drink.notes} />
          )}
        </View>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.deleteBtnText}>🗑️ Delete Entry</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, alignItems: 'center' },
  hero: {
    marginVertical: 24,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  shop: {
    fontSize: 16,
    color: Colors.textLight,
    marginBottom: 12,
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tagText: { fontSize: 13, fontWeight: '600' },
  detailsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    marginBottom: 20,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 15, color: Colors.text, fontWeight: '500', marginTop: 2 },
  deleteBtn: {
    backgroundColor: Colors.error + '18',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  deleteBtnText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
  notFound: { textAlign: 'center', marginTop: 60, fontSize: 16, color: Colors.textMuted },
});

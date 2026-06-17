import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Colors } from '../constants/Colors';
import { TAG_LABELS, TAG_EMOJIS } from '../types';
import StickerImage from './StickerImage';
import type { DrinkEntry } from '../types';

interface Props {
  drink: DrinkEntry;
  onPress?: () => void;
  compact?: boolean;
}

export default function DrinkCard({ drink, onPress, compact = false }: Props) {
  const primaryTag = drink.tags[0];
  const tagColor = primaryTag ? Colors.tags[primaryTag] : Colors.textMuted;
  const date = parseISO(drink.createdAt);

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.8}>
        <StickerImage
          uri={drink.photoStorageUrl ?? drink.photoUri}
          tag={primaryTag}
          size={56}
        />
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{drink.name}</Text>
          <Text style={styles.compactShop} numberOfLines={1}>{drink.shopName}</Text>
        </View>
        <Text style={styles.price}>
          {drink.currency} {drink.price.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <StickerImage
          uri={drink.photoStorageUrl ?? drink.photoUri}
          tag={primaryTag}
          size={72}
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{drink.name}</Text>
          <Text style={styles.shop} numberOfLines={1}>📍 {drink.shopName}</Text>
          {drink.location?.placeName ? (
            <Text style={styles.location} numberOfLines={1}>
              {drink.location.placeName}
            </Text>
          ) : null}
          <View style={styles.tagRow}>
            {drink.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: Colors.tags[tag] + '22' }]}>
                <Text style={[styles.tagText, { color: Colors.tags[tag] }]}>
                  {TAG_EMOJIS[tag]} {TAG_LABELS[tag]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.date}>{format(date, 'MMM d, h:mm a')}</Text>
        <View style={styles.priceChip}>
          <Text style={styles.priceText}>
            {drink.currency} {drink.price.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  info: {
    flex: 1,
    paddingTop: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  shop: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceChip: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  // compact
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  compactShop: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 1,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});

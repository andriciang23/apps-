import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  label: string;
  value: string;
  icon: string;
  accent?: string;
  small?: boolean;
}

export default function StatsCard({ label, value, icon, accent = Colors.primary, small }: Props) {
  return (
    <View style={[styles.card, small && styles.smallCard, { borderLeftColor: accent }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, small && styles.smallValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.label, small && styles.smallLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    flex: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  smallCard: {
    padding: 12,
  },
  icon: {
    fontSize: 22,
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  smallValue: {
    fontSize: 18,
  },
  label: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
  smallLabel: {
    fontSize: 11,
  },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { Colors } from '../constants/Colors';
import type { DrinkLocation } from '../types';

interface Props {
  value?: DrinkLocation;
  onChange: (loc: DrinkLocation | undefined) => void;
  googleMapsApiKey?: string;
}

interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export default function LocationPicker({ value, onChange, googleMapsApiKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);

  const detectLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to auto-detect your location.');
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      let placeName: string | undefined;
      let address: string | undefined;
      try {
        const [geocode] = await ExpoLocation.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geocode) {
          placeName = [geocode.name, geocode.street].filter(Boolean).join(', ');
          address = [geocode.city, geocode.region, geocode.country].filter(Boolean).join(', ');
        }
      } catch {
        // reverse geocoding is best-effort
      }
      onChange({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        placeName,
        address,
      });
    } catch (e) {
      Alert.alert('Error', 'Could not detect location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  const searchPlaces = useCallback(
    async (text: string) => {
      setSearchText(text);
      if (!text.trim() || !googleMapsApiKey) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=establishment&key=${googleMapsApiKey}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (json.status === 'OK') {
          setSuggestions(
            (json.predictions ?? []).slice(0, 5).map((p: Record<string, unknown>) => ({
              placeId: p.place_id as string,
              description: p.description as string,
              mainText: (p.structured_formatting as Record<string, string>)?.main_text ?? '',
              secondaryText: (p.structured_formatting as Record<string, string>)?.secondary_text ?? '',
            }))
          );
        }
      } catch {
        // fail silently
      } finally {
        setSearching(false);
      }
    },
    [googleMapsApiKey]
  );

  const selectPlace = useCallback(
    async (place: PlaceSuggestion) => {
      if (!googleMapsApiKey) return;
      setShowSearch(false);
      setLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.placeId}&fields=geometry,formatted_address,name&key=${googleMapsApiKey}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (json.status === 'OK') {
          const r = json.result as Record<string, unknown>;
          const geo = (r.geometry as Record<string, unknown>)?.location as Record<string, number>;
          onChange({
            latitude: geo.lat,
            longitude: geo.lng,
            placeName: place.mainText,
            address: r.formatted_address as string,
          });
        }
      } catch {
        Alert.alert('Error', 'Could not fetch place details.');
      } finally {
        setLoading(false);
      }
    },
    [googleMapsApiKey, onChange]
  );

  return (
    <View>
      {value ? (
        <View style={styles.selectedRow}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              {value.placeName ? (
                <Text style={styles.placeName} numberOfLines={1}>{value.placeName}</Text>
              ) : null}
              {value.address ? (
                <Text style={styles.address} numberOfLines={1}>{value.address}</Text>
              ) : (
                <Text style={styles.address}>
                  {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => onChange(undefined)} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.btn}
          onPress={detectLocation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.btnText}>📡 Auto-detect</Text>
          )}
        </TouchableOpacity>

        {googleMapsApiKey ? (
          <TouchableOpacity
            style={[styles.btn, styles.searchBtn]}
            onPress={() => setShowSearch(true)}
          >
            <Text style={styles.btnText}>🔍 Search place</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={showSearch} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Place</Text>
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a café, shop..."
              value={searchText}
              onChangeText={searchPlaces}
              autoFocus
              clearButtonMode="while-editing"
            />
            {searching && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
          </View>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestion} onPress={() => selectPlace(item)}>
                <Text style={styles.suggestionMain}>{item.mainText}</Text>
                <Text style={styles.suggestionSub}>{item.secondaryText}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '18',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  selectedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedIcon: { fontSize: 18 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  address: { fontSize: 12, color: Colors.textLight, marginTop: 1 },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 12, color: Colors.textLight },
  buttonRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  searchBtn: {
    backgroundColor: Colors.secondary + '15',
    borderColor: Colors.secondary,
  },
  btnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalClose: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  suggestion: { padding: 14 },
  suggestionMain: { fontSize: 15, fontWeight: '600', color: Colors.text },
  suggestionSub: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
});

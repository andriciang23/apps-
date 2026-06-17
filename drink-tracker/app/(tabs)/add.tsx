import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { addDrink, uploadDrinkPhoto } from '../../lib/storage';
import LocationPicker from '../../components/LocationPicker';
import { TAG_LABELS, TAG_EMOJIS } from '../../types';
import type { DrinkTag, DrinkLocation } from '../../types';

const ALL_TAGS: DrinkTag[] = [
  'coffee', 'tea', 'bubble_tea', 'juice', 'smoothie',
  'soda', 'water', 'alcohol', 'energy_drink', 'other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'MYR', 'JPY', 'AUD', 'CAD', 'IDR', 'THB'];

// Replace with your Google Maps API key or pass via env
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function AddDrinkScreen() {
  const router = useRouter();

  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [tags, setTags] = useState<DrinkTag[]>([]);
  const [location, setLocation] = useState<DrinkLocation | undefined>();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const fn = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await fn({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const toggleTag = useCallback((tag: DrinkTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter the drink name.');
      return;
    }
    if (!shopName.trim()) {
      Alert.alert('Missing info', 'Please enter the shop name.');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const id = await addDrink({
        name: name.trim(),
        shopName: shopName.trim(),
        price: priceNum,
        currency,
        photoUri,
        location,
        tags: tags.length > 0 ? tags : ['other'],
        notes: notes.trim() || undefined,
      });

      if (photoUri) {
        try {
          const url = await uploadDrinkPhoto(photoUri, id);
          // update with storage URL (best effort)
          const { updateDrink } = await import('../../lib/storage');
          await updateDrink(id, { photoStorageUrl: url });
        } catch {
          // photo upload failed, still saved the entry
        }
      }

      Alert.alert('Saved! 🎉', `${name} logged successfully.`, [
        { text: 'Add another', onPress: resetForm },
        { text: 'Go home', onPress: () => router.push('/') },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save drink. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [name, shopName, price, currency, photoUri, location, tags, notes, router]);

  const resetForm = () => {
    setPhotoUri(undefined);
    setName('');
    setShopName('');
    setPrice('');
    setTags([]);
    setLocation(undefined);
    setNotes('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Log a Drink</Text>

          {/* Photo picker */}
          <View style={styles.photoSection}>
            {photoUri ? (
              <View style={styles.stickerContainer}>
                <View style={styles.sticker}>
                  <Image source={{ uri: photoUri }} style={styles.stickerImage} />
                </View>
                <TouchableOpacity
                  style={styles.changePhotoBtn}
                  onPress={() => pickImage(false)}
                >
                  <Text style={styles.changePhotoText}>Change photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPickerRow}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={() => pickImage(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoBtnIcon}>📸</Text>
                  <Text style={styles.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={() => pickImage(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoBtnIcon}>🖼️</Text>
                  <Text style={styles.photoBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Drink name */}
          <View style={styles.field}>
            <Text style={styles.label}>Drink Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Iced Caramel Latte"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
          </View>

          {/* Shop name */}
          <View style={styles.field}>
            <Text style={styles.label}>Shop / Brand *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Starbucks, KOI, local café"
              value={shopName}
              onChangeText={setShopName}
              returnKeyType="next"
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>Price *</Text>
            <View style={styles.priceRow}>
              <TouchableOpacity
                style={styles.currencyBtn}
                onPress={() => setShowCurrencyPicker((v) => !v)}
              >
                <Text style={styles.currencyText}>{currency} ▾</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            {showCurrencyPicker && (
              <View style={styles.currencyList}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currencyOption, c === currency && styles.currencySelected]}
                    onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}
                  >
                    <Text style={[styles.currencyOptionText, c === currency && { color: Colors.primary }]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.tagGrid}>
              {ALL_TAGS.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      selected && { backgroundColor: Colors.tags[tag], borderColor: Colors.tags[tag] },
                    ]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tagChipText}>
                      {TAG_EMOJIS[tag]} {TAG_LABELS[tag]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <LocationPicker
              value={location}
              onChange={setLocation}
              googleMapsApiKey={GOOGLE_MAPS_API_KEY}
            />
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Sweetness level, customizations, rating..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Drink 🥤</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 20,
  },
  photoSection: { marginBottom: 20 },
  photoPickerRow: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  photoBtnIcon: { fontSize: 28 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textLight },
  stickerContainer: { alignItems: 'center', gap: 10 },
  sticker: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    transform: [{ rotate: '-2deg' }],
  },
  stickerImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },
  changePhotoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changePhotoText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  field: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  currencyBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  currencyText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  currencyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelected: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  currencyOptionText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tagChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

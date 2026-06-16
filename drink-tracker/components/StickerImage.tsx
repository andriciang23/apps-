import React, { useMemo } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { TAG_EMOJIS } from '../types';
import type { DrinkTag } from '../types';

interface Props {
  uri?: string;
  tag?: DrinkTag;
  size?: number;
  rotation?: number;
  style?: ViewStyle;
}

export default function StickerImage({ uri, tag, size = 80, rotation, style }: Props) {
  const rotate = useMemo(() => {
    if (rotation !== undefined) return rotation;
    return Math.round(Math.random() * 6 - 3);
  }, [rotation]);

  const emoji = tag ? TAG_EMOJIS[tag] : '🫙';

  return (
    <View
      style={[
        styles.outer,
        {
          width: size + 8,
          height: size + 8,
          borderRadius: size * 0.18,
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: size,
            height: size,
            borderRadius: size * 0.15,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{
              width: size,
              height: size,
              borderRadius: size * 0.15,
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { borderRadius: size * 0.15 }]}>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    overflow: 'hidden',
    backgroundColor: '#F8F0EB',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#FFE8DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

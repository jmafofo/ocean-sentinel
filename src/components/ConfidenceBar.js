import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { getConfidenceColor, getConfidenceLabel } from '../services/fishIdentifier';

/**
 * Animated horizontal confidence bar.
 *
 * Props:
 *   confidence  number  0–1
 *   label       string  optional override label
 *   showLabel   bool    default true
 *   height      number  bar height in px, default 8
 */
export default function ConfidenceBar({ confidence = 0, label, showLabel = true, height = 8 }) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const color = getConfidenceColor(confidence);
  const displayLabel = label ?? getConfidenceLabel(confidence);
  const pct = Math.round(confidence * 100);

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: confidence,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [confidence]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{displayLabel}</Text>
          <Text style={[styles.pct, { color }]}>{pct}%</Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            { width: widthInterpolated, backgroundColor: color, height },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: '#8ab4d4',
    fontSize: 12,
    fontWeight: '500',
  },
  pct: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    backgroundColor: '#142954',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
});

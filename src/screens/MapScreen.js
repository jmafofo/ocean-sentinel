import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getSightingsWithLocation, formatTimestamp } from '../services/database';

export default function MapScreen() {
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getSightingsWithLocation();
      setSightings(data);
    } catch (err) {
      console.error('MapScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sightings Map</Text>
        <Text style={styles.subtitle}>
          {sightings.length} location{sightings.length !== 1 ? 's' : ''} logged
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#00d4aa" size="large" />
        </View>
      ) : sightings.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={56} color="#8ab4d4" />
          <Text style={styles.emptyTitle}>No location data yet</Text>
          <Text style={styles.emptyText}>
            Identify fish with location services enabled to see your sightings here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sightings.map(s => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName}>{s.speciesName}</Text>
                <Text style={styles.cardConf}>{Math.round(s.confidence * 100)}%</Text>
              </View>
              <View style={styles.cardRow}>
                <Ionicons name="location-outline" size={12} color="#8ab4d4" />
                <Text style={styles.cardCoord}>
                  {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </Text>
                <Ionicons name="time-outline" size={12} color="#8ab4d4" style={styles.ml8} />
                <Text style={styles.cardTime}>{formatTimestamp(s.timestamp)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1628' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { color: '#e8f4fd', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8ab4d4', fontSize: 13, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#e8f4fd', fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyText: { color: '#8ab4d4', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#142954',
    gap: 6,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { color: '#e8f4fd', fontSize: 15, fontWeight: '700', flex: 1 },
  cardConf: { color: '#00d4aa', fontSize: 13, fontWeight: '700' },
  cardCoord: { color: '#8ab4d4', fontSize: 12 },
  cardTime: { color: '#8ab4d4', fontSize: 12, flex: 1 },
  ml8: { marginLeft: 8 },
});

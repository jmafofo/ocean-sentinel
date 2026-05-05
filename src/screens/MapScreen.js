import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Callout } from 'react-native-maps';

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

  // Compute initial region from sightings (or default to UAE)
  const getInitialRegion = () => {
    if (sightings.length === 0) {
      return {
        latitude: 24.5,
        longitude: 54.3,
        latitudeDelta: 4,
        longitudeDelta: 4,
      };
    }
    const lats = sightings.map(s => s.latitude);
    const lons = sightings.map(s => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const pad = 0.05;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) + pad * 2, 0.1),
      longitudeDelta: Math.max((maxLon - minLon) + pad * 2, 0.1),
    };
  };

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
        <MapView
          style={styles.map}
          initialRegion={getInitialRegion()}
          mapType="hybrid"
        >
          {sightings.map(s => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              pinColor="#00d4aa"
            >
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{s.speciesName}</Text>
                  <Text style={styles.calloutConf}>
                    Confidence: {Math.round(s.confidence * 100)}%
                  </Text>
                  <Text style={styles.calloutTime}>
                    {formatTimestamp(s.timestamp)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
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
  map: { flex: 1 },
  callout: {
    backgroundColor: '#0f2044',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#142954',
    minWidth: 160,
  },
  calloutName: { color: '#e8f4fd', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  calloutConf: { color: '#00d4aa', fontSize: 12, fontWeight: '600' },
  calloutTime: { color: '#8ab4d4', fontSize: 11, marginTop: 2 },
});

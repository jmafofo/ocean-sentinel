import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getSightingsWithLocation, formatTimestamp } from '../services/database';
import fishSpecies from '../data/fishSpecies.json';

const DEFAULT_REGION = {
  latitude: 25.1275,
  longitude: 56.3422,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

export default function MapScreen() {
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const mapRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(120)).current;

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectMarker = (sighting) => {
    setSelected(sighting);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();

    // Pan map to marker
    mapRef.current?.animateToRegion({
      latitude: sighting.latitude,
      longitude: sighting.longitude,
      latitudeDelta: 1,
      longitudeDelta: 1,
    }, 400);
  };

  const clearSelected = () => {
    Animated.timing(slideAnim, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => {
      setSelected(null);
    });
  };

  const fitAllMarkers = () => {
    if (sightings.length === 0) return;
    const coords = sightings.map(s => ({ latitude: s.latitude, longitude: s.longitude }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 180, left: 60 },
      animated: true,
    });
  };

  const selectedSpecies = selected
    ? fishSpecies.find(f => f.id === selected.speciesId)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Sightings Map</Text>
        <Text style={styles.subtitle}>
          {sightings.length} location{sightings.length !== 1 ? 's' : ''} logged
        </Text>
      </View>

      <View style={styles.mapWrapper}>
        {/* ── Map ──────────────────────────────────── */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={DEFAULT_REGION}
          mapType="satellite"
          showsUserLocation
          showsMyLocationButton={false}
          onPress={clearSelected}
        >
          {sightings.map(sighting => (
            <Marker
              key={sighting.id}
              coordinate={{ latitude: sighting.latitude, longitude: sighting.longitude }}
              onPress={() => selectMarker(sighting)}
              pinColor="#00d4aa"
            >
              <View style={[
                styles.markerPin,
                selected?.id === sighting.id && styles.markerPinActive,
              ]}>
                <Text style={styles.markerEmoji}>🐟</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* ── Fit-all button ────────────────────────── */}
        {sightings.length > 1 && (
          <TouchableOpacity style={styles.fitBtn} onPress={fitAllMarkers}>
            <Ionicons name="expand-outline" size={20} color="#e8f4fd" />
          </TouchableOpacity>
        )}

        {/* ── Loading overlay ──────────────────────── */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#00d4aa" />
          </View>
        )}

        {/* ── Empty overlay ────────────────────────── */}
        {!loading && sightings.length === 0 && (
          <View style={styles.emptyOverlay}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📍</Text>
              <Text style={styles.emptyTitle}>No location data yet</Text>
              <Text style={styles.emptyText}>
                Identify fish with location services enabled to see your sightings on the map.
              </Text>
            </View>
          </View>
        )}

        {/* ── Bottom info card (animated) ───────────── */}
        {selected && (
          <Animated.View style={[styles.infoCard, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.infoClose} onPress={clearSelected}>
              <Ionicons name="close" size={18} color="#8ab4d4" />
            </TouchableOpacity>

            <Text style={styles.infoName}>{selected.speciesName}</Text>
            {selectedSpecies && (
              <Text style={styles.infoSci}>{selectedSpecies.scientificName}</Text>
            )}

            <View style={styles.infoRow}>
              <InfoChip icon="time-outline" value={formatTimestamp(selected.timestamp)} />
              <InfoChip
                icon="location-outline"
                value={`${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}`}
              />
              <InfoChip
                icon="analytics-outline"
                value={`${Math.round(selected.confidence * 100)}% confidence`}
                color="#00d4aa"
              />
            </View>

            {selectedSpecies && (
              <Text style={styles.infoDesc} numberOfLines={2}>{selectedSpecies.description}</Text>
            )}
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoChip({ icon, value, color = '#8ab4d4' }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1628' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { color: '#e8f4fd', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8ab4d4', fontSize: 13, marginTop: 2 },

  mapWrapper: { flex: 1, position: 'relative' },

  markerPin: {
    backgroundColor: '#0f2044',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00d4aa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPinActive: {
    borderColor: '#ffb74d',
    backgroundColor: '#142954',
    transform: [{ scale: 1.2 }],
  },
  markerEmoji: { fontSize: 17 },

  fitBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(15,32,68,0.9)',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#142954',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10,22,40,0.6)',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
    paddingHorizontal: 30,
  },
  emptyCard: {
    backgroundColor: 'rgba(15,32,68,0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#142954',
    width: '100%',
  },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: '#e8f4fd', fontSize: 16, fontWeight: '700' },
  emptyText: { color: '#8ab4d4', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },

  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,22,40,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: '#142954',
  },
  infoClose: {
    position: 'absolute',
    top: 14,
    right: 16,
  },
  infoName: { color: '#e8f4fd', fontSize: 20, fontWeight: '800' },
  infoSci: { color: '#8ab4d4', fontSize: 13, fontStyle: 'italic', marginTop: 2, marginBottom: 12 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#142954',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  infoDesc: { color: '#c5dff0', fontSize: 13, lineHeight: 19 },
});

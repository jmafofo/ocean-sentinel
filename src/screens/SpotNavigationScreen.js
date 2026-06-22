import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  blue: '#4fc3f7',
  amber: '#ffb74d',
  text: '#ddeeff',
  sub: '#6a9fc0',
  dim: '#2a4a6a',
};

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Initial bearing (degrees, 0 = north, clockwise) ───────────────────────────
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function bearingToCardinal(bearing) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

function formatETA(distanceKm, speedKmh) {
  if (!distanceKm || distanceKm <= 0) return '0 min';
  const hours = distanceKm / speedKmh;
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SpotNavigationScreen({ route, navigation }) {
  const { spot } = route.params ?? {};
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const target = { latitude: spot?.latitude ?? 0, longitude: spot?.longitude ?? 0 };

  const updatePosition = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
      setLoading(false);
    } catch (err) {
      console.warn('Location update error:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      if (status !== 'granted') {
        setErrorMsg('Location permission denied. Enable GPS to use navigation.');
        setLoading(false);
        return;
      }
      await updatePosition();
      intervalRef.current = setInterval(updatePosition, 3000);
    })();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updatePosition]);

  const distance = location ? haversine(location.latitude, location.longitude, target.latitude, target.longitude) : null;
  const bearing = location ? calculateBearing(location.latitude, location.longitude, target.latitude, target.longitude) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.eyebrow}>// NAVIGATE</Text>
          <Text style={styles.title} numberOfLines={1}>{spot?.name?.toUpperCase() ?? 'SPOT'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={styles.loadingText}>Acquiring GPS fix...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="location-off-outline" size={48} color="#ef5350" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={async () => {
              setErrorMsg(null);
              setLoading(true);
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                await updatePosition();
                intervalRef.current = setInterval(updatePosition, 3000);
              } else {
                setErrorMsg('Location permission denied.');
                setLoading(false);
              }
            }}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Compass + Stats */}
          <View style={styles.statsCard}>
            <View style={styles.compassWrap}>
              <View style={styles.compassRing}>
                <Ionicons
                  name="navigate"
                  size={48}
                  color={C.accent}
                  style={{
                    transform: [{ rotate: `${bearing ?? 0}deg` }],
                  }}
                />
              </View>
              <Text style={styles.bearingText}>
                {bearing != null ? `${Math.round(bearing)}° ${bearingToCardinal(bearing)}` : '—'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsCol}>
              <View style={styles.statItem}>
                <Ionicons name="pin-outline" size={16} color={C.blue} />
                <Text style={styles.statLabel}>DISTANCE</Text>
                <Text style={styles.statValue}>
                  {distance != null ? `${distance.toFixed(2)} km` : '—'}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="walk-outline" size={16} color={C.amber} />
                <Text style={styles.statLabel}>WALKING ETA</Text>
                <Text style={styles.statValue}>
                  {distance != null ? formatETA(distance, 5) : '—'}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="car-outline" size={16} color={C.accent} />
                <Text style={styles.statLabel}>DRIVING ETA</Text>
                <Text style={styles.statValue}>
                  {distance != null ? formatETA(distance, 60) : '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Coordinates */}
          <View style={styles.coordCard}>
            <View style={styles.coordItem}>
              <Ionicons name="locate" size={14} color={C.blue} />
              <Text style={styles.coordLabel}>YOU</Text>
              <Text style={styles.coordValue}>
                {location?.latitude?.toFixed(5) ?? '—'}°N, {location?.longitude?.toFixed(5) ?? '—'}°E
              </Text>
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordItem}>
              <Ionicons name="flag" size={14} color={C.accent} />
              <Text style={styles.coordLabel}>TARGET</Text>
              <Text style={styles.coordValue}>
                {target.latitude.toFixed(5)}°N, {target.longitude.toFixed(5)}°E
              </Text>
            </View>
          </View>

          {/* Map */}
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              region={{
                latitude: location?.latitude ?? target.latitude,
                longitude: location?.longitude ?? target.longitude,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
              }}
              mapType="hybrid"
              showsUserLocation
              followsUserLocation
            >
              <Marker coordinate={target} pinColor={C.accent} title={spot?.name} />
              {location && (
                <Polyline
                  coordinates={[
                    { latitude: location.latitude, longitude: location.longitude },
                    target,
                  ]}
                  strokeColor={C.accent}
                  strokeWidth={3}
                />
              )}
            </MapView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { color: C.sub, fontSize: 13, marginTop: 16 },
  errorText: { color: '#ef5350', fontSize: 14, textAlign: 'center', marginTop: 16 },
  retryBtn: {
    marginTop: 20,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { color: C.bg, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  compassWrap: { alignItems: 'center', paddingHorizontal: 10 },
  compassRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: C.accent + '55',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  bearingText: { color: C.accent, fontSize: 12, fontWeight: '800', marginTop: 8, letterSpacing: 1 },

  divider: { width: 1, backgroundColor: C.border, alignSelf: 'stretch', marginHorizontal: 12 },

  statsCol: { flex: 1, gap: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { color: C.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, width: 90, marginLeft: 8 },
  statValue: { color: C.text, fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },

  coordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  coordItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  coordLabel: { color: C.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginLeft: 6, marginRight: 6 },
  coordValue: { color: C.sub, fontSize: 11, fontWeight: '600', flex: 1 },
  coordDivider: { width: 1, backgroundColor: C.border, alignSelf: 'stretch', marginHorizontal: 10 },

  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  map: { flex: 1 },
});

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  blue: '#4fc3f7',
  text: '#ddeeff',
  sub: '#6a9fc0',
  dim: '#2a4a6a',
};

export default function SpotDetailScreen({ route, navigation }) {
  const { spot } = route.params ?? {};

  if (!spot) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Spot not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.eyebrow}>// {spot.emirate.toUpperCase()}</Text>
            <Text style={styles.title}>{spot.name.toUpperCase()}</Text>
          </View>
        </View>

        {/* Map preview */}
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: spot.latitude,
              longitude: spot.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            mapType="hybrid"
          >
            <Marker
              coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
              pinColor={C.accent}
            />
          </MapView>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>◆ ABOUT THIS SPOT</Text>
          <Text style={styles.infoDesc}>{spot.description}</Text>

          <View style={styles.coordRow}>
            <Ionicons name="navigate-outline" size={14} color={C.accent} />
            <Text style={styles.coordText}>
              {spot.latitude.toFixed(5)}°N, {spot.longitude.toFixed(5)}°E
            </Text>
          </View>
        </View>

        {/* Target species */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>◆ TARGET SPECIES</Text>
          <View style={styles.speciesWrap}>
            {spot.targetSpecies.map((s, i) => (
              <View key={i} style={styles.speciesPill}>
                <Ionicons name="fish-outline" size={12} color={C.accent} style={{ marginRight: 4 }} />
                <Text style={styles.speciesText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Navigate CTA */}
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => navigation.navigate('SpotNavigation', { spot })}
          activeOpacity={0.88}
        >
          <Ionicons name="navigate" size={20} color={C.bg} style={{ marginRight: 8 }} />
          <Text style={styles.navBtnText}>NAVIGATE TO SPOT</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },

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
  title: { color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  mapWrap: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    height: 220,
  },
  map: { flex: 1 },

  infoCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  infoDesc: { color: C.sub, fontSize: 13, lineHeight: 20 },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  coordText: { color: C.text, fontSize: 12, fontWeight: '600', marginLeft: 6 },

  speciesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  speciesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  speciesText: { color: C.accent, fontSize: 12, fontWeight: '700' },

  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  navBtnText: { color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
});

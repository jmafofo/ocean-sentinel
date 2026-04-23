import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  getRecentSightings, getSightingCount,
  getUniqueSpeciesCount, formatTimestamp,
} from '../services/database';
import { isModelLoaded } from '../services/fishIdentifier';
import fishSpecies from '../data/fishSpecies.json';
import AdBanner from '../components/AdBanner';

export default function HomeScreen({ navigation }) {
  const [stats, setStats] = useState({ total: 0, species: 0 });
  const [recents, setRecents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [total, species, recent] = await Promise.all([
        getSightingCount(),
        getUniqueSpeciesCount(),
        getRecentSightings(5),
      ]);
      setStats({ total, species });
      setRecents(recent);
    } catch (err) {
      console.error('HomeScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time the tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1628" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d4aa" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ocean Sentinel</Text>
            <Text style={styles.subtitle}>Fish Identification & Tracking</Text>
          </View>
          <View style={styles.aiStatus}>
            <View style={[styles.aiDot, { backgroundColor: isModelLoaded() ? '#00d4aa' : '#ffb74d' }]} />
            <Text style={styles.aiLabel}>{isModelLoaded() ? 'AI Ready' : 'AI Loading'}</Text>
          </View>
        </View>

        {/* ── Scan CTA ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.scanCta}
          onPress={() => navigation.navigate('Camera')}
          activeOpacity={0.85}
        >
          <View style={styles.scanCtaInner}>
            <Ionicons name="camera" size={36} color="#0a1628" />
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.scanTitle}>Identify a Fish</Text>
              <Text style={styles.scanSub}>Point camera at a fish — works offline</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#0a1628" style={{ opacity: 0.6 }} />
        </TouchableOpacity>

        {/* ── Stats row ───────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard icon="fish-outline" value={stats.total} label="Sightings" color="#00d4aa" />
          <StatCard icon="layers-outline" value={stats.species} label="Species" color="#4fc3f7" />
          <StatCard icon="library-outline" value={fishSpecies.length} label="In Database" color="#ffb74d" />
        </View>

        {/* ── Recent Sightings ────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sightings</Text>
          {recents.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#00d4aa" style={{ marginVertical: 24 }} />
        ) : recents.length === 0 ? (
          <EmptyState onPress={() => navigation.navigate('Camera')} />
        ) : (
          recents.map(sighting => (
            <RecentCard key={sighting.id} sighting={sighting} />
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Advanced Tools</Text>
        </View>

        <View style={styles.toolsGrid}>
          <TouchableOpacity
            style={styles.toolCard}
            onPress={() => navigation.navigate('Pollution')}
            activeOpacity={0.85}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#12334a' }]}>
              <Ionicons name="water-outline" size={22} color="#4fc3f7" />
            </View>
            <Text style={styles.toolTitle}>Pollution Monitor</Text>
            <Text style={styles.toolText}>
              Analyze water-surface photos for visible pollution indicators.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCard}
            onPress={() => navigation.navigate('Molecular')}
            activeOpacity={0.85}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#173828' }]}>
              <Ionicons name="flask-outline" size={22} color="#00d4aa" />
            </View>
            <Text style={styles.toolTitle}>Molecular Markers</Text>
            <Text style={styles.toolText}>
              Run DNA-based identification using barcodes and marker panels.
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tips ────────────────────────────────────── */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for best results</Text>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipEmoji}>{tip.emoji}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RecentCard({ sighting }) {
  const species = fishSpecies.find(f => f.id === sighting.speciesId);
  return (
    <View style={styles.recentCard}>
      <View style={styles.recentIcon}>
        <Text style={{ fontSize: 20 }}>🐟</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recentName}>{sighting.speciesName}</Text>
        {species && <Text style={styles.recentSci}>{species.scientificName}</Text>}
        <View style={styles.recentMeta}>
          <Ionicons name="time-outline" size={11} color="#4a7fa8" />
          <Text style={styles.recentTime}>{formatTimestamp(sighting.timestamp)}</Text>
          {sighting.latitude != null && (
            <>
              <Ionicons name="location-outline" size={11} color="#4a7fa8" style={{ marginLeft: 8 }} />
              <Text style={styles.recentTime}>
                {sighting.latitude.toFixed(3)}, {sighting.longitude.toFixed(3)}
              </Text>
            </>
          )}
        </View>
      </View>
      <Text style={styles.recentConf}>{Math.round(sighting.confidence * 100)}%</Text>
    </View>
  );
}

function EmptyState({ onPress }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🌊</Text>
      <Text style={styles.emptyTitle}>No sightings yet</Text>
      <Text style={styles.emptyText}>Tap the button above or use the Camera tab to identify your first fish.</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onPress}>
        <Ionicons name="camera-outline" size={16} color="#0a1628" style={{ marginRight: 6 }} />
        <Text style={styles.emptyBtnText}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );
}

const TIPS = [
  { emoji: '☀️', text: 'Good lighting improves accuracy — natural light works best' },
  { emoji: '📸', text: 'Capture the whole fish in frame, including fins and tail' },
  { emoji: '🔍', text: 'For small fish, get as close as possible and keep steady' },
  { emoji: '📶', text: 'Once the AI model downloads, no internet required' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1628' },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: { color: '#e8f4fd', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8ab4d4', fontSize: 13, marginTop: 2 },
  aiStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  aiDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  aiLabel: { color: '#8ab4d4', fontSize: 12 },

  scanCta: {
    marginHorizontal: 20,
    backgroundColor: '#00d4aa',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scanCtaInner: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  scanTitle: { color: '#0a1628', fontSize: 18, fontWeight: '800' },
  scanSub: { color: '#0a3020', fontSize: 12, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#142954',
  },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  statLabel: { color: '#8ab4d4', fontSize: 11, marginTop: 3 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { color: '#e8f4fd', fontSize: 17, fontWeight: '700' },
  seeAll: { color: '#00d4aa', fontSize: 14 },

  toolsGrid: {
    marginHorizontal: 20,
    gap: 12,
  },
  toolCard: {
    backgroundColor: '#0f2044',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#142954',
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  toolTitle: {
    color: '#e8f4fd',
    fontSize: 16,
    fontWeight: '700',
  },
  toolText: {
    color: '#8ab4d4',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },

  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#142954',
  },
  recentIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentName: { color: '#e8f4fd', fontSize: 15, fontWeight: '600' },
  recentSci: { color: '#8ab4d4', fontSize: 11, fontStyle: 'italic', marginTop: 1 },
  recentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  recentTime: { color: '#4a7fa8', fontSize: 11, marginLeft: 3 },
  recentConf: { color: '#00d4aa', fontSize: 15, fontWeight: '700', marginLeft: 8 },

  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#e8f4fd', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#8ab4d4', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00d4aa',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 20,
  },
  emptyBtnText: { color: '#0a1628', fontSize: 15, fontWeight: '700' },

  tipsCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#0f2044',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#142954',
  },
  tipsTitle: { color: '#e8f4fd', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  tipEmoji: { fontSize: 16, marginRight: 10 },
  tipText: { color: '#8ab4d4', fontSize: 13, lineHeight: 19, flex: 1 },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, RefreshControl, Animated,
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

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#050e1f',
  surface:  '#0a1628',
  card:     '#0d1f3c',
  border:   '#12305a',
  accent:   '#00d4aa',
  blue:     '#4fc3f7',
  amber:    '#ffb74d',
  text:     '#ddeeff',
  sub:      '#6a9fc0',
  dim:      '#2a4a6a',
  scanRing: '#00d4aa',
};

// ── Corner bracket overlay ────────────────────────────────────────────────────
function Brackets({ size = 14, color = C.accent, thickness = 2 }) {
  const s = { position: 'absolute', width: size, height: size };
  const bar = { backgroundColor: color };
  return (
    <>
      {/* top-left */}
      <View style={[s, { top: 0, left: 0 }]}>
        <View style={[bar, { height: thickness, width: size }]} />
        <View style={[bar, { width: thickness, height: size - thickness, marginTop: -thickness }]} />
      </View>
      {/* top-right */}
      <View style={[s, { top: 0, right: 0 }]}>
        <View style={[bar, { height: thickness, width: size }]} />
        <View style={[bar, { width: thickness, height: size - thickness, marginTop: -thickness, alignSelf: 'flex-end' }]} />
      </View>
      {/* bottom-left */}
      <View style={[s, { bottom: 0, left: 0 }]}>
        <View style={[bar, { width: thickness, height: size - thickness }]} />
        <View style={[bar, { height: thickness, width: size, marginTop: -thickness }]} />
      </View>
      {/* bottom-right */}
      <View style={[s, { bottom: 0, right: 0 }]}>
        <View style={[bar, { width: thickness, height: size - thickness, alignSelf: 'flex-end' }]} />
        <View style={[bar, { height: thickness, width: size, marginTop: -thickness }]} />
      </View>
    </>
  );
}

// ── Animated pulsing sonar ring ───────────────────────────────────────────────
function ScanPulse() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(val, { toValue: 1, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    pulse(ring1, 0).start();
    pulse(ring2, 900).start();
  }, []);

  const ringStyle = (val) => ({
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: C.scanRing,
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.3, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
  });

  return (
    <>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
    </>
  );
}

// ── Pulsing status dot ────────────────────────────────────────────────────────
function PulseDot({ color }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return <Animated.View style={[styles.pulseDot, { backgroundColor: color, opacity }]} />;
}

// ── Main screen ───────────────────────────────────────────────────────────────
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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };
  const aiReady = isModelLoaded();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HUD Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>// OCEAN SENTINEL</Text>
            <Text style={styles.title}>FIELD<Text style={{ color: C.accent }}> SCANNER</Text></Text>
          </View>
          <View style={styles.statusPill}>
            <PulseDot color={aiReady ? C.accent : C.amber} />
            <Text style={[styles.statusText, { color: aiReady ? C.accent : C.amber }]}>
              {aiReady ? 'AI READY' : 'LOADING'}
            </Text>
          </View>
        </View>

        {/* ── Thin HUD divider ─────────────────────────────────────────── */}
        <View style={styles.hudBar}>
          <View style={styles.hudLine} />
          <Text style={styles.hudLabel}>UAE WATERS ◆ ARABIAN GULF</Text>
          <View style={styles.hudLine} />
        </View>

        {/* ── Scan CTA ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.scanCta}
          onPress={() => navigation.navigate('Camera')}
          activeOpacity={0.88}
        >
          <Brackets size={18} color={C.accent} thickness={2} />

          {/* sonar rings + icon */}
          <View style={styles.scanOrb}>
            <ScanPulse />
            <View style={styles.scanOrbInner}>
              <Ionicons name="scan" size={32} color={C.bg} />
            </View>
          </View>

          <View style={styles.scanText}>
            <Text style={styles.scanTitle}>SCAN FISH</Text>
            <Text style={styles.scanSub}>AI IDENTIFICATION  ◆  OFFLINE CAPABLE</Text>
          </View>

          <View style={styles.scanArrow}>
            <Text style={styles.scanChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Field Data ───────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>// FIELD_DATA</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.statsRow}>
          <DataCard value={stats.total}         label="SPECIMENS"  color={C.accent} icon="fish-outline" />
          <DataCard value={stats.species}        label="SPECIES ID" color={C.blue}   icon="layers-outline" />
          <DataCard value={fishSpecies.length}   label="DATABASE"   color={C.amber}  icon="server-outline" />
        </View>

        {/* ── Recent Captures ──────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionLabel}>// RECENT_CAPTURES</Text>
          <View style={styles.sectionLine} />
          {recents.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ marginLeft: 10 }}>
              <Text style={styles.seeAll}>ALL ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
        ) : recents.length === 0 ? (
          <EmptyState onPress={() => navigation.navigate('Camera')} />
        ) : (
          recents.map(s => <CaptureCard key={s.id} sighting={s} />)
        )}

        {/* ── Advanced Tools ───────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionLabel}>// ADVANCED_TOOLS</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.toolsGrid}>
          <ToolCard
            title="POLLUTION MONITOR"
            sub="Analyze surface water for visible contamination indicators"
            icon="water-outline"
            iconBg="#0a2540"
            iconColor={C.blue}
            accentColor={C.blue}
            onPress={() => navigation.navigate('Pollution')}
          />
          <ToolCard
            title="MOLECULAR MARKERS"
            sub="DNA barcode identification using marker panel analysis"
            icon="flask-outline"
            iconBg="#082518"
            iconColor={C.accent}
            accentColor={C.accent}
            onPress={() => navigation.navigate('Molecular')}
          />
        </View>

        {/* ── Field Protocol ───────────────────────────────────────────── */}
        <View style={styles.protocolCard}>
          <Brackets size={14} color={C.dim} thickness={1.5} />
          <Text style={styles.protocolTitle}>◆ FIELD PROTOCOL</Text>
          {PROTOCOL.map((p, i) => (
            <View key={i} style={styles.protocolRow}>
              <Text style={styles.protocolNum}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.protocolDivider} />
              <Text style={styles.protocolText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

// ── DataCard ──────────────────────────────────────────────────────────────────
function DataCard({ value, label, color, icon }) {
  return (
    <View style={[styles.dataCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={16} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.dataValue, { color }]}>{value}</Text>
      <Text style={styles.dataLabel}>{label}</Text>
    </View>
  );
}

// ── CaptureCard ───────────────────────────────────────────────────────────────
function CaptureCard({ sighting }) {
  const species = fishSpecies.find(f => f.id === sighting.speciesId);
  const conf = Math.round((sighting.confidence ?? 0) * 100);
  const confColor = conf >= 80 ? C.accent : conf >= 50 ? C.amber : '#ef5350';

  return (
    <View style={styles.captureCard}>
      {/* left confidence bar */}
      <View style={[styles.captureBar, { backgroundColor: confColor }]} />

      <View style={styles.captureIconWrap}>
        <Ionicons name="fish" size={18} color={confColor} />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.captureName}>{sighting.speciesName}</Text>
        {species && <Text style={styles.captureSci}>{species.scientificName}</Text>}
        <View style={styles.captureMeta}>
          <Ionicons name="time-outline" size={10} color={C.sub} />
          <Text style={styles.captureMetaText}> {formatTimestamp(sighting.timestamp)}</Text>
          {sighting.latitude != null && (
            <>
              <Text style={[styles.captureMetaText, { color: C.dim, marginHorizontal: 4 }]}>◆</Text>
              <Ionicons name="location-outline" size={10} color={C.sub} />
              <Text style={styles.captureMetaText}>
                {' '}{sighting.latitude.toFixed(3)}°N {sighting.longitude.toFixed(3)}°E
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={[styles.confBadge, { borderColor: confColor }]}>
        <Text style={[styles.confValue, { color: confColor }]}>{conf}</Text>
        <Text style={styles.confPct}>%</Text>
      </View>
    </View>
  );
}

// ── ToolCard ──────────────────────────────────────────────────────────────────
function ToolCard({ title, sub, icon, iconBg, iconColor, accentColor, onPress }) {
  return (
    <TouchableOpacity style={[styles.toolCard, { borderLeftColor: accentColor }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.toolIcon, { backgroundColor: iconBg, borderColor: accentColor + '55' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolSub}>{sub}</Text>
      </View>
      <Text style={[styles.toolArrow, { color: accentColor }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({ onPress }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyOrb}>
        <Ionicons name="scan-outline" size={36} color={C.dim} />
      </View>
      <Text style={styles.emptyTitle}>NO CAPTURES LOGGED</Text>
      <Text style={styles.emptyText}>Scan your first fish to begin building your field record.</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onPress}>
        <Ionicons name="camera-outline" size={15} color={C.bg} style={{ marginRight: 6 }} />
        <Text style={styles.emptyBtnText}>INITIATE SCAN</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Protocol steps ────────────────────────────────────────────────────────────
const PROTOCOL = [
  'Natural light gives best accuracy — avoid flash in dark conditions',
  'Frame the entire fish including fins and caudal tail',
  'For small specimens, approach within 30 cm and hold steady',
  'App operates fully offline once AI model is cached',
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingBottom: 24 },

  // header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  eyebrow: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: C.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // HUD divider
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  hudLine: { flex: 1, height: 1, backgroundColor: C.border },
  hudLabel: { color: C.dim, fontSize: 9, letterSpacing: 2, fontWeight: '600' },

  // scan CTA
  scanCta: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.accent + '55',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  scanOrb: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOrbInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  scanText: { flex: 1, marginLeft: 16 },
  scanTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scanSub: {
    color: C.sub,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  scanArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accent + '44',
  },
  scanChevron: { color: C.accent, fontSize: 20, fontWeight: '700', lineHeight: 24 },

  // section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },
  seeAll: { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // data cards
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  dataCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 2,
  },
  dataValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  dataLabel: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },

  // capture card
  captureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  captureBar: { width: 3, alignSelf: 'stretch', borderRadius: 3, marginRight: 12 },
  captureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureName: { color: C.text, fontSize: 14, fontWeight: '700' },
  captureSci:  { color: C.sub, fontSize: 10, fontStyle: 'italic', marginTop: 1 },
  captureMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  captureMetaText: { color: C.sub, fontSize: 10 },
  confBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 8,
  },
  confValue: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  confPct:   { color: C.sub, fontSize: 9, fontWeight: '700', lineHeight: 16, marginBottom: 1 },

  // tool cards
  toolsGrid: { marginHorizontal: 20, gap: 10 },
  toolCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
  },
  toolIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toolTitle: { color: C.text, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  toolSub:   { color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 3 },
  toolArrow: { fontSize: 22, fontWeight: '700', marginLeft: 8 },

  // protocol
  protocolCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  protocolTitle: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 14,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  protocolNum: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    width: 22,
    marginTop: 1,
  },
  protocolDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 10,
    alignSelf: 'stretch',
  },
  protocolText: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  // empty state
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 40 },
  emptyOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  emptyText: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyBtnText: { color: C.bg, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
});

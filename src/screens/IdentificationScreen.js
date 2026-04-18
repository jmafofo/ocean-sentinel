import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import FishCard from '../components/FishCard';
import ConfidenceBar from '../components/ConfidenceBar';
import { getConfidenceColor } from '../services/fishIdentifier';
import { saveSighting } from '../services/database';

export default function IdentificationScreen({ route, navigation }) {
  const { results, imageUri } = route.params ?? {};
  const topResult = results?.[0];

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTab, setSelectedTab] = useState('results');
  const [location, setLocation] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation(loc.coords);
        }
      } catch {}
    })();
  }, []);

  const saveToDiary = async () => {
    if (!topResult || saving || saved) return;
    setSaving(true);
    try {
      await saveSighting({
        speciesId: topResult.species.id,
        speciesName: topResult.species.name,
        confidence: topResult.confidence,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        imageUri: imageUri ?? null,
      });
      setSaved(true);
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!results || results.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorView}>
          <Ionicons name="alert-circle-outline" size={60} color="#ff8a65" />
          <Text style={styles.errorTitle}>No Results</Text>
          <Text style={styles.errorText}>Could not process the image. Please try again.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLowConf = topResult?.lowConfidence || (topResult?.confidence ?? 1) < 0.55;
  const confPct = Math.round((topResult?.confidence ?? 0) * 100);
  const confColor = getConfidenceColor(topResult?.confidence ?? 0);
  const topFeatures = topResult?.key_features ?? [];
  const reasoning = topResult?.reasoning ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Image header ─────────────────────────────── */}
        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.fishImage} resizeMode="cover" />
            <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* ── Confidence quality notice ─────────────── */}
          {isLowConf && (
            <View style={styles.dirtBanner}>
              <Ionicons name="warning-outline" size={15} color="#ffb74d" />
              <Text style={styles.dirtBannerText}>
                Low confidence — sand or mud may be obscuring key features. Try rinsing the fish and retaking the photo from directly above.
              </Text>
            </View>
          )}

          {/* ── Top match card ───────────────────────── */}
          <View style={styles.topMatchCard}>
            <View style={styles.topMatchLeft}>
              <Text style={styles.topMatchLabel}>TOP MATCH</Text>
              <Text style={styles.topMatchName}>{topResult.species.name}</Text>
              <Text style={styles.topMatchSci}>{topResult.species.scientificName}</Text>
              {topResult.species.localName ? (
                <Text style={styles.topMatchLocal}>{topResult.species.localName}</Text>
              ) : null}
            </View>
            <View style={styles.topMatchConfBlock}>
              <Text style={[styles.topMatchPct, { color: confColor }]}>{confPct}%</Text>
              <Text style={styles.topMatchConfLabel}>confidence</Text>
            </View>
          </View>

          {/* ── Structural observations ──────────────── */}
          {topFeatures.length > 0 && (
            <View style={styles.featuresCard}>
              <View style={styles.featuresHeader}>
                <Ionicons name="search-outline" size={14} color="#00d4aa" />
                <Text style={styles.featuresTitle}>Structural Observations</Text>
              </View>
              {topFeatures.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
              {reasoning && (
                <View style={styles.reasoningBox}>
                  <Text style={styles.reasoningLabel}>Analysis</Text>
                  <Text style={styles.reasoningText}>{reasoning}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Tab bar ──────────────────────────────── */}
          <View style={styles.tabBar}>
            <TabBtn label="All Matches" active={selectedTab === 'results'} onPress={() => setSelectedTab('results')} />
            <TabBtn label="Species Info" active={selectedTab === 'details'} onPress={() => setSelectedTab('details')} />
          </View>

          {selectedTab === 'results' ? (
            <View style={styles.resultsList}>
              {results.map((item, idx) => {
                const itemConf = Math.round(item.confidence * 100);
                const itemColor = getConfidenceColor(item.confidence);
                const itemFeatures = item.key_features ?? [];
                const featureSummary = itemFeatures.slice(0, 2).join(' · ');
                return (
                  <TouchableOpacity
                    key={item.species.id ?? idx}
                    style={[styles.resultRow, idx === 0 && styles.resultRowTop]}
                    onPress={() => setSelectedTab('details')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.resultRank, idx === 0 && styles.resultRankTop]}>
                      <Text style={[styles.resultRankText, idx === 0 && styles.resultRankTextTop]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.resultNameRow}>
                        <Text style={styles.resultName}>{item.species.name}</Text>
                        <Text style={[styles.resultPct, { color: itemColor }]}>{itemConf}%</Text>
                      </View>
                      <Text style={styles.resultSci}>{item.species.scientificName}</Text>
                      {featureSummary ? (
                        <Text style={styles.resultFeatures} numberOfLines={1}>{featureSummary}</Text>
                      ) : null}
                      <ConfidenceBar confidence={item.confidence} height={4} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <FishCard species={topResult.species} mode="detail" />
            </View>
          )}

          {/* ── Save / Saved ─────────────────────────── */}
          {!saved ? (
            <TouchableOpacity style={styles.saveBtn} onPress={saveToDiary} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0a1628" size="small" />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={18} color="#0a1628" />
                  <Text style={styles.saveBtnText}>Save to My Sightings</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.savedConfirm}>
              <Ionicons name="checkmark-circle" size={20} color="#00d4aa" />
              <Text style={styles.savedText}>Saved to your sightings diary</Text>
            </View>
          )}

          <TouchableOpacity style={styles.newScanBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="camera-outline" size={18} color="#e8f4fd" />
            <Text style={styles.newScanText}>Scan Another Fish</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1628' },
  scroll: { flex: 1 },

  imageContainer: { height: 280, position: 'relative' },
  fishImage: { width: '100%', height: '100%' },
  backIcon: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: { padding: 16 },

  dirtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1200',
    borderWidth: 1,
    borderColor: '#ffb74d44',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  dirtBannerText: { color: '#ffb74d', fontSize: 12, flex: 1, lineHeight: 17 },

  topMatchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#0f2044',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#142954',
  },
  topMatchLeft: { flex: 1, paddingRight: 12 },
  topMatchLabel: { color: '#8ab4d4', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  topMatchName: { color: '#e8f4fd', fontSize: 22, fontWeight: '800' },
  topMatchSci: { color: '#8ab4d4', fontSize: 13, fontStyle: 'italic', marginTop: 3 },
  topMatchLocal: { color: '#00d4aa', fontSize: 12, fontWeight: '600', marginTop: 4 },
  topMatchConfBlock: { alignItems: 'flex-end', minWidth: 64 },
  topMatchPct: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  topMatchConfLabel: { color: '#8ab4d4', fontSize: 11 },

  featuresCard: {
    backgroundColor: '#0a1e3a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00d4aa22',
  },
  featuresHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  featuresTitle: { color: '#00d4aa', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00d4aa',
    marginTop: 5,
    flexShrink: 0,
  },
  featureText: { color: '#c5dff0', fontSize: 13, flex: 1, lineHeight: 18 },
  reasoningBox: {
    backgroundColor: '#0f2044',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#00d4aa',
  },
  reasoningLabel: { color: '#8ab4d4', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  reasoningText: { color: '#c5dff0', fontSize: 12, lineHeight: 17 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f2044',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: '#142954' },
  tabLabel: { color: '#8ab4d4', fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: '#00d4aa' },

  resultsList: { gap: 8, marginBottom: 16 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#142954',
  },
  resultRowTop: {
    borderColor: '#00d4aa33',
    backgroundColor: '#0a1e3a',
  },
  resultRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  resultRankTop: { backgroundColor: '#00d4aa22' },
  resultRankText: { color: '#8ab4d4', fontSize: 13, fontWeight: '700' },
  resultRankTextTop: { color: '#00d4aa' },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  resultName: { color: '#e8f4fd', fontSize: 14, fontWeight: '600', flex: 1 },
  resultPct: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  resultSci: { color: '#8ab4d4', fontSize: 11, fontStyle: 'italic', marginBottom: 3 },
  resultFeatures: { color: '#4a7fa8', fontSize: 11, marginBottom: 6 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4aa',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { color: '#0a1628', fontSize: 16, fontWeight: '800' },
  savedConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00d4aa44',
  },
  savedText: { color: '#00d4aa', fontSize: 15, fontWeight: '600' },

  newScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#142954',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
    gap: 8,
  },
  newScanText: { color: '#e8f4fd', fontSize: 15, fontWeight: '600' },

  errorView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorTitle: { color: '#e8f4fd', fontSize: 20, fontWeight: '700', marginTop: 14 },
  errorText: { color: '#8ab4d4', fontSize: 14, textAlign: 'center', marginTop: 8 },
  backBtn: {
    backgroundColor: '#00d4aa',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  backBtnText: { color: '#0a1628', fontSize: 15, fontWeight: '700' },
});

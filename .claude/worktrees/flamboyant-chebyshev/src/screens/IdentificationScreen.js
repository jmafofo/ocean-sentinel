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
  const [selectedTab, setSelectedTab] = useState('results'); // 'results' | 'details'
  const [location, setLocation] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Fetch location silently in background
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

  const isLowConf = topResult?.lowConfidence;
  const confColor = getConfidenceColor(topResult?.confidence ?? 0);

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
            {isLowConf && (
              <View style={styles.lowConfBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#ffb74d" />
                <Text style={styles.lowConfText}>Low confidence — try a clearer photo</Text>
              </View>
            )}
          </View>
        )}

        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* ── Top match banner ─────────────────────── */}
          <View style={styles.topMatchCard}>
            <View>
              <Text style={styles.topMatchLabel}>Top Match</Text>
              <Text style={styles.topMatchName}>{topResult.species.name}</Text>
              <Text style={styles.topMatchSci}>{topResult.species.scientificName}</Text>
            </View>
            <View style={styles.topMatchConfBlock}>
              <Text style={[styles.topMatchPct, { color: confColor }]}>
                {Math.round(topResult.confidence * 100)}%
              </Text>
              <Text style={styles.topMatchConfLabel}>confidence</Text>
            </View>
          </View>

          {/* ── Tab bar ──────────────────────────────── */}
          <View style={styles.tabBar}>
            <TabBtn label="All Matches" active={selectedTab === 'results'} onPress={() => setSelectedTab('results')} />
            <TabBtn label="Species Info" active={selectedTab === 'details'} onPress={() => setSelectedTab('details')} />
          </View>

          {selectedTab === 'results' ? (
            /* ── Results list ───────────────────────── */
            <View style={styles.resultsList}>
              {results.map((item, idx) => (
                <TouchableOpacity
                  key={item.species.id}
                  style={styles.resultRow}
                  onPress={() => setSelectedTab('details')}
                  activeOpacity={0.8}
                >
                  <View style={styles.resultRank}>
                    <Text style={styles.resultRankText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.species.name}</Text>
                    <Text style={styles.resultSci}>{item.species.scientificName}</Text>
                    <ConfidenceBar confidence={item.confidence} height={5} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            /* ── Detail card ────────────────────────── */
            <View style={{ marginTop: 8 }}>
              <FishCard species={topResult.species} mode="detail" />
            </View>
          )}

          {/* ── Save to Diary button ─────────────────── */}
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

          {/* ── New scan button ──────────────────────── */}
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
  lowConfBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  lowConfText: { color: '#ffb74d', fontSize: 12, flex: 1 },

  body: { padding: 16 },

  topMatchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#0f2044',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#142954',
  },
  topMatchLabel: { color: '#8ab4d4', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  topMatchName: { color: '#e8f4fd', fontSize: 22, fontWeight: '800' },
  topMatchSci: { color: '#8ab4d4', fontSize: 13, fontStyle: 'italic', marginTop: 3 },
  topMatchConfBlock: { alignItems: 'flex-end' },
  topMatchPct: { fontSize: 36, fontWeight: '800' },
  topMatchConfLabel: { color: '#8ab4d4', fontSize: 11 },

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
  resultRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultRankText: { color: '#00d4aa', fontSize: 13, fontWeight: '700' },
  resultName: { color: '#e8f4fd', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultSci: { color: '#8ab4d4', fontSize: 11, fontStyle: 'italic', marginBottom: 6 },

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

  // Error
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

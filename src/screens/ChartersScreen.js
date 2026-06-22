import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCharters } from '../services/api';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  text: '#e8f4fd',
  subtext: '#8ab4d4',
  muted: '#4a6b8a',
};

const COAST_COLOR = {
  'Persian Gulf': '#3b82f6',
  'Gulf of Oman': '#00d4aa',
  Both: '#a855f7',
};

export default function ChartersScreen({ navigation }) {
  const [charters, setCharters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchCharters();
      setCharters(data.charters ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function renderItem({ item }) {
    const coastColor = COAST_COLOR[item.coast] || C.muted;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <View style={[styles.coastBadge, { borderColor: coastColor }]}>
                <Text style={[styles.coastText, { color: coastColor }]}>{item.coast}</Text>
              </View>
              {item.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.row, { marginTop: 2 }]}>
              <Ionicons name="location" size={12} color={C.muted} />
              <Text style={styles.small}>{item.location}</Text>
            </View>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>From</Text>
            <Text style={styles.price}>AED {item.price_aed?.toLocaleString?.() || item.price_aed}</Text>
            <View style={styles.row}>
              <Ionicons name="star" size={11} color="#fbbf24" />
              <Text style={styles.small}>{item.rating}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 8, gap: 12 }]}>
          <View style={styles.row}>
            <Ionicons name="time" size={12} color={C.accent} />
            <Text style={styles.small}>{item.duration}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="people" size={12} color={C.accent} />
            <Text style={styles.small}>Up to {item.capacity}</Text>
          </View>
        </View>

        {/* Target species */}
        {(item.target_species || []).length > 0 && (
          <View style={styles.speciesRow}>
            {(item.target_species || []).slice(0, 4).map((s) => (
              <View key={s} style={styles.speciesChip}>
                <Ionicons name="fish" size={10} color={C.accent} />
                <Text style={styles.speciesText}>{s}</Text>
              </View>
            ))}
            {(item.target_species || []).length > 4 && (
              <Text style={styles.speciesMore}>+{(item.target_species || []).length - 4}</Text>
            )}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.enquireBtn}
          onPress={() => Linking.openURL(`mailto:info@uaeangler.com?subject=Charter Enquiry — ${item.name}`)}
        >
          <Ionicons name="call" size={14} color={C.accent} />
          <Text style={styles.enquireText}> Enquire via UAE Anglers Hub</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fishing Charters</Text>
        <Text style={styles.subtitle}>Book a boat across the UAE</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={32} color="#e74c3c" />
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : charters.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="boat-outline" size={40} color={C.border} />
          <Text style={styles.emptyTitle}>No charters listed</Text>
        </View>
      ) : (
        <FlatList
          data={charters}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13, color: C.subtext, marginTop: 2 },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coastBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
  },
  coastText: { fontSize: 10, fontWeight: '700' },
  verifiedBadge: {
    backgroundColor: `${C.accent}15`, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: `${C.accent}30`,
  },
  verifiedText: { fontSize: 10, color: C.accent, fontWeight: '600' },
  name: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 6 },
  small: { fontSize: 11, color: C.muted },
  priceBox: { alignItems: 'flex-end', minWidth: 80 },
  priceLabel: { fontSize: 10, color: C.muted },
  price: { fontSize: 18, fontWeight: '800', color: C.accent },
  speciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  speciesChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: `${C.accent}12`, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${C.accent}25`,
  },
  speciesText: { fontSize: 10, color: C.accent },
  speciesMore: { fontSize: 10, color: C.muted, alignSelf: 'center' },
  enquireBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: `${C.accent}12`, borderWidth: 1, borderColor: `${C.accent}30`,
  },
  enquireText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  error: { color: '#e74c3c', marginTop: 10, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.card, borderRadius: 8 },
  retryText: { color: C.accent, fontWeight: '600' },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
});

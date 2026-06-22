import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { topSpots, emirates } from '../data/topSpots';

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

export default function SpotsScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [selectedEmirate, setSelectedEmirate] = useState('All');

  const filtered = useMemo(() => {
    return topSpots.filter(spot => {
      const matchesEmirate = selectedEmirate === 'All' || spot.emirate === selectedEmirate;
      const q = query.toLowerCase();
      const matchesQuery =
        spot.name.toLowerCase().includes(q) ||
        spot.emirate.toLowerCase().includes(q) ||
        spot.targetSpecies.some(s => s.toLowerCase().includes(q));
      return matchesEmirate && matchesQuery;
    });
  }, [query, selectedEmirate]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('SpotDetail', { spot: item })}
      activeOpacity={0.9}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={20} color={C.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardEmirate}>{item.emirate}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.dim} />
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.speciesRow}>
        {item.targetSpecies.slice(0, 3).map((s, i) => (
          <View key={i} style={styles.speciesPill}>
            <Text style={styles.speciesText}>{s}</Text>
          </View>
        ))}
        {item.targetSpecies.length > 3 && (
          <Text style={styles.moreText}>+{item.targetSpecies.length - 3}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>FISHING SPOTS</Text>
          <Text style={styles.subtitle}>{filtered.length} locations</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Charters')}
        >
          <Ionicons name="boat" size={16} color={C.accent} />
          <Text style={styles.headerBtnText}>Charters</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={C.dim} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search spots, emirates, species..."
          placeholderTextColor={C.dim}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={C.dim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Emirate filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {emirates.map(e => (
          <TouchableOpacity
            key={e}
            style={[styles.filterPill, selectedEmirate === e && styles.filterPillActive]}
            onPress={() => setSelectedEmirate(e)}
          >
            <Text style={[styles.filterText, selectedEmirate === e && styles.filterTextActive]}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={48} color={C.dim} />
          <Text style={styles.emptyTitle}>No spots found</Text>
          <Text style={styles.emptyText}>Try a different search or filter.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: C.sub, fontSize: 13, marginTop: 2 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  headerBtnText: { color: C.accent, fontSize: 12, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    paddingVertical: 0,
  },

  filterScroll: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterPill: {
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: C.accent + '22',
    borderColor: C.accent + '66',
  },
  filterText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.accent, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyText: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 40, height: 40,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { color: C.text, fontSize: 15, fontWeight: '700' },
  cardEmirate: { color: C.sub, fontSize: 12, marginTop: 1 },
  cardDesc: { color: C.sub, fontSize: 12, lineHeight: 18, marginTop: 10 },
  speciesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  speciesPill: {
    backgroundColor: C.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  speciesText: { color: C.accent, fontSize: 10, fontWeight: '700' },
  moreText: { color: C.dim, fontSize: 10, fontWeight: '600' },
});

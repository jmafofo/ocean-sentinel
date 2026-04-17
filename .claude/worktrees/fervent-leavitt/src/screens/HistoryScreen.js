import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getAllSightings, deleteSighting, formatTimestamp } from '../services/database';
import fishSpecies from '../data/fishSpecies.json';

export default function HistoryScreen({ navigation }) {
  const [sightings, setSightings] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getAllSightings(200);
      setSightings(data);
      setFiltered(data);
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(sightings);
      return;
    }
    const q = text.toLowerCase();
    setFiltered(
      sightings.filter(s =>
        s.speciesName.toLowerCase().includes(q) ||
        (fishSpecies.find(f => f.id === s.speciesId)?.scientificName ?? '').toLowerCase().includes(q)
      )
    );
  };

  const confirmDelete = (id, name) => {
    Alert.alert(
      'Delete Sighting',
      `Remove ${name} from your diary?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSighting(id);
            load();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const species = fishSpecies.find(f => f.id === item.speciesId);
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Text style={{ fontSize: 22 }}>🐟</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.speciesName}</Text>
          {species && <Text style={styles.cardSci}>{species.scientificName}</Text>}
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={12} color="#4a7fa8" />
            <Text style={styles.cardTime}>{formatTimestamp(item.timestamp)}</Text>
            {item.latitude != null && (
              <>
                <Ionicons name="location-outline" size={12} color="#4a7fa8" style={{ marginLeft: 8 }} />
                <Text style={styles.cardTime}>
                  {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
                </Text>
              </>
            )}
          </View>
          {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardConf}>{Math.round(item.confidence * 100)}%</Text>
          <TouchableOpacity
            onPress={() => confirmDelete(item.id, item.speciesName)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#4a7fa8" style={{ marginTop: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>My Sightings</Text>
        <Text style={styles.subtitle}>{sightings.length} recorded</Text>
      </View>

      {/* ── Search ──────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color="#8ab4d4" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search species…"
          placeholderTextColor="#4a7fa8"
          value={search}
          onChangeText={onSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')}>
            <Ionicons name="close-circle" size={16} color="#4a7fa8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00d4aa" />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{search ? '🔍' : '📋'}</Text>
              <Text style={styles.emptyTitle}>
                {search ? 'No matches found' : 'No sightings yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? `No fish matching "${search}"`
                  : 'Use the Camera tab to identify and save your first fish sighting.'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#142954',
  },
  searchInput: { flex: 1, color: '#e8f4fd', fontSize: 14 },

  list: { paddingBottom: 20 },
  emptyContainer: { flex: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#142954',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { color: '#e8f4fd', fontSize: 15, fontWeight: '600' },
  cardSci: { color: '#8ab4d4', fontSize: 11, fontStyle: 'italic', marginTop: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardTime: { color: '#4a7fa8', fontSize: 11, marginLeft: 3 },
  cardNotes: { color: '#8ab4d4', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', marginLeft: 8 },
  cardConf: { color: '#00d4aa', fontSize: 15, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#e8f4fd', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#8ab4d4', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});

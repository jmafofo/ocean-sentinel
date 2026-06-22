import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchClubs } from '../services/api';

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

export default function ClubsScreen({ navigation }) {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('my'); // 'my' | 'public'

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchClubs({ filter });
      setClubs(data.clubs ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, [filter]);

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
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ClubDetail', { slug: item.slug, name: item.name })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Ionicons name="boat" size={20} color={C.accent} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.name}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.row}>
              <Ionicons name="people" size={12} color={C.muted} />
              <Text style={styles.small}>{item.member_count} member{item.member_count !== 1 ? 's' : ''}</Text>
              <Text style={styles.dot}> · </Text>
              <Text style={styles.small}>{item.visibility}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fishing Clubs</Text>
        <Text style={styles.subtitle}>Private groups for serious anglers</Text>
      </View>

      <View style={styles.tabs}>
        {['my', 'public'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab === 'my' ? 'My Clubs' : 'Public'}
            </Text>
          </TouchableOpacity>
        ))}
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
      ) : clubs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="boat-outline" size={40} color={C.border} />
          <Text style={styles.emptyTitle}>
            {filter === 'my' ? 'No clubs yet' : 'No public clubs'}
          </Text>
          <Text style={styles.emptySub}>
            {filter === 'my'
              ? 'Create a club or accept an invite to get started.'
              : 'Check back later for public clubs.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clubs}
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
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.card },
  tabActive: { backgroundColor: `${C.accent}20` },
  tabText: { color: C.subtext, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.accent },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: `${C.accent}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  cardMeta: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  desc: { fontSize: 12, color: C.subtext, marginTop: 2, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  small: { fontSize: 11, color: C.muted },
  dot: { fontSize: 11, color: C.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  error: { color: '#e74c3c', marginTop: 10, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.card, borderRadius: 8 },
  retryText: { color: C.accent, fontWeight: '600' },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 4, maxWidth: 240 },
});

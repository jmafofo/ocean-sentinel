import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchClub, fetchClubPosts, joinClub, rsvpToTrip } from '../services/api';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  text: '#e8f4fd',
  subtext: '#8ab4d4',
  muted: '#4a6b8a',
  green: '#27ae60',
  amber: '#f39c12',
  red: '#e74c3c',
};

export default function ClubDetailScreen({ route, navigation }) {
  const { slug, name } = route.params ?? {};
  const [club, setClub] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rsvpLoading, setRsvpLoading] = useState({});

  const load = useCallback(async () => {
    setError('');
    try {
      const [clubData, postsData] = await Promise.all([
        fetchClub(slug),
        fetchClubPosts(slug).catch(() => ({ posts: [] })),
      ]);
      setClub(clubData);
      setPosts(postsData.posts ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, [slug]);

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

  async function handleJoin() {
    try {
      await joinClub(slug);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRsvp(tripId, status) {
    setRsvpLoading((p) => ({ ...p, [tripId]: true }));
    try {
      await rsvpToTrip(tripId, status);
      setPosts((prev) =>
        prev.map((p) =>
          p.trip_id === tripId ? { ...p, trip: { ...p.trip, my_rsvp: status } } : p
        )
      );
    } catch (err) {
      setError(err.message);
    }
    setRsvpLoading((p) => ({ ...p, [tripId]: false }));
  }

  function statusColor(status) {
    if (status === 'open') return C.green;
    if (status === 'full') return C.amber;
    if (status === 'cancelled') return C.red;
    return C.muted;
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (error && !club) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle" size={32} color={C.red} />
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMember = club?.me?.status === 'active';
  const isInvited = club?.me?.status === 'invited';
  const isAdmin = club?.me?.role === 'owner' || club?.me?.role === 'admin';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{club?.club?.name || name}</Text>
        {club?.club?.description ? (
          <Text style={styles.desc}>{club.club.description}</Text>
        ) : null}
        <View style={styles.row}>
          <Ionicons name="people" size={12} color={C.muted} />
          <Text style={styles.small}>{club?.club?.member_count ?? 0} members</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.small}>{club?.club?.visibility}</Text>
        </View>

        {!isMember && isInvited && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin}>
            <Text style={styles.primaryBtnText}>Accept Invite</Text>
          </TouchableOpacity>
        )}
        {!isMember && !isInvited && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Private club — invite only</Text>
          </View>
        )}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 10 }]}
            onPress={() => navigation.navigate('ClubSettings', { slug })}
          >
            <Ionicons name="settings" size={14} color={C.accent} />
            <Text style={styles.secondaryBtnText}> Settings</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Members */}
      {isMember && club?.members && club.members.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.memberRow}>
              {club.members.map((m) => (
                <View key={m.id} style={styles.memberChip}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>{(m.display_name || m.username)?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>{m.display_name || m.username}</Text>
                  {m.role !== 'member' && (
                    <Text style={styles.memberRole}>{m.role}</Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Trips */}
      {isMember && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trips</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={C.border} />
              <Text style={styles.emptyText}>No trips planned yet.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripMeta}>
                    <View style={styles.row}>
                      <Ionicons name="location" size={13} color={C.accent} />
                      <Text style={styles.tripDest}>{post.trip.destination}</Text>
                      <View style={[styles.statusBadge, { borderColor: statusColor(post.trip.status) }]}>
                        <Text style={[styles.statusText, { color: statusColor(post.trip.status) }]}>{post.trip.status}</Text>
                      </View>
                    </View>
                    {(post.trip.start_date || post.trip.end_date) && (
                      <View style={[styles.row, { marginTop: 4 }]}>
                        <Ionicons name="calendar" size={12} color={C.muted} />
                        <Text style={styles.small}>
                          {post.trip.start_date ? new Date(post.trip.start_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) : ''}
                          {post.trip.start_date && post.trip.end_date ? ' — ' : ''}
                          {post.trip.end_date ? new Date(post.trip.end_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) : ''}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.row, { marginTop: 4 }]}>
                      <Ionicons name="people" size={12} color={C.muted} />
                      <Text style={styles.small}>{post.trip.rsvp_count} going{post.trip.max_participants ? ` / ${post.trip.max_participants}` : ''}</Text>
                      {post.trip.price_estimate && <Text style={styles.dot}> · {post.trip.price_estimate}</Text>}
                    </View>
                  </View>
                </View>
                {post.caption && <Text style={styles.caption}>{post.caption}</Text>}

                {/* RSVP buttons */}
                <View style={styles.rsvpRow}>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, post.trip.my_rsvp === 'confirmed' && styles.rsvpBtnActive]}
                    onPress={() => handleRsvp(post.trip_id, 'confirmed')}
                    disabled={rsvpLoading[post.trip_id]}
                  >
                    <Text style={[styles.rsvpText, post.trip.my_rsvp === 'confirmed' && styles.rsvpTextActive]}>
                      {post.trip.my_rsvp === 'confirmed' ? '✓ Going' : 'Going'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, post.trip.my_rsvp === 'interested' && { backgroundColor: `${C.accent}30`, borderColor: C.accent }]}
                    onPress={() => handleRsvp(post.trip_id, 'interested')}
                    disabled={rsvpLoading[post.trip_id]}
                  >
                    <Text style={[styles.rsvpText, post.trip.my_rsvp === 'interested' && { color: C.accent }]}>
                      Interested
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, post.trip.my_rsvp === 'declined' && { backgroundColor: '#e74c3c20', borderColor: C.red }]}
                    onPress={() => handleRsvp(post.trip_id, 'declined')}
                    disabled={rsvpLoading[post.trip_id]}
                  >
                    <Text style={[styles.rsvpText, post.trip.my_rsvp === 'declined' && { color: C.red }]}>
                      Can&apos;t go
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 16, paddingTop: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  desc: { fontSize: 13, color: C.subtext, marginTop: 6, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontSize: 11, color: C.muted },
  dot: { fontSize: 11, color: C.muted },
  primaryBtn: {
    marginTop: 12, backgroundColor: C.accent, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.border,
  },
  secondaryBtnText: { color: C.accent, fontWeight: '600', fontSize: 13 },
  badge: {
    marginTop: 12, backgroundColor: C.card, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.border,
  },
  badgeText: { color: C.muted, fontSize: 12 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 10 },
  memberRow: { flexDirection: 'row', gap: 10 },
  memberChip: { alignItems: 'center', width: 64 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${C.accent}20`, alignItems: 'center', justifyContent: 'center',
  },
  memberInitial: { color: C.accent, fontWeight: '700', fontSize: 14 },
  memberName: { fontSize: 10, color: C.text, marginTop: 4, textAlign: 'center' },
  memberRole: { fontSize: 9, color: C.accent, textTransform: 'uppercase' },
  emptyCard: { alignItems: 'center', paddingVertical: 24, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  emptyText: { color: C.muted, fontSize: 12, marginTop: 6 },
  tripCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  tripHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tripMeta: { flex: 1 },
  tripDest: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  statusBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  caption: { fontSize: 12, color: C.subtext, marginTop: 8, lineHeight: 17 },
  rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rsvpBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  rsvpBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  rsvpText: { color: C.subtext, fontSize: 12, fontWeight: '600' },
  rsvpTextActive: { color: '#000' },
  error: { color: C.red, marginTop: 10, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.card, borderRadius: 8 },
  retryText: { color: C.accent, fontWeight: '600' },
});

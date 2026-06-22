import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Image, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  fetchFeedPosts, fetchPublicCatches,
} from '../services/api';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  blue: '#4fc3f7',
  amber: '#ffb74d',
  text: '#ddeeff',
  sub: '#6a9fc0',
  dim: '#2a4a6a',
};

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Avatar({ uri, name, size = 36 }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

function PostCard({ post, onPress }) {
  const media = post.media ?? [];
  const images = media.slice(0, 3).filter(m => m.media_type === 'image');

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(post)} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <Avatar uri={post.profile?.avatar_url} name={post.profile?.display_name ?? post.profile?.username} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.cardAuthor}>{post.profile?.display_name ?? post.profile?.username ?? 'Angler'}</Text>
          <Text style={styles.cardTime}>{formatTimeAgo(post.created_at)}</Text>
        </View>
      </View>

      {post.caption && (
        <Text style={styles.cardCaption} numberOfLines={2}>{post.caption}</Text>
      )}

      {images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {images.map((img, idx) => (
            <Image key={idx} source={{ uri: img.media_url }} style={styles.cardImage} />
          ))}
        </ScrollView>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="heart-outline" size={16} color={C.accent} />
          <Text style={styles.footerText}>{post.likes_count ?? 0}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="chatbubble-outline" size={16} color={C.blue} />
          <Text style={styles.footerText}>{post.comments_count ?? 0}</Text>
        </View>
        <View style={[styles.footerItem, { marginLeft: 'auto' }]}>
          <Ionicons name="share-outline" size={16} color={C.sub} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CatchCard({ catchItem, onPress }) {
  const photo = catchItem.photo_urls?.[0] ?? catchItem.photo_url;
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(catchItem)} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <Avatar name={catchItem.angler_name ?? 'Angler'} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.cardAuthor}>{catchItem.angler_name ?? 'Angler'}</Text>
          <Text style={styles.cardTime}>{formatTimeAgo(catchItem.created_at)}</Text>
        </View>
        <View style={styles.catchBadge}>
          <Text style={styles.catchBadgeText}>CATCH</Text>
        </View>
      </View>

      {photo && (
        <Image source={{ uri: photo }} style={styles.catchImage} />
      )}

      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        <Text style={styles.catchSpecies}>{catchItem.species?.name ?? catchItem.species_name ?? 'Unknown Species'}</Text>
        <View style={styles.catchMetaRow}>
          {catchItem.weight_kg != null && (
            <Text style={styles.catchMeta}>{catchItem.weight_kg} kg</Text>
          )}
          {catchItem.length_cm != null && (
            <Text style={styles.catchMeta}>{catchItem.length_cm} cm</Text>
          )}
          {catchItem.location_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={12} color={C.sub} />
              <Text style={styles.catchMeta}> {catchItem.location_name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CommunityScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadFeed = useCallback(async () => {
    setError(null);
    try {
      const [postsRes, catchesRes] = await Promise.all([
        fetchFeedPosts({ limit: 20 }).catch(() => ({ posts: [] })),
        fetchPublicCatches({ limit: 20 }).catch(() => ({ catches: [] })),
      ]);

      const posts = (postsRes.posts ?? []).map(p => ({ ...p, _type: 'post' }));
      const catches = (catchesRes.catches ?? []).map(c => ({ ...c, _type: 'catch' }));

      const merged = [...posts, ...catches].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setItems(merged);
    } catch (err) {
      console.error('Community feed error:', err);
      setError(err.message ?? 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFeed(); }, [loadFeed]));

  const onRefresh = () => { setRefreshing(true); loadFeed(); };

  const handlePress = (item) => {
    if (item._type === 'post') {
      navigation.navigate('PostDetail', { post: item });
    }
    // catches can be expanded later
  };

  const renderItem = ({ item }) => {
    if (item._type === 'post') return <PostCard post={item} onPress={handlePress} />;
    return <CatchCard catchItem={item} onPress={handlePress} />;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>COMMUNITY</Text>
          <Text style={styles.subtitle}>{items.length} updates</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Clubs')}
        >
          <Ionicons name="boat" size={16} color={C.accent} />
          <Text style={styles.headerBtnText}>Clubs</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef5350" />
          <Text style={styles.emptyTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeed}>
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={56} color={C.dim} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>Follow anglers to see their posts.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item._type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyText: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  retryBtn: {
    marginTop: 20,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { color: C.bg, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatar: { backgroundColor: C.surface },
  avatarFallback: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.accent, fontWeight: '800' },
  cardAuthor: { color: C.text, fontSize: 14, fontWeight: '700' },
  cardTime: { color: C.sub, fontSize: 11, marginTop: 1 },
  cardCaption: { color: C.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 10 },
  imageScroll: { marginLeft: 14 },
  cardImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: C.surface,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  footerText: { color: C.sub, fontSize: 12, fontWeight: '600', marginLeft: 4 },

  catchBadge: {
    backgroundColor: C.accent + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.accent + '44',
  },
  catchBadgeText: { color: C.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  catchImage: { width: '100%', height: 200, backgroundColor: C.surface },
  catchSpecies: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 10 },
  catchMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 },
  catchMeta: { color: C.sub, fontSize: 12, fontWeight: '600' },
});

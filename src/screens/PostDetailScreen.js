import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  likePost, unlikePost, fetchPostComments, addPostComment,
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

export default function PostDetailScreen({ route, navigation }) {
  const { post } = route.params ?? {};
  const [liked, setLiked] = useState(post?.has_liked ?? false);
  const [likesCount, setLikesCount] = useState(post?.likes_count ?? 0);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    try {
      const data = await fetchPostComments(post.id);
      setComments(data.comments ?? []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }, [post?.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleLike = async () => {
    if (!post?.id) return;
    try {
      if (liked) {
        await unlikePost(post.id);
        setLiked(false);
        setLikesCount(c => Math.max(0, c - 1));
      } else {
        await likePost(post.id);
        setLiked(true);
        setLikesCount(c => c + 1);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleSendComment = async () => {
    if (!post?.id || !commentText.trim()) return;
    setSending(true);
    try {
      await addPostComment(post.id, commentText.trim());
      setCommentText('');
      await loadComments();
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSending(false);
    }
  };

  const media = post?.media ?? [];
  const images = media.filter(m => m.media_type === 'image');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>POST</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Author */}
          <View style={styles.authorRow}>
            <Avatar
              uri={post?.profile?.avatar_url}
              name={post?.profile?.display_name ?? post?.profile?.username}
              size={40}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.authorName}>
                {post?.profile?.display_name ?? post?.profile?.username ?? 'Angler'}
              </Text>
              <Text style={styles.authorTime}>{formatTimeAgo(post?.created_at)}</Text>
            </View>
          </View>

          {/* Caption */}
          {post?.caption && (
            <Text style={styles.caption}>{post.caption}</Text>
          )}

          {/* Images */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {images.map((img, idx) => (
                <Image key={idx} source={{ uri: img.media_url }} style={styles.detailImage} />
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#ef5350' : C.accent} />
              <Text style={[styles.actionText, { color: liked ? '#ef5350' : C.accent }]}>{likesCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={C.blue} />
              <Text style={[styles.actionText, { color: C.blue }]}>{comments.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { marginLeft: 'auto' }]}>
              <Ionicons name="share-outline" size={20} color={C.sub} />
            </TouchableOpacity>
          </View>

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>// COMMENTS</Text>
            {loadingComments ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet. Be the first to comment.</Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <Avatar uri={c.profiles?.avatar_url} name={c.profiles?.display_name ?? c.profiles?.username} size={28} />
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{c.profiles?.display_name ?? c.profiles?.username ?? 'Angler'}</Text>
                    <Text style={styles.commentBody}>{c.body}</Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(c.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </View>
        </ScrollView>

        {/* Comment input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={C.dim}
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: commentText.trim() && !sending ? 1 : 0.4 }]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || sending}
          >
            <Ionicons name="send" size={18} color={C.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
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
  authorName: { color: C.text, fontSize: 15, fontWeight: '700' },
  authorTime: { color: C.sub, fontSize: 11, marginTop: 1 },

  caption: {
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  imageScroll: { marginLeft: 16, marginTop: 4 },
  detailImage: {
    width: 280,
    height: 200,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: C.surface,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 4,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { fontSize: 13, fontWeight: '700', marginLeft: 5 },

  commentsSection: { paddingHorizontal: 16, paddingTop: 16 },
  commentsTitle: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  noComments: { color: C.sub, fontSize: 13, fontStyle: 'italic', marginVertical: 8 },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  commentAuthor: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  commentBody: { color: C.sub, fontSize: 13, lineHeight: 18 },
  commentTime: { color: C.dim, fontSize: 10, marginTop: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});

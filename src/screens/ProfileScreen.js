import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { isLoggedIn, getUser, logout } from '../services/auth';
import { getSightingCount, getUniqueSpeciesCount } from '../services/database';
import LoginScreen from './LoginScreen';

const C = {
  bg: '#050e1f',
  surface: '#0a1628',
  card: '#0d1f3c',
  border: '#12305a',
  accent: '#00d4aa',
  text: '#ddeeff',
  sub: '#6a9fc0',
  dim: '#2a4a6a',
};

export default function ProfileScreen({ route, navigation }) {
  const { onLogout } = route.params ?? {};
  const [loggedIn, setLoggedIn] = useState(null);
  const [user, setUser] = useState(null);
  const [catchCount, setCatchCount] = useState(null);
  const [speciesCount, setSpeciesCount] = useState(null);

  const load = async () => {
    const ok = await isLoggedIn();
    setLoggedIn(ok);
    if (ok) {
      const [u, catches, species] = await Promise.all([
        getUser(),
        getSightingCount(),
        getUniqueSpeciesCount(),
      ]);
      setUser(u);
      setCatchCount(catches);
      setSpeciesCount(species);
    } else {
      setUser(null);
      setCatchCount(null);
      setSpeciesCount(null);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            setLoggedIn(false);
            setUser(null);
            onLogout?.();
          },
        },
      ]
    );
  };

  if (loggedIn === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        onLogin={() => {
          load();
        }}
      />
    );
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'Angler';
  const username = user?.user_metadata?.username ?? displayName;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.eyebrow}>// ACCOUNT</Text>
            <Text style={styles.title}>PROFILE</Text>
          </View>
        </View>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={C.accent} />
          </View>
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>UAE ANGLER</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="fish-outline" size={20} color={C.accent} />
            <Text style={styles.statLabel}>Catches</Text>
            <Text style={styles.statValue}>
              {catchCount === null ? '—' : catchCount}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy-outline" size={20} color={C.accent} />
            <Text style={styles.statLabel}>Species</Text>
            <Text style={styles.statValue}>
              {speciesCount === null ? '—' : speciesCount}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={20} color={C.accent} />
            <Text style={styles.statLabel}>Spots</Text>
            <Text style={styles.statValue}>—</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>// SETTINGS</Text>

          <TouchableOpacity style={styles.actionRow} onPress={() => {}}>
            <Ionicons name="globe-outline" size={18} color={C.sub} />
            <Text style={styles.actionText}>Creator Profile</Text>
            <Text style={styles.actionUrl}>uaeangler.com/creators/{username}</Text>
            <Ionicons name="open-outline" size={14} color={C.dim} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#ef5350" />
            <Text style={[styles.actionText, { color: '#ef5350' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={14} color={C.dim} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
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
  eyebrow: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatar: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { color: C.text, fontSize: 18, fontWeight: '800' },
  userEmail: { color: C.sub, fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  badge: {
    backgroundColor: C.accent + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.accent + '44',
  },
  badgeText: { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statLabel: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 6 },
  statValue: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 2 },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionLabel: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  actionText: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1 },
  actionUrl: { color: C.dim, fontSize: 11, marginRight: 4 },
});

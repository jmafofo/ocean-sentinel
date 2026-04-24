/**
 * LogCatchScreen
 *
 * Triggered after a successful fish identification.
 * Lets the user log full catch details — including a social-media video link
 * (YouTube, TikTok, Instagram, Facebook) — and syncs the record to their
 * UAE Angler profile.
 *
 * Route params:
 *   topResult  — the top identification result from IdentificationScreen
 *   location   — { latitude, longitude } from GPS at time of capture
 *   imageUri   — local photo URI
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isLoggedIn, getUser } from '../services/auth';
import { submitCatch } from '../services/api';

// ── Palette (matches HUD theme) ───────────────────────────────────────────────
const C = {
  bg:      '#050e1f',
  surface: '#0a1628',
  card:    '#0d1f3c',
  border:  '#12305a',
  accent:  '#00d4aa',
  blue:    '#4fc3f7',
  amber:   '#ffb74d',
  red:     '#ef5350',
  text:    '#ddeeff',
  sub:     '#6a9fc0',
  dim:     '#2a4a6a',
};

// ── Video URL validator (YouTube / TikTok / Instagram / Facebook) ─────────────
const VIDEO_PLATFORMS = [
  'youtube.com', 'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com', 'fb.watch',
];

function isValidVideoUrl(url) {
  if (!url) return true; // optional field
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return VIDEO_PLATFORMS.some(p => host === p || host.endsWith('.' + p));
  } catch {
    return false;
  }
}

/** Returns the best Ionicons name + colour for the detected platform. */
function detectPlatformIcon(url) {
  if (!url) return { icon: 'play-circle-outline', color: '#6a9fc0' };
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('youtube') || host.includes('youtu.be'))
      return { icon: 'logo-youtube', color: '#ff0000' };
    if (host.includes('tiktok'))
      return { icon: 'logo-tiktok', color: '#69c9d0' };
    if (host.includes('instagram'))
      return { icon: 'logo-instagram', color: '#e1306c' };
    if (host.includes('facebook') || host.includes('fb.watch'))
      return { icon: 'logo-facebook', color: '#1877f2' };
  } catch { /* ignore */ }
  return { icon: 'play-circle-outline', color: '#6a9fc0' };
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, icon, children, required }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        <Ionicons name={icon} size={13} color={C.sub} />
        <Text style={styles.fieldLabelText}>{label}{required && <Text style={{ color: C.accent }}> *</Text>}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LogCatchScreen({ route, navigation }) {
  const { topResult, location, imageUri } = route.params ?? {};

  const [loggedIn, setLoggedIn]   = useState(null); // null = checking
  const [user, setUser]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [weightKg, setWeightKg]       = useState('');
  const [lengthCm, setLengthCm]       = useState('');
  const [bait, setBait]               = useState('');
  const [technique, setTechnique]     = useState('');
  const [locationName, setLocationName] = useState('');
  const [videoUrl, setVideoUrl]       = useState('');
  const [notes, setNotes]             = useState('');
  const [isPublic, setIsPublic]       = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await isLoggedIn();
      setLoggedIn(ok);
      if (ok) setUser(await getUser());
    })();
  }, []);

  const videoValid   = isValidVideoUrl(videoUrl);
  const platformIcon = detectPlatformIcon(videoUrl);

  const handleSubmit = async () => {
    if (!loggedIn) {
      Alert.alert('Sign In Required', 'Log in to your UAE Angler account to sync catches.', [
        { text: 'Cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }
    if (!videoValid) {
      Alert.alert(
        'Invalid Video URL',
        'Accepted platforms: YouTube, TikTok, Instagram, Facebook.\nExample: https://youtube.com/watch?v=…',
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitCatch({
        species:          topResult.species.name,
        scientific_name:  topResult.species.scientificName,
        weight_kg:        weightKg  ? parseFloat(weightKg)  : undefined,
        length_cm:        lengthCm  ? parseFloat(lengthCm)  : undefined,
        bait:             bait      || undefined,
        technique:        technique || undefined,
        location_name:    locationName || undefined,
        latitude:         location?.latitude,
        longitude:        location?.longitude,
        video_url:        videoUrl || undefined,
        notes:            notes || undefined,
        is_public:        isPublic,
        identification_status: 'identified',
        source:           'ocean_sentinel',
      });
      setSubmitted(true);
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') {
        Alert.alert('Session Expired', 'Please sign in again to sync your catch.');
      } else {
        Alert.alert('Sync Failed', err.message ?? 'Could not upload catch. Check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auth check loading ──────────────────────────────────────────────────────
  if (loggedIn === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successView}>
          <View style={styles.successOrb}>
            <Ionicons name="checkmark" size={42} color={C.accent} />
          </View>
          <Text style={styles.successTitle}>CATCH SYNCED</Text>
          <Text style={styles.successSub}>
            Your catch is live on UAE Angler at
          </Text>
          <Text style={styles.successUrl}>
            uaeangler.com/creators/{user?.user_metadata?.username ?? '…'}
          </Text>
          {videoUrl ? (
            <View style={[styles.successYt, { backgroundColor: platformIcon.color + '18', borderColor: platformIcon.color + '44' }]}>
              <Ionicons name={platformIcon.icon} size={14} color={platformIcon.color} />
              <Text style={[styles.successYtText, { color: platformIcon.color }]}>Video link attached to this catch</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.popToTop()}>
            <Text style={styles.successBtnText}>BACK TO HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtnSecondary} onPress={() => navigation.goBack()}>
            <Text style={styles.successBtnSecondaryText}>Log Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.eyebrow}>// LOG_CATCH</Text>
              <Text style={styles.title}>SYNC TO UAE ANGLER</Text>
            </View>
          </View>

          {/* ── Identified species card ─────────────────────────── */}
          <View style={styles.speciesCard}>
            <View style={styles.speciesCardLeft}>
              <Text style={styles.speciesCardLabel}>IDENTIFIED SPECIES</Text>
              <Text style={styles.speciesName}>{topResult?.species?.name ?? '—'}</Text>
              <Text style={styles.speciesSci}>{topResult?.species?.scientificName ?? ''}</Text>
            </View>
            <View style={[styles.confBadge, {
              borderColor: (topResult?.confidence ?? 0) >= 0.8 ? C.accent
                : (topResult?.confidence ?? 0) >= 0.55 ? C.amber : C.red,
            }]}>
              <Text style={[styles.confVal, {
                color: (topResult?.confidence ?? 0) >= 0.8 ? C.accent
                  : (topResult?.confidence ?? 0) >= 0.55 ? C.amber : C.red,
              }]}>
                {Math.round((topResult?.confidence ?? 0) * 100)}
              </Text>
              <Text style={styles.confPct}>%</Text>
            </View>
          </View>

          {/* ── GPS info ────────────────────────────────────────── */}
          {location && (
            <View style={styles.gpsRow}>
              <Ionicons name="location" size={13} color={C.accent} />
              <Text style={styles.gpsText}>
                GPS: {location.latitude.toFixed(5)}°N  {location.longitude.toFixed(5)}°E
              </Text>
            </View>
          )}

          {/* ── Not logged in banner ────────────────────────────── */}
          {!loggedIn && (
            <TouchableOpacity
              style={styles.authBanner}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-circle-outline" size={18} color={C.amber} />
              <Text style={styles.authBannerText}>Sign in to your UAE Angler account to sync catches</Text>
              <Ionicons name="chevron-forward" size={14} color={C.amber} />
            </TouchableOpacity>
          )}

          {/* ── Video Link (YouTube / TikTok / Instagram / Facebook) ── */}
          <View style={[styles.ytCard, !videoValid && videoUrl.length > 0 && { borderColor: C.red + '88' }]}>
            <View style={styles.ytHeader}>
              <Ionicons name={platformIcon.icon} size={20} color={platformIcon.color} />
              <Text style={styles.ytTitle}>Video Link</Text>
              <Text style={styles.ytOptional}>optional</Text>
            </View>
            <TextInput
              style={[styles.ytInput, !videoValid && videoUrl.length > 0 && { color: C.red }]}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="YouTube · TikTok · Instagram · Facebook"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {!videoValid && videoUrl.length > 0 && (
              <Text style={styles.ytError}>Accepted: youtube.com · tiktok.com · instagram.com · facebook.com</Text>
            )}
            <Text style={styles.ytHint}>
              Paste a link to the video where this catch appears. Your catch will show the video on your creator profile.
            </Text>
          </View>

          {/* ── Measurements ───────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>// MEASUREMENTS</Text>
            <View style={styles.row}>
              <Field label="WEIGHT (kg)" icon="scale-outline" style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={weightKg}
                  onChangeText={setWeightKg}
                  placeholder="e.g. 2.4"
                  placeholderTextColor={C.dim}
                  keyboardType="decimal-pad"
                />
              </Field>
              <View style={{ width: 10 }} />
              <Field label="LENGTH (cm)" icon="resize-outline" style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={lengthCm}
                  onChangeText={setLengthCm}
                  placeholder="e.g. 45"
                  placeholderTextColor={C.dim}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
          </View>

          {/* ── Spot info ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>// LOCATION</Text>
            <Field label="SPOT NAME" icon="location-outline">
              <TextInput
                style={styles.input}
                value={locationName}
                onChangeText={setLocationName}
                placeholder="e.g. Hameem Beach, Al Aryam Island"
                placeholderTextColor={C.dim}
              />
            </Field>
          </View>

          {/* ── Technique ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>// TECHNIQUE</Text>
            <View style={styles.row}>
              <Field label="BAIT / LURE" icon="fish-outline">
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={bait}
                  onChangeText={setBait}
                  placeholder="e.g. squid, crab"
                  placeholderTextColor={C.dim}
                />
              </Field>
              <View style={{ width: 10 }} />
              <Field label="METHOD" icon="settings-outline">
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={technique}
                  onChangeText={setTechnique}
                  placeholder="e.g. bottom rig"
                  placeholderTextColor={C.dim}
                />
              </Field>
            </View>
          </View>

          {/* ── Notes ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>// NOTES</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Tide, conditions, time of day..."
              placeholderTextColor={C.dim}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* ── Public toggle ───────────────────────────────────── */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Show on public profile</Text>
              <Text style={styles.toggleSub}>Visible on your UAE Angler creator page</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: C.border, true: C.accent + '88' }}
              thumbColor={isPublic ? C.accent : C.sub}
            />
          </View>

          {/* ── Submit ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.submitBtn, (!loggedIn || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={loggedIn ? C.bg : C.sub} />
                <Text style={[styles.submitBtnText, !loggedIn && { color: C.sub }]}>
                  {loggedIn ? 'SYNC TO UAE ANGLER' : 'SIGN IN TO SYNC'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
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
  title:   { color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  speciesCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accent + '44',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  speciesCardLeft: { flex: 1, paddingRight: 12 },
  speciesCardLabel: { color: C.sub, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  speciesName: { color: C.text, fontSize: 18, fontWeight: '800' },
  speciesSci:  { color: C.sub, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  confBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confVal: { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  confPct: { color: C.sub, fontSize: 10, fontWeight: '700', lineHeight: 18, marginBottom: 2 },

  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  gpsText: { color: C.sub, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  authBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1200',
    borderWidth: 1,
    borderColor: C.amber + '55',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  authBannerText: { flex: 1, color: C.amber, fontSize: 13, fontWeight: '600' },

  ytCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cc000044',
    padding: 16,
    marginBottom: 8,
  },
  ytHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ytTitle: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  ytOptional: { color: C.dim, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  ytInput: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 13,
    padding: 10,
    marginBottom: 6,
  },
  ytError: { color: C.red, fontSize: 11, marginBottom: 4 },
  ytHint: { color: C.sub, fontSize: 11, lineHeight: 16 },

  section: { marginBottom: 8 },
  sectionLabel: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 16,
  },
  row: { flexDirection: 'row' },

  field:         { flex: 1 },
  fieldLabel:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  fieldLabelText: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },

  input: {
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    padding: 12,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 16,
    marginBottom: 20,
  },
  toggleLabel: { color: C.text, fontSize: 14, fontWeight: '600' },
  toggleSub:   { color: C.sub, fontSize: 11, marginTop: 2 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnDisabled: { backgroundColor: C.card, shadowOpacity: 0 },
  submitBtnText: { color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },

  // Success screen
  successView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successOrb: {
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: { color: C.text, fontSize: 20, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  successSub:   { color: C.sub, fontSize: 13, textAlign: 'center' },
  successUrl:   { color: C.accent, fontSize: 13, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  successYt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a0000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  successYtText: { color: C.red, fontSize: 12, fontWeight: '600' },
  successBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successBtnText: { color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  successBtnSecondary: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  successBtnSecondaryText: { color: C.sub, fontSize: 14, fontWeight: '600' },
});

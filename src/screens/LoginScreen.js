import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { login, signup, resendConfirmationEmail } from '../services/auth';

export default function LoginScreen({ onLogin }) {
  const [mode, setMode]                   = useState('signin'); // 'signin' | 'signup' | 'confirm'
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [confirmCode, setConfirmCode]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [showPass, setShowPass]           = useState(false);
  const [confirmEmail, setConfirmEmail]   = useState(''); // Email awaiting confirmation

  // ── Sign In ──────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      onLogin();
    } catch (err) {
      Alert.alert('Sign In Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ──────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!email.trim() || !password || !displayName.trim()) {
      Alert.alert('Required Fields', 'Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email.trim().toLowerCase(), password, displayName.trim());

      if (result.requiresEmailConfirmation) {
        // Requires email verification
        setConfirmEmail(email.trim().toLowerCase());
        setMode('confirm');
        Alert.alert(
          'Confirm Your Email',
          `A confirmation link has been sent to ${email}. Click the link in your email to verify your account.`
        );
      } else {
        // Auto-logged in
        onLogin();
      }
    } catch (err) {
      Alert.alert('Sign Up Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend Confirmation Email ────────────────────────────────────────
  const handleResendConfirmation = async () => {
    if (!confirmEmail) {
      Alert.alert('Error', 'No email to resend confirmation to.');
      return;
    }

    setLoading(true);
    try {
      await resendConfirmationEmail(confirmEmail);
      Alert.alert('Email Sent', `Confirmation email resent to ${confirmEmail}`);
    } catch (err) {
      Alert.alert('Resend Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Ionicons name="fish" size={36} color="#00d4aa" />
            <Text style={styles.logoText}>Ocean Sentinel</Text>
          </View>
          <Text style={styles.tagline}>Fish Identification & Tracking</Text>

          {mode !== 'confirm' ? (
            // ── Sign In / Sign Up Form ──────────────────────────────────────
            <View style={styles.card}>
              <Text style={styles.heading}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
              <Text style={styles.sub}>
                {mode === 'signin' ? 'Use your account to start tracking' : 'Register your account'}
              </Text>

              {/* Display Name (Sign Up only) */}
              {mode === 'signup' && (
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color="#4a7fa8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Display name"
                    placeholderTextColor="#4a7fa8"
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Email */}
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#4a7fa8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor="#4a7fa8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* Password */}
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#4a7fa8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signin' ? 'Password' : 'Password (min 8 chars)'}
                  placeholderTextColor="#4a7fa8"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#4a7fa8" />
                </TouchableOpacity>
              </View>

              {/* Main Button */}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={mode === 'signin' ? handleSignIn : handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0a1628" size="small" />
                ) : (
                  <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
                )}
              </TouchableOpacity>

              {/* Toggle Mode */}
              <Text style={styles.togglePrompt}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <Text
                  style={styles.toggleLink}
                  onPress={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setEmail('');
                    setPassword('');
                    setDisplayName('');
                  }}
                >
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </View>
          ) : (
            // ── Email Confirmation Form ──────────────────────────────────────
            <View style={styles.card}>
              <View style={styles.confirmHeader}>
                <Ionicons name="mail-unread-outline" size={48} color="#00d4aa" />
              </View>
              <Text style={styles.heading}>Check Your Email</Text>
              <Text style={styles.sub}>
                We sent a confirmation link to:
              </Text>
              <Text style={styles.confirmEmailDisplay}>{confirmEmail}</Text>

              {/* Instructions */}
              <View style={styles.instructions}>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNum}>1</Text>
                  <Text style={styles.instructionText}>Open the email from Ocean Sentinel</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNum}>2</Text>
                  <Text style={styles.instructionText}>Click the confirmation link</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNum}>3</Text>
                  <Text style={styles.instructionText}>Return to this screen to sign in</Text>
                </View>
              </View>

              {/* Resend Button */}
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, loading && styles.btnDisabled]}
                onPress={handleResendConfirmation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#00d4aa" size="small" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={16} color="#00d4aa" style={{ marginRight: 8 }} />
                    <Text style={styles.btnSecondaryText}>Resend Email</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Back to Sign In */}
              <TouchableOpacity
                onPress={() => {
                  setMode('signin');
                  setEmail('');
                  setPassword('');
                  setConfirmCode('');
                  setConfirmEmail('');
                }}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back-outline" size={16} color="#00d4aa" style={{ marginRight: 6 }} />
                <Text style={styles.backBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0a1628' },
  inner:         { flex: 1, padding: 0 },
  scroll:        { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16 },

  logoRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 },
  logoText:      { color: '#e8f4fd', fontSize: 28, fontWeight: '800' },
  tagline:       { color: '#8ab4d4', fontSize: 13, textAlign: 'center', marginBottom: 36 },

  card: {
    backgroundColor: '#0f2044',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#142954',
  },
  heading:       { color: '#e8f4fd', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub:           { color: '#8ab4d4', fontSize: 13, marginBottom: 24 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#142954',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a6e',
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52,
  },
  inputIcon:     { marginRight: 10 },
  input:         { flex: 1, color: '#e8f4fd', fontSize: 15 },
  eyeBtn:        { padding: 4 },

  btn: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    flexDirection: 'row',
  },
  btnDisabled:   { backgroundColor: '#00937a' },
  btnText:       { color: '#0a1628', fontSize: 16, fontWeight: '800' },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00d4aa',
    marginTop: 14,
  },
  btnSecondaryText: { color: '#00d4aa', fontSize: 16, fontWeight: '700' },

  togglePrompt:  { color: '#8ab4d4', fontSize: 13, textAlign: 'center', marginTop: 18 },
  toggleLink:    { color: '#00d4aa', fontWeight: '700' },

  // Email confirmation screen styles
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  confirmEmailDisplay: {
    color: '#00d4aa',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 28,
    backgroundColor: '#142954',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3a6e',
  },

  instructions: {
    marginBottom: 24,
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionNum: {
    color: '#00d4aa',
    fontSize: 16,
    fontWeight: '800',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00d4aa',
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionText: {
    color: '#e8f4fd',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  backBtnText: {
    color: '#00d4aa',
    fontSize: 14,
    fontWeight: '600',
  },
});

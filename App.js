import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { isLoggedIn, logout } from './src/services/auth';

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authDebug, setAuthDebug] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await isLoggedIn();
        if (mounted) {
          setLoggedIn(ok);
          setAuthDebug(ok ? 'Token valid — signed in' : 'No session — showing login');
        }
      } catch (err) {
        console.warn('[App] Auth check failed:', err.message);
        if (mounted) setAuthDebug('Error: ' + err.message);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleForceLogout = async () => {
    await logout();
    setLoggedIn(false);
    setAuthDebug('Signed out');
  };

  if (checkingAuth) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#00d4aa" size="large" />
        <Text style={styles.splashText}>Ocean Sentinel</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          {loggedIn ? (
            <AppNavigator onLogout={handleForceLogout} />
          ) : (
            <LoginScreen onLogin={() => setLoggedIn(true)} />
          )}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0a1628',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    color: '#e8f4fd',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 1,
  },
});

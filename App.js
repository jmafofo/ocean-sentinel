import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { isLoggedIn, logout } from './src/services/auth';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  unregisterPushNotificationsAsync,
} from './src/services/pushNotifications';

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  // Check auth on launch + register for push notifications
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await isLoggedIn();
        if (mounted) setLoggedIn(ok);
      } catch (err) {
        console.warn('[App] Auth check failed:', err.message);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    })();

    // Register for push notifications (works even if not logged in)
    registerForPushNotificationsAsync().catch(console.error);

    // Listen for notifications while app is in foreground
    const notificationListener = addNotificationReceivedListener(notification => {
      console.log('[Push] Received:', notification);
    });

    // Listen for notification taps
    const responseListener = addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('[Push] Tapped:', data);
      // TODO: navigate to relevant screen based on data.link
    });

    return () => {
      mounted = false;
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Re-register push token after login (so backend knows which user owns the token)
  useEffect(() => {
    if (loggedIn) {
      registerForPushNotificationsAsync().catch(console.error);
    }
  }, [loggedIn]);

  const handleForceLogout = async () => {
    await unregisterPushNotificationsAsync();
    await logout();
    setLoggedIn(false);
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

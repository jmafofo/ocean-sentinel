import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import { getToken } from './auth';

const PUSH_TOKEN_STORAGE_KEY = '@ocean_sentinel_push_token';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request permission and register for push notifications.
 * Returns the Expo push token or null.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00d4aa',
      sound: 'default',
    });
  }

  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Push] Notification permission denied');
    return null;
  }

  // Get Expo push token
  const pushTokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '5e87df30-69c5-47d9-810e-f694f8008198', // from app.json extra.eas.projectId
  });
  token = pushTokenData.data;

  // Save locally
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

  // Register with backend
  await registerTokenWithBackend(token);

  return token;
}

async function registerTokenWithBackend(expoPushToken) {
  try {
    const authToken = await getToken();
    const res = await fetch(`${API_BASE}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        expoPushToken,
        platform: Platform.OS,
      }),
    });
    if (!res.ok) {
      console.error('[Push] Failed to register token with backend:', res.status);
    }
  } catch (err) {
    console.error('[Push] Error registering token:', err.message);
  }
}

/**
 * Unregister push token (on logout or when user disables notifications)
 */
export async function unregisterPushNotificationsAsync() {
  try {
    const authToken = await getToken();
    await fetch(`${API_BASE}/api/push/register`, {
      method: 'DELETE',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error('[Push] Error unregistering token:', err.message);
  }
}

/**
 * Listen for incoming notifications while app is running.
 * Returns a subscription that should be unsubscribed on cleanup.
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Listen for notification responses (user tapped a notification).
 * Returns a subscription that should be unsubscribed on cleanup.
 */
export function addNotificationResponseReceivedListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Set the app badge count
 */
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

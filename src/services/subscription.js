/**
 * Subscription Service
 *
 * Checks whether the logged-in user has an active Ocean Sentinel premium
 * subscription (ocean_sentinel_premium = true on their profile).
 *
 * The result is cached in AsyncStorage for 1 hour to avoid hammering the
 * server on every screen mount.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import { getToken } from './auth';

const PREMIUM_CACHE_KEY  = 'ocean_sentinel_premium';
const PREMIUM_CACHE_TTL  = 60 * 60 * 1000; // 1 hour in ms

/**
 * Returns true if the current user has an active premium subscription.
 * Falls back to false on any error (network, unauthenticated, etc.).
 */
export async function isPremium() {
  // 1. Check cache
  try {
    const cached = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
    if (cached) {
      const { value, expiresAt } = JSON.parse(cached);
      if (Date.now() < expiresAt) return value;
    }
  } catch {}

  // 2. Fetch from server
  try {
    const token = await getToken();
    if (!token) return false;

    const res = await fetch(`${API_BASE}/api/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return false;

    const data = await res.json();
    const value = data?.ocean_sentinel_premium === true;

    // Cache result
    await AsyncStorage.setItem(
      PREMIUM_CACHE_KEY,
      JSON.stringify({ value, expiresAt: Date.now() + PREMIUM_CACHE_TTL })
    );

    return value;
  } catch {
    return false;
  }
}

/**
 * Bust the premium cache (call after a successful subscription checkout).
 */
export async function clearPremiumCache() {
  await AsyncStorage.removeItem(PREMIUM_CACHE_KEY);
}

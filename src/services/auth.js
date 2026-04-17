/**
 * Auth Service
 *
 * Manages the Supabase session for the mobile app.
 * Uses the Supabase Auth REST API directly — no SDK needed.
 * The access token is stored in AsyncStorage and sent as
 * a Bearer token on every uaeangler.com API request.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON } from '../config';

const TOKEN_KEY   = 'uae_access_token';
const REFRESH_KEY = 'uae_refresh_token';
const USER_KEY    = 'uae_user';

/**
 * Sign up with email + password.
 * Sends a confirmation email that must be clicked before login is possible.
 * @returns {Promise<{ user, session }>}
 */
export async function signup(email, password, displayName) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/signup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          display_name: displayName || email.split('@')[0],
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description ?? data.message ?? 'Signup failed');
  }

  // Auto-login on successful signup (optional - depends on Supabase settings)
  if (data.session) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY,   data.session.access_token],
      [REFRESH_KEY, data.session.refresh_token],
      [USER_KEY,    JSON.stringify(data.user)],
    ]);
  }

  return {
    user: data.user,
    session: data.session,
    requiresEmailConfirmation: !data.session,
  };
}

/**
 * Verify email with OTP token sent to user's email.
 * Call this after user clicks the email confirmation link or enters OTP.
 * @returns {Promise<{ accessToken, refreshToken }>}
 */
export async function verifyEmail(email, token) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        type: 'email_change', // or 'signup' depending on email type
        token,
        email,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description ?? data.message ?? 'Email verification failed');
  }

  // Store tokens
  if (data.session) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY,   data.session.access_token],
      [REFRESH_KEY, data.session.refresh_token],
      [USER_KEY,    JSON.stringify(data.user)],
    ]);
  }

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Resend confirmation email to user.
 * Call this if user didn't receive the first confirmation email.
 */
export async function resendConfirmationEmail(email) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/resend`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({
        type: 'signup',
        email,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description ?? data.message ?? 'Resend failed');
  }

  return { success: true };
}

/**
 * Sign in with email + password.
 * @returns {Promise<{ user, accessToken }>}
 */
export async function login(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description ?? data.msg ?? 'Login failed');
  }

  await AsyncStorage.multiSet([
    [TOKEN_KEY,   data.access_token],
    [REFRESH_KEY, data.refresh_token],
    [USER_KEY,    JSON.stringify(data.user)],
  ]);

  return { user: data.user, accessToken: data.access_token };
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshSession() {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token stored');

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? 'Session refresh failed');

  await AsyncStorage.multiSet([
    [TOKEN_KEY,   data.access_token],
    [REFRESH_KEY, data.refresh_token],
  ]);

  return data.access_token;
}

/**
 * Sign out and clear stored credentials.
 */
export async function logout() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    // Best-effort server-side sign out
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
}

/**
 * Get the stored access token, or null if not logged in.
 */
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/**
 * Get the stored user profile, or null.
 */
export async function getUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Returns true if a token is stored (does not verify expiry).
 */
export async function isLoggedIn() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return !!token;
}

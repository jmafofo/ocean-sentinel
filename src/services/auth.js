/**
 * Auth Service
 *
 * Manages the Supabase session for the mobile app.
 * Uses the Supabase Auth REST API directly — no SDK needed.
 * The access token is stored in AsyncStorage and sent as
 * a Bearer token on every uaeangler.com API request.
 *
 * Google OAuth Flow
 * -----------------
 * Supabase rejects custom scheme redirect URLs (com.oceansentinel.app://…).
 * We work around this by using HTTPS redirect URLs that Supabase accepts,
 * then parsing tokens from the returned URL hash fragment.
 *
 *   Expo Go dev      → https://auth.expo.io/@username/slug
 *   Production build → https://uaeangler.com/auth/callback
 *
 * Required Supabase config
 *   1. Enable Google provider under Authentication → Providers
 *   2. Add redirect URLs to Authentication → URL Configuration →
 *      "Additional Redirect URLs":
 *        - https://auth.expo.io/@mafofoj/ocean-sentinel   (dev)
 *        - https://uaeangler.com/auth/callback            (prod)
 *   3. Set "Site URL" to https://uaeangler.com
 *
 * Optional: uaeangler.com /auth/callback page
 *   The production callback page can redirect to the app scheme so the
 *   OS brings the app to the foreground. The mobile code below works
 *   even without this page — it parses tokens from the HTTPS URL directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { SUPABASE_URL, SUPABASE_ANON, API_BASE } from '../config';

const TOKEN_KEY   = 'uae_access_token';
const REFRESH_KEY = 'uae_refresh_token';
const USER_KEY    = 'uae_user';

/**
 * Build the OAuth redirect URI that Supabase will accept.
 *
 * Expo Go uses the auth.expo.io proxy (HTTPS).
 * Production standalone builds use uaeangler.com so we never need a
 * custom scheme in the Supabase dashboard.
 */
function getOAuthRedirectUri() {
  // Expo Go / store client → auth.expo.io proxy (HTTPS)
  if (Constants.appOwnership === 'expo') {
    return makeRedirectUri({
      scheme: 'com.oceansentinel.app',
      path: 'auth/callback',
    });
  }

  // Standalone / bare builds → uaeangler.com callback (HTTPS)
  return `${API_BASE}/auth/callback`;
}

/**
 * Extract access_token, refresh_token and other params from a URL.
 * Supabase returns tokens in the hash fragment (#access_token=...).
 * We check both hash and query params for flexibility.
 */
function extractTokensFromUrl(url) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  let params = new URLSearchParams();

  if (hashIndex !== -1) {
    params = new URLSearchParams(url.substring(hashIndex + 1));
  } else if (queryIndex !== -1) {
    params = new URLSearchParams(url.substring(queryIndex + 1));
  }

  return {
    access_token:  params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    expires_in:    params.get('expires_in'),
    token_type:    params.get('token_type'),
    type:          params.get('type'),
  };
}

/**
 * Sign in with Google OAuth 2.0.
 *
 * 1. Opens a secure browser session pointed at Supabase's authorize endpoint.
 * 2. User authenticates with Google.
 * 3. Supabase redirects to the HTTPS callback URL.
 * 4. We parse tokens from the returned URL and store them locally.
 *
 * @returns {Promise<{ user, accessToken }>}
 */
export async function loginWithGoogle() {
  const redirectTo = getOAuthRedirectUri();

  const authUrl =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);

  if (result.type !== 'success') {
    throw new Error(
      result.type === 'cancel' ? 'Sign in cancelled' : 'Google sign in failed'
    );
  }

  const tokens = extractTokensFromUrl(result.url);

  if (!tokens.access_token) {
    throw new Error(
      'No access token received.\n\n' +
      'Make sure the redirect URL is added to Supabase:\n' +
      redirectTo
    );
  }

  // Fetch user profile
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  const user = await userRes.json();
  if (!userRes.ok) {
    throw new Error(user.message ?? 'Failed to get user info');
  }

  await AsyncStorage.multiSet([
    [TOKEN_KEY, tokens.access_token],
    [REFRESH_KEY, tokens.refresh_token ?? ''],
    [USER_KEY, JSON.stringify(user)],
  ]);

  return { user, accessToken: tokens.access_token };
}

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
 * Returns true if a valid token is stored.
 * Verifies the token with Supabase to catch stale/expired sessions.
 */
export async function isLoggedIn() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      // Token is invalid or expired — clear it
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
      return false;
    }

    return true;
  } catch {
    // Offline — assume token is valid if it exists
    return true;
  }
}

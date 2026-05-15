/**
 * App-wide configuration.
 * All API traffic goes through uaeangler.com — the mobile app is a
 * data-collection terminal for that platform. No third-party API keys
 * are bundled in the app; all AI calls (fish ID, pollution) are
 * proxied through the UAE Angler backend.
 */

export const API_BASE = 'https://uaeangler.com';

export const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
export const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON ?? '';

export const SPECIES_CACHE_KEY     = 'uae_species_cache_v1';
export const SPECIES_CACHE_VERSION = '2024-moccae-v1';

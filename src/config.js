/**
 * App-wide configuration.
 * All API traffic goes through uaeangler.com — the mobile app is a
 * data-collection terminal for that platform.
 *
 * Secrets are stored in .env (gitignored). Copy .env.example to .env
 * and fill in your keys before running the app.
 */

export const API_BASE = 'https://uaeangler.com';

export const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
export const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON ?? '';

export const SPECIES_CACHE_KEY     = 'uae_species_cache_v1';
export const SPECIES_CACHE_VERSION = '2024-moccae-v1';

export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
export const ANTHROPIC_MODEL   = 'claude-sonnet-4-6';

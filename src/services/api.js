/**
 * UAE Angler API Service
 *
 * All network calls to uaeangler.com go through here.
 * Every request automatically attaches the stored Bearer token.
 * On 401, the session is refreshed once before giving up.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, SPECIES_CACHE_KEY, SPECIES_CACHE_VERSION } from '../config';
import { getToken, refreshSession, logout } from './auth';

// ── Internal fetch wrapper ────────────────────────────────────────────────────

let _refreshing = false;

async function apiFetch(path, options = {}, retry = true) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // fetch() itself throws when there is no network connection
    console.warn(`[API] Network error on ${path}:`, networkErr.message);
    throw new Error('No internet connection. Please check your network and try again.');
  }

  // Auto-refresh on 401
  if (res.status === 401 && retry && !_refreshing) {
    try {
      _refreshing = true;
      await refreshSession();
      _refreshing = false;
      return apiFetch(path, options, false); // retry once
    } catch {
      _refreshing = false;
      await logout();
      throw new Error('SESSION_EXPIRED');
    }
  }

  return res;
}

// ── Species ───────────────────────────────────────────────────────────────────

/**
 * Fetch and cache the full UAE species catalogue.
 * Returns cached data if the version matches — so works fully offline
 * after the first successful fetch.
 */
export async function getSpecies() {
  // Try cache first
  try {
    const cached = await AsyncStorage.getItem(SPECIES_CACHE_KEY);
    if (cached) {
      const { version, species } = JSON.parse(cached);
      if (version === SPECIES_CACHE_VERSION) return species;
    }
  } catch {}

  // Fetch fresh
  const res = await apiFetch('/api/species');
  if (!res.ok) throw new Error('Could not load species list');
  const { species, version } = await res.json();

  // Cache for offline use
  try {
    await AsyncStorage.setItem(
      SPECIES_CACHE_KEY,
      JSON.stringify({ version, species })
    );
  } catch {}

  return species;
}

// ── Identification ────────────────────────────────────────────────────────────

/**
 * Identify a fish photo via the uaeangler.com API (Claude Sonnet Vision).
 * All identification traffic is routed through the server — no direct client
 * Anthropic calls — to keep API keys out of the app bundle.
 *
 * @param {string} imageUri — local file URI from camera / gallery
 * @param {{ latitude: number, longitude: number }|null} location — GPS capture location
 * @returns {Promise<Array>} — results array compatible with IdentificationScreen
 *   [{ species, confidence: number, rank: number, key_features?, lowConfidence?, unnamed_key? }]
 */
export async function identifyFish(imageUri, location = null) {
  // Resize to 1024px wide for better structural detail; higher quality preserves fin/snout edges
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const payload = {
    imageBase64: resized.base64,
    mimeType: 'image/jpeg',
    ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
  };

  // Use apiFetch so we get auto-refresh on expired tokens.
  // /api/identify accepts unauthenticated requests, but if the user is logged
  // in we send the token so the catch can be linked to their account.
  let res;
  try {
    res = await apiFetch('/api/identify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // apiFetch already throws 'SESSION_EXPIRED' after refresh fails,
    // or 'No internet connection' for network errors.
    throw err;
  }

  const data = await res.json();

  // Prefer server-provided confidence_pct; fall back to string→number mapping
  const CONFIDENCE_MAP = { high: 0.85, medium: 0.60, low: 0.25 };

  // ── Multi-candidate response (updated API) ──────────────────────
  if (data.status === 'identified' && Array.isArray(data.candidates) && data.candidates.length > 0) {
    return data.candidates.map((c, idx) => ({
      species:       normaliseSpecies(c.species),
      confidence:    c.confidence_pct ?? CONFIDENCE_MAP[c.confidence] ?? 0.25,
      rank:          idx + 1,
      key_features:  c.key_features ?? null,
      reasoning:     c.reasoning ?? null,
      locationContext: data.location_context ?? null,
      imageQuality:  data.image_quality ?? null,
    }));
  }

  // ── Single-candidate fallback (older API or edge case) ──────────
  if (data.status === 'identified' && data.species) {
    const confidenceNum = data.confidence_pct ?? CONFIDENCE_MAP[data.confidence] ?? 0.25;
    return [{ species: normaliseSpecies(data.species), confidence: confidenceNum, rank: 1 }];
  }

  // ── Unnamed — no match in UAE database ─────────────────────────
  const confidenceNum = data.confidence_pct ?? CONFIDENCE_MAP[data.confidence] ?? 0.25;
  const unnamedSpecies = {
    id:                 data.unnamed_key,
    name:               'Unidentified Species',
    scientificName:     'Species incertae sedis',
    description:        data.reasoning ?? 'This species was not found in the UAE database and will be queued for expert review.',
    conservationStatus: 'Not Evaluated',
    dangerLevel:        'none',
    edibility:          'Unknown',
    habitat:            'Unknown',
    unnamed_key:        data.unnamed_key,
  };

  return [{
    species:        unnamedSpecies,
    confidence:     confidenceNum,
    rank:           1,
    lowConfidence:  true,
    unnamed_key:    data.unnamed_key,
    locationContext: data.location_context ?? null,
  }];
}

/**
 * Normalise the website's species shape to what the mobile UI expects.
 * Both have id, name, scientificName — this fills any gaps.
 */
function normaliseSpecies(s) {
  return {
    id:                 s.id ?? s.slug,
    name:               s.name,
    scientificName:     s.scientificName,
    localName:          s.localName ?? '',
    description:        s.description ?? '',
    habitat:            s.habitat ?? '',
    conservationStatus: s.conservationStatus ?? 'Not Evaluated',
    dangerLevel:        s.dangerLevel ?? 'none',
    edibility:          s.edibility ?? 'Unknown',
    maxSizeCm:          s.maxSizeCm,
    maxWeightKg:        s.maxWeightKg,
    coast:              s.coast,
    regions:            s.regions ?? [],
  };
}

// ── Catches ───────────────────────────────────────────────────────────────────

/**
 * Submit a catch record to uaeangler.com.
 */
export async function submitCatch(catchData) {
  const res = await apiFetch('/api/catches', {
    method: 'POST',
    // Preserve caller-supplied source (e.g. 'ocean_sentinel'), fall back to 'app'
    body: JSON.stringify({ source: 'app', ...catchData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to submit catch');
  }
  return res.json();
}

/**
 * Fetch the user's catch history from uaeangler.com.
 */
export async function fetchCatches({ limit = 50, offset = 0, status } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set('status', status);
  const res = await apiFetch(`/api/catches?${params}`);
  if (!res.ok) throw new Error('Failed to fetch catches');
  return res.json();
}

/**
 * Update a catch (e.g. curate an unnamed entry).
 */
export async function updateCatch(id, updates) {
  const res = await apiFetch(`/api/catches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update catch');
  }
  return res.json();
}

// ── Community sightings map ───────────────────────────────────────────────────

/**
 * Fetch public community sightings for the map screen.
 * @param {{ bbox?: string, species?: string, since?: string, limit?: number }} opts
 */
export async function fetchCommunitySightings({ bbox, species, since, limit = 500 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (bbox)    params.set('bbox', bbox);
  if (species) params.set('species', species);
  if (since)   params.set('since', since);

  // Public endpoint — no auth needed, but include token if present for future use
  const res = await apiFetch(`/api/sightings/map?${params}`);
  if (!res.ok) throw new Error('Failed to fetch community sightings');
  return res.json(); // { sightings: [...], count: number }
}

// ── RFID ──────────────────────────────────────────────────────────────────────

/**
 * Look up a scanned RFID tag.
 * @param {string} rfidTag
 */
export async function lookupRFID(rfidTag) {
  const res = await apiFetch('/api/rfid/lookup', {
    method: 'POST',
    body: JSON.stringify({ rfid_tag: rfidTag }),
  });
  if (!res.ok) throw new Error('RFID lookup failed');
  return res.json();
}

/**
 * Register a new RFID tag.
 */
export async function registerRFID({ rfidTag, species, scientificName, firstCatchId, notes }) {
  const res = await apiFetch('/api/rfid/register', {
    method: 'POST',
    body: JSON.stringify({
      rfid_tag:        rfidTag,
      species,
      scientific_name: scientificName,
      first_catch_id:  firstCatchId,
      notes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'RFID registration failed');
  }
  return res.json();
}

/**
 * UAE Angler API Service
 *
 * All network calls to uaeangler.com go through here.
 * Every request automatically attaches the stored Bearer token.
 * On 401, the session is refreshed once before giving up.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, SPECIES_CACHE_KEY, SPECIES_CACHE_VERSION, ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '../config';
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
 * Direct fallback: identify a fish by calling the Anthropic API from the app.
 * Used automatically when the uaeangler.com server is unavailable (502/503).
 *
 * @param {string} base64 — JPEG image already resized to 800px
 * @param {{ latitude: number, longitude: number }|null} location
 * @returns {Promise<Array>}
 */
async function identifyFishDirect(base64, location) {
  const locationHint = location
    ? `The photo was taken at coordinates ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} (UAE / Arabian Gulf region).`
    : 'Assume the fish is from UAE or Arabian Gulf waters.';

  const prompt = `You are an expert marine biologist and fish taxonomist specialising in the fish fauna of the UAE, Arabian Gulf, and Gulf of Oman. You have decades of field experience identifying fish from beach and boat photos taken by anglers in the field.

Analyse this fish image carefully and identify the species.
${locationHint}

CONTEXT — FIELD CONDITIONS:
This image was taken by an angler on a UAE beach. The fish may be:
- Freshly landed and still alive, flapping on wet sand
- Coated in wet sand, mud, or algae from thrashing
- Partially buried or lying awkwardly
- Photographed quickly at an odd angle
This means colour, scale pattern, and surface markings are COMPLETELY UNRELIABLE. Ignore them entirely. You must identify from structure alone.

STEP 1 — OBSERVE STRUCTURE FIRST:
- Snout profile: blunt & short vs long & pointed
- Mouth position: terminal/inferior, size, protractile or not
- Body depth-to-length ratio: deep/oval vs elongated/fusiform
- Dorsal fin: single continuous or notched, count of spines visible
- Tail shape: forked, lunate, truncate, or rounded
- Scale size: large & visible vs small & fine
- Preopercle edge: smooth or serrated
- Head profile: steep vs gradual slope

STEP 2 — APPLY THESE TAXONOMIC KEYS FOR UAE SPECIES:

SNOUT SHORT & BLUNT + SMALL MOUTH → likely Haemulidae (Grunters):
  • Silver Grunter (Pomadasys argenteus): deep oval body, blunt snout, small inferior mouth, large silvery scales, faint lateral stripes, XII dorsal spines, smooth preopercle, slightly forked tail. Very common UAE beach find.
  • Javelin Grunter (Pomadasys kaakan): similar but more elongated, dark spots on body.

SNOUT LONG & POINTED + LARGE MOUTH → likely Lethrinidae (Emperors):
  • Spangled Emperor (Lethrinus nebulosus): long pointed snout, large mouth, cheek partly scaleless, olive-grey with pale spots.
  • Pink Ear Emperor (Lethrinus lentjan): pink/red tinge on cheek, pointed snout.

DEEP BODY + INCISOR-LIKE TEETH VISIBLE → likely Sparidae (Breams):
  • Yellowfin Seabream (Acanthopagrus latus): deep compressed body, yellow fins, small mouth.
  • Goldlined Seabream (Rhabdosargus sarba): golden lateral stripes, deep body.
  • Sobaity (Sparidentex hasta): deep body, silvery, pointed snout for a bream.

ELONGATED + LARGE SCALES + THICK LIPS → likely Mugilidae (Mullets).
ELONGATED + FORKED TAIL + LATERAL LINE CURVES DOWN → likely Carangidae (Trevally/Queenfish).
VERY DEEP BODY + SMALL MOUTH + RABBIT-LIKE FACE → likely Siganidae (Rabbitfish/Safi).
LARGE MOUTH + MOTTLED PATTERN + ROUNDED TAIL → likely Serranidae (Grouper/Hamour).

STEP 3 — RANK your top 5 candidates by structural fit, not colour.

Return ONLY valid JSON — no markdown, no commentary:
{
  "status": "identified",
  "candidates": [
    {
      "species": {
        "id": "kebab-case-common-name",
        "name": "Common English Name",
        "scientificName": "Genus species",
        "localName": "Arabic or local name if known, otherwise empty string",
        "description": "One or two sentences about the species.",
        "habitat": "Habitat description",
        "conservationStatus": "LC | NT | VU | EN | CR | Not Evaluated",
        "dangerLevel": "none | mild | moderate | dangerous",
        "edibility": "Excellent | Good | Fair | Poor | Unknown"
      },
      "confidence_pct": 0.85,
      "key_features": ["specific structural feature observed", "fin or mouth detail", "body shape detail"],
      "reasoning": "State the snout shape, mouth size, body depth, and fin structure you observed, then explain which family and species that points to"
    }
  ]
}

Always return at least one candidate. Never let colour alone determine your top pick.`;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
  } catch (networkErr) {
    console.warn('[API] Direct Anthropic call network error:', networkErr.message);
    throw new Error('No internet connection. Please check your network and try again.');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.warn(`[API] Direct Anthropic call failed — HTTP ${res.status}:`, errBody);
    throw new Error(`Identification service unavailable (HTTP ${res.status}). Please try again.`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text ?? '';

  let parsed;
  try {
    // Strip any accidental markdown fences before parsing
    const clean = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch (parseErr) {
    console.warn('[API] Failed to parse direct Anthropic response:', rawText);
    throw new Error('Could not parse identification result. Please try again.');
  }

  if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
    return parsed.candidates.map((c, idx) => ({
      species:      normaliseSpecies(c.species),
      confidence:   c.confidence_pct ?? 0.25,
      rank:         idx + 1,
      key_features: c.key_features ?? null,
      reasoning:    c.reasoning ?? null,
    }));
  }

  throw new Error('No identification results returned. Please try a clearer photo.');
}

/**
 * Identify a fish photo via the uaeangler.com API (Claude Sonnet Vision).
 * Falls back to a direct Anthropic API call on 502 / 503.
 *
 * @param {string} imageUri — local file URI from camera / gallery
 * @param {{ latitude: number, longitude: number }|null} location — GPS capture location
 * @returns {Promise<Array>} — results array compatible with IdentificationScreen
 *   [{ species, confidence: number, rank: number, key_features?, lowConfidence?, unnamed_key? }]
 */
export async function identifyFish(imageUri, location = null) {
  // Resize to 800px wide (~150KB) before upload
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 800 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const payload = {
    imageBase64: resized.base64,
    mimeType: 'image/jpeg',
    ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
  };

  const res = await apiFetch('/api/identify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error ?? `Identification failed (HTTP ${res.status})`;
    console.warn(`[API] identifyFish server failed — HTTP ${res.status}:`, msg, '— trying direct fallback');

    // Fall back to direct Anthropic call on gateway/server errors
    if (res.status === 502 || res.status === 503 || res.status === 504 || res.status >= 500) {
      return identifyFishDirect(resized.base64, location);
    }

    throw new Error(msg);
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

// ── Image quality assessment ──────────────────────────────────────────────────

/**
 * Quickly assess whether a captured image is good enough for fish identification.
 * Returns null if the check cannot be completed (non-fatal).
 *
 * @param {string} base64 — small JPEG (400px wide) already resized by the caller
 * @returns {Promise<{ suitable: boolean, issues: string[], tip: string }|null>}
 */
export async function assessImageQuality(base64) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: `Assess this beach fish photo for automated species ID quality.
Check: 1) Is a fish the main subject? 2) Is it heavily coated in sand/mud/algae obscuring body shape? 3) Is it blurry or out of focus? 4) Can the snout, fins, and body outline be made out?
Be lenient — field photos are never perfect. Only flag genuine problems that will hurt ID accuracy.
Return ONLY JSON: {"suitable":true,"issues":[],"tip":""}
or: {"suitable":false,"issues":["Sand covering body outline","Out of focus"],"tip":"Rinse sand off briefly and hold phone steady"}` },
          ],
        }],
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '';
  try {
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
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
    body: JSON.stringify({ ...catchData, source: 'app' }),
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

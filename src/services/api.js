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

  const prompt = `You are an expert marine biologist and fish taxonomist specialising in the fish fauna of the UAE, Arabian Gulf, and Gulf of Oman. You have decades of field experience identifying fish from angler beach photos where fish are wet, sandy, and muddy.

Analyse this fish image and identify the species.
${locationHint}

━━━ CRITICAL FIELD CONTEXT ━━━
UAE beach fishing photos are taken immediately after landing. The fish is typically:
• Alive and thrashing on wet sand — coated in a layer of sand, mud, or algae
• Lying at an awkward angle; may be partially buried
• Shot quickly in harsh sunlight or shade with a phone camera

CONSEQUENCE: Colour, scale pattern, lateral stripe colour, and fin colour are COMPLETELY UNRELIABLE and must be IGNORED. You MUST identify from body structure and geometry alone.

━━━ STEP 0 — TRIAGE VISIBILITY ━━━
Before classifying, note which parts of the fish you can actually resolve through the dirt/sand:
• CLEAR: body outline/silhouette, caudal fin shape, mouth shape, snout profile, eye position
• OFTEN VISIBLE: dorsal fin count and general shape, pectoral fin length, head profile
• UNRELIABLE WHEN DIRTY: scale pattern, fin colour, lateral stripe colour, belly markings
Only use features you can genuinely resolve.

━━━ STEP 1 — MEASURE THE SILHOUETTE ━━━
The body outline is visible even through heavy mud. Estimate these ratios:

BODY DEPTH / STANDARD LENGTH (depth at deepest point ÷ total length, excluding tail):
  • > 0.45 → very deep / disc-shaped (Sparidae, Siganidae, deep Carangidae)
  • 0.30–0.45 → moderately deep (Haemulidae, Lethrinidae, Serranidae/Grouper)
  • 0.15–0.30 → elongated / fusiform (Mugilidae, Carangidae, Scombridae, Lutjanidae)
  • < 0.15 → very elongated / eel-like (Sphyraenidae/Barracuda, Trichiuridae/Ribbonfish)

HEAD LENGTH / STANDARD LENGTH:
  • > 0.33 → large head (Serranidae, Platycephalidae, some Carangidae)
  • 0.25–0.33 → normal (most reef fish)
  • < 0.25 → small head (Mugilidae, Siganidae)

CAUDAL PEDUNCLE: slender & keeled vs thick & muscular (muscular = fast pelagic species)

DORSAL HUMP POSITION: is the highest point of the back near the head, middle, or uniform?

━━━ STEP 2 — DIRT-RESISTANT STRUCTURAL FEATURES ━━━
Even on a sand-caked fish, observe:
• Snout: blunt & rounded vs pointed & conical vs depressed/flat
• Mouth: terminal / inferior / superior; protractile or fixed; size relative to head
• Eye: size (large vs small) and position (high on head vs mid-lateral vs lower)
• Dorsal fin: one continuous fin vs clearly two separate fins; notched or smooth junction
• Caudal fin shape: deeply forked / lunate / emarginate / truncate / rounded — often mud-free
• Lateral line path: curves sharply downward mid-body (Carangidae), runs straight, or arched
• Pectoral fin: short & rounded vs long & pointed (length relative to body depth)
• Preopercle/cheek edge: smooth vs serrated (check under any dirt at angle)
• Body cross-section: strongly compressed (laterally flat) vs rounded / tubular

━━━ STEP 3 — UAE TAXONOMIC KEYS (structural only) ━━━

DEEP BODY (>0.45) + SMALL MOUTH + INCISOR TEETH visible → Sparidae (Breams/Porgies):
  • Sobaity (Sparidentex hasta): deepest body of UAE breams, pointed snout, large silvery scales, single dorsal XII spines + 11 rays, slightly forked tail — the premier UAE sport bream
  • Yellowfin Seabream / Farsh (Acanthopagrus latus): very deep compressed oval body, steep head profile, small mouth, deeply forked tail
  • Goldlined Seabream / Sarba (Rhabdosargus sarba): deep oval, steep forehead, multiple golden longitudinal stripes when clean
  • Twobar Seabream / Sheri (Acanthopagrus bifasciatus): two dark vertical bars behind head visible even through light sand
  • King Soldier Bream / Nagel (Argyrops spinifer): deep body, very elongated 1st dorsal spine (often bent over), strongly forked tail

DEEP BODY (>0.40) + SMALL INFERIOR MOUTH + NO VISIBLE TEETH → Siganidae (Rabbitfish/Safi):
  • Streaked Rabbitfish (Siganus javus): deep body, small rabbit-like mouth, sharp venomous dorsal spines, handle with care
  • White-spotted Rabbitfish / Safi (Siganus canaliculatus): similar, very common UAE inshore

DEEP BODY (0.30–0.45) + BLUNT SNOUT + SMALL INFERIOR MOUTH → Haemulidae (Grunters):
  • Silver Grunter / Shaoor (Pomadasys argenteus): most common UAE beach catch; deep oval body, blunt snout, small inferior mouth, large scales, XII dorsal spines, smooth preopercle, slightly forked tail — body depth ~0.38 SL
  • Javelin Grunter (Pomadasys kaakan): similar but slightly more elongated, body depth ~0.32 SL

ELONGATED-MODERATE (0.25–0.40) + LARGE TERMINAL MOUTH + LONG POINTED SNOUT → Lethrinidae (Emperors):
  • Spangled Emperor / Sha'an (Lethrinus nebulosus): moderate depth, long conical snout, large mouth, cheek scaleless, deeply forked tail — very common UAE reef/beach species
  • Pink Ear Emperor / Nageel (Lethrinus lentjan): similar, slightly deeper body, often pink flush on cheek
  • Longface Emperor (Lethrinus olivaceus): most elongated emperor, very long snout, large mouth

ELONGATED (0.20–0.35) + LARGE MOUTH + ROUNDED/TRUNCATE TAIL → Serranidae (Groupers):
  • Brown-spotted Grouper / Hamour (Epinephelus coioides): moderately elongated, large head (>0.35 SL), wide terminal mouth, rounded caudal fin, 3 oblique dark bands on head — iconic UAE target species
  • Greasy Grouper / Hammour Zafar (Epinephelus tauvina): similar, blunter head, brownish

ELONGATED (0.18–0.30) + MODERATELY LARGE MOUTH + FORKED TAIL + LATERAL LINE CURVES DOWN → Carangidae (Jacks):
  • Giant Trevally / Janad (Caranx ignobilis): robust fusiform, steep head profile, deeply forked tail, hard scutes on straight rear lateral line, large
  • Queenfish (Scomberoides commersonnianus): more slender, multiple dark blotches along midline even through dirt, widely forked tail
  • Golden Trevally (Gnathanodon speciosus): very distinctive — protractile rubbery lips with no teeth, golden/yellow when juvenile, deeper body than GT

VERY ELONGATED (0.10–0.18) + TAPERED + LARGE MOUTH → Scomberomorus / Scombridae (Mackerels):
  • Spanish Mackerel / Kanaad (Scomberomorus commerson): highly elongated (body depth ~0.12 SL), tapered snout, two dorsal fins, deeply forked tail, lateral line drops sharply at mid-body — prominent UAE sport fish
  • Narrow-barred Mackerel: similar, smaller

VERY ELONGATED (0.10–0.18) + BLUNT HEAD + THICK FLESHY LIPS → Mugilidae (Mullets):
  • Diamond-scale Mullet (Liza vaigiensis): robust, blunt head, fleshy lips, adipose eyelid visible
  • Gold-spot Mullet (Liza klunzingeri): UAE's most common mullet, similar shape

ELONGATED + VERY LARGE MOUTH + TWO SEPARATED DORSAL FINS → Rachycentridae / Cobia:
  • Cobia / Hamra (Rachycentron canadum): very elongated, broad depressed head, 7–9 short isolated dorsal spines before 2nd dorsal, dark lateral stripe, rounded caudal — unmistakable profile

VERY ELONGATED (<0.10) + POINTED JAW + TWO WIDELY SEPARATED DORSALS → Sphyraenidae (Barracuda):
  • Great Barracuda (Sphyraena barracuda): torpedo-shaped, two clearly separated dorsal fins, large terminal mouth with visible fang-like teeth, truncate tail

ELONGATED + POINTED SNOUT + LARGE FANG-LIKE TEETH VISIBLE → Sciaenidae (Croakers):
  • Tigertooth Croaker / Otolithes (Otolithes ruber): elongated, pointed snout, very large fang-like canine teeth clearly visible in open mouth — important UAE commercial fish

DEPRESSED/FLAT HEAD & BODY → Platycephalidae (Flatheads):
  • Indian Flathead / Oum el rooh (Platycephalus indicus): completely flat from above, ridged head, ambush predator — unmistakable silhouette

ELONGATED + SNOUT FORMS BEAK + SMALL TEETH → Belonidae (Needlefish):
  • Crocodile Needlefish (Tylosurus crocodilus): very elongated, both jaws form long beak, green bones — distinctive at a glance

━━━ STEP 4 — RANK CANDIDATES ━━━
List up to 5 candidates ranked by structural evidence quality.
For each, state:
  - Which structural features you could clearly observe
  - Which body-proportion ratio you estimated and what value
  - Why that points to this family, then this species
  - Explicit confidence: lower confidence (0.30–0.55) when fish is heavily obscured; higher (0.70–0.92) only when multiple structural features are unambiguous

Return ONLY valid JSON — no markdown, no text outside the JSON:
{
  "status": "identified",
  "candidates": [
    {
      "species": {
        "id": "kebab-case-common-name",
        "name": "Common English Name",
        "scientificName": "Genus species",
        "localName": "Arabic or local name if known, else empty string",
        "description": "One or two sentences about the species in UAE waters.",
        "habitat": "Habitat description",
        "conservationStatus": "LC | NT | VU | EN | CR | Not Evaluated",
        "dangerLevel": "none | mild | moderate | dangerous",
        "edibility": "Excellent | Good | Fair | Poor | Unknown"
      },
      "confidence_pct": 0.82,
      "key_features": [
        "Body depth ~0.38 SL — moderately deep oval",
        "Blunt rounded snout",
        "Small inferior mouth, no visible teeth",
        "Single dorsal fin, slightly notched",
        "Slightly forked caudal fin, clean of mud"
      ],
      "reasoning": "Describe which body parts were clearly visible vs obscured, then walk through the proportion estimate, snout/mouth type, and fin details, and explain exactly which family and species that combination uniquely points to in UAE waters."
    }
  ]
}

RULES:
• Never assign confidence > 0.90 unless snout, mouth, body proportions, AND caudal fin are all clearly visible and unambiguous.
• If the fish is heavily sand-caked and only the silhouette is visible, cap confidence at 0.60 and note what was obscured.
• Always return at least one candidate even if heavily obscured — note the uncertainty in reasoning.
• Never let colour alone drive the top ranking.`;

  // Guard: key must be present — if empty the build didn't embed env vars correctly
  if (!ANTHROPIC_API_KEY) {
    throw new Error('API key not configured. Please contact support.');
  }

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY.trim(),
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
    const detail = errBody?.error?.message ?? errBody?.error?.type ?? '';
    console.warn(`[API] Direct Anthropic call failed — HTTP ${res.status}:`, errBody);
    throw new Error(`Identification service unavailable (HTTP ${res.status}${detail ? ': ' + detail : ''}). Please try again.`);
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

  // Always go through the server — /api/identify accepts unauthenticated requests.
  // apiFetch attaches the Bearer token if present (for catch logging), omits it if not.
  let res;
  try {
    res = await fetch(`${API_BASE}/api/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Attach token only if available — server still processes without it
        ...(await getToken().then(t => t ? { Authorization: `Bearer ${t}` } : {})),
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.warn('[API] identifyFish network error:', networkErr.message);
    throw new Error('No internet connection. Please check your network and try again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error ?? `Identification failed (HTTP ${res.status})`;
    console.warn(`[API] identifyFish server failed — HTTP ${res.status}:`, msg);

    // Fall back to direct Anthropic call only on server/gateway errors
    if (res.status >= 500) {
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

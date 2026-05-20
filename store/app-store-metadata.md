# Ocean Sentinel — App Store Metadata

Paste this into App Store Connect once Apple Developer enrollment is approved.

---

## App Information

| Field | Value |
|-------|-------|
| **App Name** | Ocean Sentinel |
| **Subtitle** | AI Fish ID & Catch Diary |
| **Bundle ID** | com.oceansentinel.app |
| **SKU** | OCEAN-SENTINEL-001 |
| **Primary Category** | Sports |
| **Secondary Category** | Utilities |
| **Content Rights** | Does not contain third-party content |
| **Age Rating** | 4+ (no objectionable content) |

---

## Localisation — English (UK)

### Name (30 chars max)
```
Ocean Sentinel
```

### Subtitle (30 chars max)
```
AI Fish ID & Catch Diary
```

### Description (4000 chars max)
```
Ocean Sentinel is the AI-powered fishing companion built for anglers in the UAE and beyond.

Point your camera at any fish — live on the boat, on wet sand, or straight from your gallery — and Ocean Sentinel's vision AI identifies the species in seconds. No internet database needed for identification; results come back fast even on a slow connection.

KEY FEATURES

🐟 INSTANT FISH IDENTIFICATION
Photograph a fish and get the species name, scientific name, and confidence score in moments. Designed for the conditions UAE anglers actually face: fish photographed on wet sand, covered in mud and algae, under harsh midday sun. Identification is based on body structure, not colour.

📍 GPS CATCH DIARY
Every sighting is saved offline to your personal diary with GPS coordinates, timestamp, and confidence score. No account required — your data stays on your device.

🔍 SPECIES SEARCH
Browse your full sighting history, search by common or scientific name, and filter by species. Each entry shows the exact location recorded at the time of catch.

🌊 POLLUTION DETECTION
Point the camera at coastal water and Ocean Sentinel assesses pollution indicators — algal bloom, turbidity, discolouration, and floating debris — giving you an overall water quality score. Useful for reporting environmental concerns or choosing your next spot.

🧬 MOLECULAR MARKERS (Premium)
Access genetic marker data for over 150 UAE fish species — useful for researchers, advanced anglers, and tournament verification.

DESIGNED FOR UAE ANGLERS
Built around species common to UAE waters: Hamour (Grouper), Cobia, Trevally, Kingfish, Barracuda, Bream, Snapper, Emperor, and many more. The AI has been trained on fish as they actually appear when caught — not pristine aquarium specimens.

PRIVACY FIRST
Your catch photos and GPS data never leave your device unless you choose to sync. No account required to use the app. Location is only accessed while the app is open, never in the background.

PREMIUM PLAN
Unlock unlimited identifications, advanced pollution analysis, and molecular marker data. Available as an annual subscription.

---
Compatible with iPhone running iOS 16 or later.
Camera and location permissions are required for core features.
```

### Keywords (100 chars max — comma-separated, no spaces after commas)
```
fish,fishing,identifier,species,AI,angler,catch log,UAE,marine,ocean,hamour,grouper,trevally
```
> **Note:** 93 characters — within 100-char limit. Do not repeat words already in the app name or subtitle.

### Support URL
```
https://uaeangler.com/support
```
> **TODO:** Create this page on the UAE Angler website (basic contact form is fine).

### Marketing URL (optional)
```
https://uaeangler.com/ocean-sentinel
```
> **TODO:** Create a landing page.

### Privacy Policy URL (required)
```
https://uaeangler.com/privacy
```
> **TODO:** Ensure the privacy policy covers: camera, location, local SQLite storage, optional cloud sync.

---

## Version Information

### Version Number
```
1.0.0
```

### Build Number
```
1
```

### "What's New" (for v1.0 this field is not shown, but write it for future updates)
```
Initial release — AI fish identification, GPS catch diary, and pollution detection for UAE anglers.
```

---

## Screenshots Required

App Store Connect requires screenshots for each device size you support.

### Required sizes (2026)

| Device | Resolution | Notes |
|--------|------------|-------|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 px | **Required** — shown by default on all modern iPhones |
| iPhone 6.5" (14 Plus / 15 Plus) | 1284 × 2778 px | Required if not providing 6.9" |

> You need **at least 1, maximum 10** screenshots per device size.
> Suggested: 5 screenshots per size (see plan below).

### Screenshot Plan

| # | Screen shown | Caption overlay |
|---|-------------|-----------------|
| 1 | Camera screen identifying a Hamour | "Identify any fish in seconds" |
| 2 | Identification result card (species + confidence) | "AI-powered — built for UAE waters" |
| 3 | History screen with 10+ sightings and GPS dots | "Your personal catch diary" |
| 4 | Pollution detection result on coastal water | "Monitor water quality wherever you fish" |
| 5 | Profile screen with stats (catches + species count) | "Track your progress as an angler" |

> **Tool to create screenshots:** Use an iPhone simulator in Xcode, or [Rottenwood](https://rottenwood.app) / [Previewed](https://previewed.app) to add device frames + caption overlays without a physical device.

---

## App Review Information

### Sign-in Required?
No — the app works fully offline without an account.

### Notes for Apple reviewer
```
Ocean Sentinel requires camera and location permissions to function. 
To test core features:
1. Launch the app — no sign-in required
2. Tap the Camera tab and photograph any fish (or use "Upload from Gallery")
3. The AI returns a species identification within a few seconds
4. The sighting is saved to the History tab with GPS coordinates

Location is only accessed when the Camera or Pollution tabs are active — never in the background.
The app does not collect or transmit any user data without explicit opt-in.
```

### Demo Account
Not required (offline-first app).

---

## Pricing

| Tier | Price | Notes |
|------|-------|-------|
| Free download | Free | Core identification + diary |
| Premium (annual) | USD 9.99/year | Unlimited IDs + molecular markers |

> **TODO:** Create the in-app purchase in App Store Connect once enrolled:
> - Product ID: `com.oceansentinel.app.premium_annual`
> - Reference name: Ocean Sentinel Premium
> - Price: Tier 9 (USD 9.99)

---

## Post-Enrollment Checklist

Once Apple Developer Program enrollment is approved:

- [ ] Log in to [App Store Connect](https://appstoreconnect.apple.com)
- [ ] Create new app → paste metadata from this file
- [ ] Note the **Apple ID** (10-digit) → add to `eas.json` as `ascAppId`
- [ ] Go to [developer.apple.com/account](https://developer.apple.com/account) → Membership → note **Team ID** → add to `eas.json` as `appleTeamId`
- [ ] Run: `eas build --platform ios --profile production`
- [ ] Create screenshots (5 per device size — see plan above)
- [ ] Set up in-app purchase `com.oceansentinel.app.premium_annual`
- [ ] Create support page at `uaeangler.com/support`
- [ ] Submit for App Store review

---

## Commands (run from ocean-sentinel/)

```bash
# Build iOS .ipa for App Store (once ascAppId + appleTeamId are filled in eas.json)
eas build --platform ios --profile production

# Submit to App Store Connect automatically after build
eas submit --platform ios --latest

# Build + submit in one command
eas build --platform ios --profile production --auto-submit
```

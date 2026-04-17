/**
 * Pollution Detection Service
 *
 * Analyses water photos for pollution indicators using Claude Vision.
 * Replaces the previous TensorFlow-based implementation.
 *
 * Detected pollutant types:
 *   oil_sheen · turbidity · algae_bloom · plastic_debris · chemical_stain
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '../config';

const POLLUTION_TYPES = {
  oil_sheen: {
    name: 'Oil Sheen',
    description: 'Rainbow-coloured surface film indicating oil pollution',
    severity: 'high',
    color: '#FF6B35',
    icon: '⚠️',
  },
  turbidity: {
    name: 'High Turbidity',
    description: 'Cloudy water indicating sediment or pollution runoff',
    severity: 'medium',
    color: '#F7931E',
    icon: '🌫️',
  },
  algae_bloom: {
    name: 'Algae Bloom',
    description: 'Excessive algae growth, potentially toxic',
    severity: 'high',
    color: '#4CAF50',
    icon: '🌿',
  },
  plastic_debris: {
    name: 'Plastic Debris',
    description: 'Visible plastic waste in the water',
    severity: 'medium',
    color: '#2196F3',
    icon: '🗑️',
  },
  chemical_stain: {
    name: 'Chemical Staining',
    description: 'Unusual discoloration indicating chemical pollution',
    severity: 'high',
    color: '#9C27B0',
    icon: '⚗️',
  },
};

const RECOMMENDATIONS = {
  oil_sheen: {
    action: 'Report to authorities',
    description: 'Contact local environmental agency or coast guard immediately',
    urgency: 'high',
  },
  chemical_stain: {
    action: 'Avoid water contact',
    description: 'Do not swim or allow pets in the water until tested',
    urgency: 'high',
  },
  algae_bloom: {
    action: 'Monitor for toxins',
    description: 'Algae blooms can produce harmful toxins — watch for dead fish',
    urgency: 'medium',
  },
  plastic_debris: {
    action: 'Collect samples',
    description: 'Take photos and GPS coordinates for cleanup efforts',
    urgency: 'low',
  },
  turbidity: {
    action: 'Check runoff sources',
    description: 'Look for nearby construction or agricultural runoff',
    urgency: 'medium',
  },
};

/**
 * Analyse a water image for pollution indicators via Claude Vision.
 *
 * @param {string} imageUri — local file URI from camera / gallery
 * @returns {Promise<{detected, overallScore, pollutants, recommendations, timestamp}>}
 */
export async function analyzePollution(imageUri) {
  // Resize to 800px before upload
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 800 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const prompt = `You are an environmental scientist specialising in marine water-quality assessment.

Analyse this water photo for signs of pollution. The image may show coastal water, a beach, a harbour, or open sea in the UAE / Arabian Gulf region.

Check for each of the following:
1. OIL_SHEEN — rainbow or iridescent film on the water surface
2. TURBIDITY — unusually cloudy, murky, or sediment-laden water
3. ALGAE_BLOOM — green, blue-green, or red discoloration from algae
4. PLASTIC_DEBRIS — visible plastic bags, bottles, foam, or other waste
5. CHEMICAL_STAIN — unnatural colour (orange, purple, black) suggesting chemical discharge

For each type, assess:
- detected: true/false
- confidence: 0.0–1.0 (how certain you are)
- evidence: brief description of what you saw

Return ONLY valid JSON — no markdown, no commentary:
{
  "pollutants": [
    { "type": "oil_sheen",       "detected": false, "confidence": 0.0, "evidence": "" },
    { "type": "turbidity",       "detected": false, "confidence": 0.0, "evidence": "" },
    { "type": "algae_bloom",     "detected": false, "confidence": 0.0, "evidence": "" },
    { "type": "plastic_debris",  "detected": false, "confidence": 0.0, "evidence": "" },
    { "type": "chemical_stain",  "detected": false, "confidence": 0.0, "evidence": "" }
  ],
  "overall_assessment": "Brief 1–2 sentence summary of the water quality."
}`;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: resized.base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
  } catch (networkErr) {
    throw new Error('No internet connection. Cannot analyse pollution without network.');
  }

  if (!res.ok) {
    throw new Error(`Pollution analysis failed (HTTP ${res.status}). Please try again.`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text ?? '';

  let parsed;
  try {
    const clean = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not parse pollution analysis result. Please try again.');
  }

  const pollutants = (parsed.pollutants ?? [])
    .filter(p => p.detected)
    .map(p => ({
      type: p.type,
      detected: true,
      confidence: p.confidence ?? 0.5,
      evidence: p.evidence ?? '',
      ...POLLUTION_TYPES[p.type],
    }));

  const overallScore = pollutants.length > 0
    ? pollutants.reduce((sum, p) => sum + p.confidence, 0) / pollutants.length
    : 0;

  return {
    detected: pollutants.length > 0,
    overallScore,
    pollutants,
    recommendations: pollutants.map(p => RECOMMENDATIONS[p.type]).filter(Boolean),
    assessment: parsed.overall_assessment ?? '',
    timestamp: Date.now(),
  };
}

export function getPollutionSeverityColor(severity) {
  switch (severity) {
    case 'high':   return '#FF4444';
    case 'medium': return '#FFAA00';
    case 'low':    return '#44AAFF';
    default:       return '#666666';
  }
}

export function getPollutionSeverityLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

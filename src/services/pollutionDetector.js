/**
 * Pollution Detection Service
 *
 * Analyses water photos for pollution indicators via the UAE Angler backend
 * (/api/pollution). Claude Vision runs server-side so the Anthropic API key
 * is never bundled in the app.
 *
 * Detected pollutant types:
 *   oil_sheen · turbidity · algae_bloom · plastic_debris · chemical_stain
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE } from '../config';
import { getToken } from './auth';

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
 * Analyse a water image for pollution indicators.
 * Image is resized and sent to /api/pollution on UAE Angler.
 *
 * @param {string} imageUri — local file URI from camera / gallery
 * @returns {Promise<{detected, overallScore, pollutants, recommendations, assessment, timestamp}>}
 */
export async function analyzePollution(imageUri) {
  // Resize to 800px before upload
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 800 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE}/api/pollution`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageBase64: resized.base64,
        mimeType: 'image/jpeg',
      }),
    });
  } catch {
    throw new Error('No internet connection. Cannot analyse pollution without network.');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Pollution analysis failed (HTTP ${res.status})`);
  }

  const data = await res.json();

  // Merge backend pollutant data with local display metadata
  const pollutants = (data.pollutants ?? []).map(p => ({
    ...p,
    ...POLLUTION_TYPES[p.type],
  }));

  return {
    detected:        data.detected ?? pollutants.length > 0,
    overallScore:    data.overallScore ?? 0,
    pollutants,
    recommendations: pollutants.map(p => RECOMMENDATIONS[p.type]).filter(Boolean),
    assessment:      data.assessment ?? '',
    timestamp:       Date.now(),
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

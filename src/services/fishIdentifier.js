/**
 * Fish Identifier Service
 *
 * Thin wrapper around the UAE Angler API service.
 * All identification is handled server-side via Claude Vision.
 * The stub functions (initTensorFlow, loadModel, isModelLoaded) are kept
 * for backwards compatibility so App.js and other callers don't need changes.
 */

import { identifyFish as apiIdentifyFish } from './api';

export async function initTensorFlow() {
  // No-op: replaced by cloud API, no local model to initialise
}

export async function loadModel() {
  // No-op: kept for API compatibility
}

export function isModelLoaded() {
  return true;
}

/**
 * Identify a fish image. Delegates to the UAE Angler API (Claude Vision).
 *
 * @param {string} imageUri
 * @param {{ latitude: number, longitude: number }|null} location
 * @returns {Promise<Array>}
 */
export async function identifyFish(imageUri, location = null) {
  return apiIdentifyFish(imageUri, location);
}

export function getConfidenceLabel(confidence) {
  if (confidence >= 0.80) return 'Very High';
  if (confidence >= 0.60) return 'High';
  if (confidence >= 0.40) return 'Moderate';
  if (confidence >= 0.20) return 'Low';
  return 'Very Low';
}

export function getConfidenceColor(confidence) {
  if (confidence >= 0.80) return '#00d4aa';
  if (confidence >= 0.60) return '#4fc3f7';
  if (confidence >= 0.40) return '#ffb74d';
  return '#ff8a65';
}

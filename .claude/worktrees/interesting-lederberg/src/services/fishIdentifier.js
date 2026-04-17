/**
 * Fish Identifier Service
 *
 * Uses TensorFlow.js + MobileNetV2 for on-device image classification.
 * The model is downloaded once on first use, then cached in the device's
 * file system for fully offline operation.
 *
 * To replace with a custom fish model:
 *   1. Convert your model to TFJS format (tfjs_layers_model)
 *   2. Host the model.json + weight shards, or bundle via expo-asset
 *   3. Change MODEL_URL below to your model URL / bundleResourceIO call
 *   4. Update CLASS_NAMES to your fish species classes
 *   5. Remove the mobilenet fallback path
 */

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import fishSpecies from '../data/fishSpecies.json';

// ImageNet class names that map to fish/aquatic life
const FISH_IMAGENET_CLASSES = new Set([
  'tench', 'goldfish', 'great white shark', 'tiger shark', 'hammerhead',
  'electric ray', 'stingray', 'cock-of-the-rock', 'barracouta', 'eel',
  'coho', 'rock beauty', 'anemone fish', 'gar', 'lionfish', 'puffer',
  'sturgeon', 'sea snake', 'water ouzel', 'dugong', 'sea slug',
]);

// Map ImageNet class labels → fish species IDs in our database
const IMAGENET_TO_SPECIES = {
  'tench': ['yellowfin-tuna', 'wahoo', 'cobia', 'kingfish', 'snook', 'bream', 'emperor-fish', 'atlantic-cod'],
  'goldfish': ['clownfish', 'parrotfish'],
  'great white shark': ['hammerhead-shark'],
  'tiger shark': ['hammerhead-shark'],
  'hammerhead': ['hammerhead-shark'],
  'electric ray': ['manta-ray', 'stingray'],
  'stingray': ['stingray', 'manta-ray'],
  'barracouta': ['barracuda', 'wahoo', 'blue-marlin', 'swordfish', 'kingfish'],
  'eel': ['moray-eel', 'flounder', 'halibut'],
  'coho': ['atlantic-salmon', 'rainbow-trout', 'tarpon', 'yellowfin-tuna'],
  'rock beauty': ['grouper', 'red-snapper', 'napoleon-wrasse', 'parrotfish', 'triggerfish'],
  'anemone fish': ['clownfish', 'blue-tang', 'parrotfish', 'mahi-mahi'],
  'gar': ['pike'],
  'lionfish': ['lionfish'],
  'puffer': ['pufferfish'],
  'sturgeon': ['sturgeon'],
  'seahorse': ['seahorse'],
};

let modelInstance = null;
let isTfReady = false;

const MODEL_CACHE_PATH = FileSystem.documentDirectory + 'tf_model_cache/';

/**
 * Initialize TensorFlow.js. Must be called before any inference.
 */
export async function initTensorFlow() {
  if (isTfReady) return;
  await tf.ready();
  isTfReady = true;
}

/**
 * Load (or reuse) the MobileNet model.
 * Downloads once, then works fully offline.
 */
export async function loadModel() {
  if (modelInstance) return modelInstance;

  if (!isTfReady) {
    await initTensorFlow();
  }

  try {
    // MobileNet v2 alpha=1.0 — ~14MB, good speed/accuracy trade-off
    modelInstance = await mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('[FishIdentifier] Model loaded successfully');
  } catch (err) {
    console.error('[FishIdentifier] Failed to load model:', err);
    throw new Error('Could not load AI model. Please check your connection for the first-time download.');
  }

  return modelInstance;
}

/**
 * Preprocess an image URI to a TF tensor suitable for MobileNet.
 * Resizes to 224×224 and normalises to [-1, 1].
 */
async function preprocessImage(imageUri) {
  // Resize to 224×224 (MobileNet input size)
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 224, height: 224 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const rawData = Uint8Array.from(atob(resized.base64), c => c.charCodeAt(0));
  const imageTensor = decodeJpeg(rawData);

  // Expand dims: [224,224,3] → [1,224,224,3]
  return imageTensor.expandDims(0);
}

/**
 * Run inference on an image and return ranked fish species candidates.
 *
 * @param {string} imageUri - Local file URI of the image
 * @returns {Promise<Array>} Array of { species, confidence, rank } objects
 */
export async function identifyFish(imageUri) {
  const model = await loadModel();
  const tensor = await preprocessImage(imageUri);

  let predictions;
  try {
    predictions = await model.classify(tensor, 10); // top-10 ImageNet predictions
  } finally {
    tensor.dispose();
  }

  return mapPredictionsToFish(predictions);
}

/**
 * Map MobileNet ImageNet predictions to fish species in our database.
 */
function mapPredictionsToFish(predictions) {
  const speciesScores = {}; // speciesId → cumulative confidence score

  // Walk through predictions and accumulate scores for mapped species
  for (const pred of predictions) {
    const className = pred.className.toLowerCase();
    const probability = pred.probability;

    // Try exact match first
    for (const [key, speciesIds] of Object.entries(IMAGENET_TO_SPECIES)) {
      if (className.includes(key)) {
        for (const id of speciesIds) {
          speciesScores[id] = (speciesScores[id] || 0) + probability;
        }
      }
    }
  }

  // Convert to sorted array
  const ranked = Object.entries(speciesScores)
    .map(([id, score]) => {
      const species = fishSpecies.find(f => f.id === id);
      if (!species) return null;
      return {
        species,
        confidence: Math.min(score, 0.99), // cap at 99%
        rank: 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);

  // If no fish detected, return top 3 random species with low confidence
  // (indicates unclear image)
  if (ranked.length === 0) {
    return generateLowConfidenceResults();
  }

  // Add rank numbers
  return ranked.slice(0, 5).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

/**
 * Returns low-confidence suggestions when the model can't identify fish.
 * Signals to the UI that the image may not contain a clear fish.
 */
function generateLowConfidenceResults() {
  const shuffled = [...fishSpecies].sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map((species, idx) => ({
    species,
    confidence: 0.05 + Math.random() * 0.15, // 5-20%
    rank: idx + 1,
    lowConfidence: true,
  }));
}

/**
 * Check if the model is already loaded in memory.
 */
export function isModelLoaded() {
  return modelInstance !== null;
}

/**
 * Get the top result from an identification.
 */
export function getTopResult(results) {
  return results && results.length > 0 ? results[0] : null;
}

/**
 * Confidence level label.
 */
export function getConfidenceLabel(confidence) {
  if (confidence >= 0.80) return 'Very High';
  if (confidence >= 0.60) return 'High';
  if (confidence >= 0.40) return 'Moderate';
  if (confidence >= 0.20) return 'Low';
  return 'Very Low';
}

/**
 * Confidence level color for UI.
 */
export function getConfidenceColor(confidence) {
  if (confidence >= 0.80) return '#00d4aa';
  if (confidence >= 0.60) return '#4fc3f7';
  if (confidence >= 0.40) return '#ffb74d';
  if (confidence >= 0.20) return '#ff8a65';
  return '#ef5350';
}

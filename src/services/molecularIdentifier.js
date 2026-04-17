/**
 * Molecular Identifier Service
 *
 * Identifies fish species using molecular markers: eDNA (environmental DNA),
 * SNPs (Single Nucleotide Polymorphisms), mtDNA barcodes, and microsatellites.
 *
 * This method is particularly useful for:
 * - Early life stages (larvae, eggs) where morphology is unclear
 * - Cryptic species or species complexes
 * - Degraded samples (from water samples, stomach content, etc.)
 * - Confirmation of visual identification
 */

import fishSpecies from '../data/fishSpecies.json';

// Confidence thresholds for molecular analysis
export const MOLECULAR_VERY_HIGH = 0.95;
export const MOLECULAR_HIGH = 0.85;
export const MOLECULAR_MODERATE = 0.70;
export const MOLECULAR_LOW = 0.50;

/**
 * Validate eDNA barcode format (standardized BOLD/NCBI format)
 * Typical length: 250-750 bp for COI barcodes
 */
export function validateEdnaBarcode(sequence) {
  if (!sequence || typeof sequence !== 'string') return false;
  
  // Check if only contains valid DNA bases (ATCG and degenerate codes)
  const validBases = /^[ATCGNRYWSKMBDHVatcgnrywskmbdhv]+$/;
  if (!validBases.test(sequence)) return false;
  
  // Check reasonable length (typical COI barcode is 250-750 bp)
  const len = sequence.length;
  return len >= 100 && len <= 2000;
}

/**
 * Analyze eDNA sequence and identify species
 * Uses barcode matching against known fish COI (Cytochrome Oxidase I) sequences
 * 
 * @param {string} ednaSequence - DNA sequence (COI barcode, 16S, etc.)
 * @returns {Promise<Array>} - ranked species candidates with confidence
 */
export async function identifyByEdna(ednaSequence) {
  if (!validateEdnaBarcode(ednaSequence)) {
    throw new Error('Invalid eDNA sequence format. Must be 100-2000 bp of ATCG bases.');
  }

  const normalized = ednaSequence.toUpperCase();
  const speciesMatches = {};

  // Compare against known sequences for each species
  for (const species of fishSpecies) {
    if (!species.molecularMarkers?.coiBarcode) continue;

    // Calculate sequence similarity using Hamming distance (simplified)
    const similarity = calculateSequenceSimilarity(normalized, species.molecularMarkers.coiBarcode);
    
    if (similarity > 0.75) { // Only include matches >75% similar
      speciesMatches[species.id] = {
        species,
        confidence: similarity,
        method: 'COI Barcode',
        identificationTime: new Date().toISOString(),
      };
    }
  }

  // Convert to ranked array
  const ranked = Object.values(speciesMatches)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  if (ranked.length === 0) {
    return generateUnknownSpeciesResult('eDNA barcode did not match known species');
  }

  return ranked;
}

/**
 * Identify species by SNP (Single Nucleotide Polymorphism) panel
 * SNPs are specific mutations that distinguish between species/populations
 * 
 * @param {Array} snpData - Array of { snpName, allele1, allele2 } objects
 * @returns {Promise<Array>} - ranked species candidates
 */
export async function identifyBySNP(snpData) {
  if (!Array.isArray(snpData) || snpData.length === 0) {
    throw new Error('SNP data must be a non-empty array of SNP calls');
  }

  // Validate SNP format
  for (const snp of snpData) {
    if (!snp.snpName || !snp.allele1 || !snp.allele2) {
      throw new Error('Each SNP must have snpName, allele1, and allele2');
    }
    if (!['A', 'T', 'C', 'G'].includes(snp.allele1) || !['A', 'T', 'C', 'G'].includes(snp.allele2)) {
      throw new Error('SNP alleles must be valid DNA bases (A, T, C, G)');
    }
  }

  const speciesMatches = {};

  // Compare against SNP profiles for each species
  for (const species of fishSpecies) {
    if (!species.molecularMarkers?.snpProfile) continue;

    // Calculate SNP concordance
    const concordance = calculateSnpConcordance(snpData, species.molecularMarkers.snpProfile);
    
    if (concordance.matchedSnps > 0) {
      const confidence = concordance.matchedSnps / Math.max(concordance.totalSnps, 1);
      
      if (confidence > 0.60) { // Include matches >60% concordant
        speciesMatches[species.id] = {
          species,
          confidence,
          method: 'SNP Panel',
          matchedSnps: concordance.matchedSnps,
          totalSnps: concordance.totalSnps,
          identificationTime: new Date().toISOString(),
        };
      }
    }
  }

  // Convert to ranked array
  const ranked = Object.values(speciesMatches)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  if (ranked.length === 0) {
    return generateUnknownSpeciesResult('SNP profile did not match known species');
  }

  return ranked;
}

/**
 * Identify by microsatellite genetic markers
 * Microsatellites are repetitive DNA sequences useful for population genetics
 * and distinguishing closely related species
 * 
 * @param {Object} microsatelliteData - { markerName: repeatCount, ... }
 * @returns {Promise<Array>} - ranked species candidates
 */
export async function identifyByMicrosatellite(microsatelliteData) {
  if (!microsatelliteData || typeof microsatelliteData !== 'object') {
    throw new Error('Microsatellite data must be an object with marker names and repeat counts');
  }

  const speciesMatches = {};

  for (const species of fishSpecies) {
    if (!species.molecularMarkers?.microsatellites) continue;

    // Calculate allele size matching
    const matchScore = calculateMicrosatelliteMatch(
      microsatelliteData,
      species.molecularMarkers.microsatellites
    );

    if (matchScore > 0.50) {
      speciesMatches[species.id] = {
        species,
        confidence: matchScore,
        method: 'Microsatellite Markers',
        identificationTime: new Date().toISOString(),
      };
    }
  }

  const ranked = Object.values(speciesMatches)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  if (ranked.length === 0) {
    return generateUnknownSpeciesResult('Microsatellite alleles did not match known species');
  }

  return ranked;
}

/**
 * Hybrid identification: combine results from multiple molecular methods
 * Weights results based on method reliability and confidence
 * 
 * @param {Object} results - { edna?: Array, snp?: Array, microsatellite?: Array }
 * @returns {Array} - merged and reweighted results
 */
export function hybridMolecularIdentification(results) {
  const speciesScores = {};

  // Weight factors for each method (can be tuned based on laboratory validation)
  const methodWeights = {
    'COI Barcode': 0.40,  // 40% weight — highly reliable
    'SNP Panel': 0.35,    // 35% weight — discriminatory for closely related species
    'Microsatellite Markers': 0.25, // 25% weight — useful for population data
  };

  // Process each identification method
  for (const [method, candidateList] of Object.entries(results)) {
    if (!candidateList || !Array.isArray(candidateList)) continue;

    const weight = methodWeights[method] || 0.33;

    for (const candidate of candidateList) {
      const speciesId = candidate.species.id;
      
      // Initialize if first time seeing this species
      if (!speciesScores[speciesId]) {
        speciesScores[speciesId] = {
          species: candidate.species,
          aggregateConfidence: 0,
          methodsMatched: [],
        };
      }

      // Add weighted confidence
      speciesScores[speciesId].aggregateConfidence += candidate.confidence * weight;
      speciesScores[speciesId].methodsMatched.push({
        method: candidate.method,
        confidence: candidate.confidence,
      });
    }
  }

  // Convert to ranked array
  const ranked = Object.values(speciesScores)
    .sort((a, b) => b.aggregateConfidence - a.aggregateConfidence)
    .slice(0, 5)
    .map((item, idx) => ({
      species: item.species,
      confidence: Math.min(item.aggregateConfidence, 0.99),
      rank: idx + 1,
      methodsMatched: item.methodsMatched,
      identificationMethod: 'Hybrid Molecular',
    }));

  return ranked.length > 0 ? ranked : generateUnknownSpeciesResult('No molecular matches found');
}

/**
 * Calculate sequence similarity between two DNA sequences
 * Uses Hamming distance normalized by length
 * In production, would use BLAST or similar tools
 */
export function calculateSequenceSimilarity(seq1, seq2) {
  if (seq1.length === 0 || seq2.length === 0) return 0;

  // Align sequences (simple approach — in production use MUSCLE/MAFFT)
  const maxLen = Math.max(seq1.length, seq2.length);
  let matches = 0;

  for (let i = 0; i < maxLen; i++) {
    // Allow for small insertions/deletions with a sliding window
    if (seq1[i] === seq2[i]) matches++;
    else if (i > 0 && seq1[i - 1] === seq2[i]) matches++;
    else if (i < maxLen - 1 && seq1[i + 1] === seq2[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Calculate SNP concordance between observed and reference profiles
 */
function calculateSnpConcordance(observedSnps, referenceProfile) {
  let matchedSnps = 0;
  let totalSnps = referenceProfile.length;

  for (const refSnp of referenceProfile) {
    const obsSnp = observedSnps.find(s => s.snpName === refSnp.snpName);
    
    if (obsSnp) {
      // Check if alleles match (homo- or heterozygous patterns)
      const genotype = [obsSnp.allele1, obsSnp.allele2].sort().join('');
      const refGenotype = [refSnp.allele1, refSnp.allele2].sort().join('');

      if (genotype === refGenotype) matchedSnps++;
    }
  }

  return { matchedSnps, totalSnps };
}

/**
 * Calculate microsatellite allele size matching
 */
function calculateMicrosatelliteMatch(observed, reference) {
  if (Object.keys(reference).length === 0) return 0;

  let matches = 0;
  let total = Object.keys(reference).length;

  for (const [markerName, refAlleles] of Object.entries(reference)) {
    const obsAllele = observed[markerName];

    if (obsAllele) {
      // Check if observed allele falls within expected range (±2 repeats for flexibility)
      const tolerance = 2;
      for (const refAllele of refAlleles) {
        if (Math.abs(obsAllele - refAllele) <= tolerance) {
          matches++;
          break;
        }
      }
    }
  }

  return matches / total;
}

/**
 * Generate result for unidentified species
 */
function generateUnknownSpeciesResult(reason) {
  return [{
    species: {
      id: 'unknown',
      name: 'Unknown Species',
      scientificName: 'Identification uncertain',
      family: 'Unknown',
      description: reason,
    },
    confidence: 0.0,
    rank: 1,
    identificationMethod: 'Molecular Analysis',
    lowConfidence: true,
  }];
}

/**
 * Get confidence label for molecular identification
 */
export function getMolecularConfidenceLabel(confidence) {
  if (confidence >= MOLECULAR_VERY_HIGH) return 'Very High';
  if (confidence >= MOLECULAR_HIGH) return 'High';
  if (confidence >= MOLECULAR_MODERATE) return 'Moderate';
  if (confidence >= MOLECULAR_LOW) return 'Low';
  return 'Very Low';
}

/**
 * Get confidence color for molecular identification
 */
export function getMolecularConfidenceColor(confidence) {
  if (confidence >= MOLECULAR_VERY_HIGH) return '#00d4aa'; // Teal - high confidence
  if (confidence >= MOLECULAR_HIGH) return '#4fc3f7';      // Light blue
  if (confidence >= MOLECULAR_MODERATE) return '#a1d4ff';  // Cyan
  if (confidence >= MOLECULAR_LOW) return '#ffb74d';       // Orange
  return '#ff8a65'; // Red-orange
}

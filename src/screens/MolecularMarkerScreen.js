import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  identifyByEdna,
  identifyBySNP,
  identifyByMicrosatellite,
  hybridMolecularIdentification,
  validateEdnaBarcode,
} from '../services/molecularIdentifier';

const TABS = ['eDNA', 'SNP', 'Microsatellite', 'Hybrid'];

export default function MolecularMarkerScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('eDNA');
  const [analyzing, setAnalyzing] = useState(false);
  const [ednaSequence, setEdnaSequence] = useState('');
  const [snpData, setSnpData] = useState('');
  const [microsatelliteData, setMicrosatelliteData] = useState('');
  const [results, setResults] = useState(null);

  // ── eDNA Analysis ─────────────────────────────────────────────────
  const runEdnaAnalysis = async () => {
    if (!ednaSequence.trim()) {
      Alert.alert('Input Required', 'Please paste a DNA barcode sequence (COI, 16S, etc.)');
      return;
    }

    setAnalyzing(true);
    try {
      if (!validateEdnaBarcode(ednaSequence)) {
        throw new Error('Invalid sequence format. Must be 100-2000 bp of ATCG bases.');
      }

      const analysisResults = await identifyByEdna(ednaSequence);
      setResults({
        method: 'eDNA Barcode',
        results: analysisResults,
        input: `${ednaSequence.length} bp sequence`,
      });
    } catch (err) {
      Alert.alert('eDNA Analysis Failed', err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── SNP Analysis ──────────────────────────────────────────────────
  const runSnpAnalysis = async () => {
    if (!snpData.trim()) {
      Alert.alert('Input Required', 'Please enter SNP data in JSON format');
      return;
    }

    setAnalyzing(true);
    try {
      const snpArray = JSON.parse(snpData);
      if (!Array.isArray(snpArray)) {
        throw new Error('SNP data must be a JSON array');
      }

      const analysisResults = await identifyBySNP(snpArray);
      setResults({
        method: 'SNP Panel',
        results: analysisResults,
        input: `${snpArray.length} SNPs analyzed`,
      });
    } catch (err) {
      Alert.alert('SNP Analysis Failed', err.message || 'Invalid JSON format');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Microsatellite Analysis ───────────────────────────────────────
  const runMicrosatelliteAnalysis = async () => {
    if (!microsatelliteData.trim()) {
      Alert.alert('Input Required', 'Please enter microsatellite data in JSON format');
      return;
    }

    setAnalyzing(true);
    try {
      const markerData = JSON.parse(microsatelliteData);
      if (typeof markerData !== 'object' || Array.isArray(markerData)) {
        throw new Error('Microsatellite data must be a JSON object');
      }

      const analysisResults = await identifyByMicrosatellite(markerData);
      setResults({
        method: 'Microsatellite Markers',
        results: analysisResults,
        input: `${Object.keys(markerData).length} markers`,
      });
    } catch (err) {
      Alert.alert('Microsatellite Analysis Failed', err.message || 'Invalid JSON format');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── View detailed results ─────────────────────────────────────────
  const viewDetailedResults = () => {
    if (results && results.results.length > 0) {
      navigation.navigate('Identification', {
        results: results.results,
        molecularMethod: results.method,
        molecularInput: results.input,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#00d4aa" />
          </TouchableOpacity>
          <Text style={styles.title}>Molecular Identification</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* ── Info card ────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <Ionicons name="flask-outline" size={24} color="#00d4aa" style={{ marginBottom: 8 }} />
          <Text style={styles.infoTitle}>DNA-Based Fish Identification</Text>
          <Text style={styles.infoText}>
            Identify fish species using molecular markers: eDNA barcodes, SNPs, and microsatellites.
            Useful for larvae, degraded samples, and species confirmation.
          </Text>
        </View>

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Content views ───────────────────────────────────── */}
        {activeTab === 'eDNA' && (
          <View style={styles.content}>
            <Text style={styles.label}>COI Barcode / 16S Sequence</Text>
            <Text style={styles.hint}>
              Paste a DNA sequence (100-2000 bp, ATCG only). Standard COI barcode recommended.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="ATGCCACTATTCGCCGTTATTGGT..."
              placeholderTextColor="#4a7fa8"
              value={ednaSequence}
              onChangeText={setEdnaSequence}
              multiline
              scrollEnabled
              editable={!analyzing}
              selectionColor="#00d4aa"
            />
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>
                {ednaSequence.length} bp · {ednaSequence.length > 0 ? 'Valid' : 'Enter sequence'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
              onPress={runEdnaAnalysis}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="#0a1628" size="small" />
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={18} color="#0a1628" />
                  <Text style={styles.analyzeBtnText}>Analyze Barcode</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'SNP' && (
          <View style={styles.content}>
            <Text style={styles.label}>SNP Genotypes</Text>
            <Text style={styles.hint}>
              Enter SNP calls as JSON array: [{"{ snpName: 'SNP_001', allele1: 'A', allele2: 'T' }"}]
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`[
  { "snpName": "TUNA_SNP_001", "allele1": "C", "allele2": "C" },
  { "snpName": "TUNA_SNP_002", "allele1": "T", "allele2": "T" }
]`}
              placeholderTextColor="#4a7fa8"
              value={snpData}
              onChangeText={setSnpData}
              multiline
              scrollEnabled
              editable={!analyzing}
              selectionColor="#00d4aa"
            />
            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
              onPress={runSnpAnalysis}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="#0a1628" size="small" />
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={18} color="#0a1628" />
                  <Text style={styles.analyzeBtnText}>Analyze SNPs</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'Microsatellite' && (
          <View style={styles.content}>
            <Text style={styles.label}>Microsatellite Allele Sizes</Text>
            <Text style={styles.hint}>
              Enter repeat counts by marker: {"{"}Marker1: 189, Marker2: 134{"}"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`{
  "Ttat-1": 189,
  "Ttat-2": 134,
  "Ttat-3": 245
}`}
              placeholderTextColor="#4a7fa8"
              value={microsatelliteData}
              onChangeText={setMicrosatelliteData}
              multiline
              scrollEnabled
              editable={!analyzing}
              selectionColor="#00d4aa"
            />
            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
              onPress={runMicrosatelliteAnalysis}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="#0a1628" size="small" />
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={18} color="#0a1628" />
                  <Text style={styles.analyzeBtnText}>Analyze Markers</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'Hybrid' && (
          <View style={styles.content}>
            <Text style={styles.label}>Combine Multiple Methods</Text>
            <Text style={styles.hint}>
              Use two or more of the above methods for higher confidence identification.
              Results are weighted and merged automatically.
            </Text>
            <TouchableOpacity style={styles.methodCard} onPress={() => setActiveTab('eDNA')}>
              <Ionicons name="flask-outline" size={20} color="#00d4aa" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.methodName}>1. Enter eDNA Barcode</Text>
                <Text style={styles.methodStatus}>
                  {ednaSequence.length > 0 ? '✓ Ready' : '○ Pending'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.methodCard} onPress={() => setActiveTab('SNP')}>
              <Ionicons name="flask-outline" size={20} color="#00d4aa" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.methodName}>2. Enter SNP Data</Text>
                <Text style={styles.methodStatus}>
                  {snpData.length > 0 ? '✓ Ready' : '○ Pending'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => setActiveTab('Microsatellite')}
            >
              <Ionicons name="flask-outline" size={20} color="#00d4aa" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.methodName}>3. Enter Microsatellite Data</Text>
                <Text style={styles.methodStatus}>
                  {microsatelliteData.length > 0 ? '✓ Ready' : '○ Pending'}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.hybridInfo}>
              Enter data from at least 2 methods for hybrid identification
            </Text>

            <TouchableOpacity
              style={[
                styles.analyzeBtn,
                (analyzing ||
                  !(ednaSequence.length > 0 || snpData.length > 0 || microsatelliteData.length > 0)) &&
                  styles.analyzeBtnDisabled,
              ]}
              onPress={() => {
                setAnalyzing(true);
                setTimeout(() => {
                  try {
                    const hybridResults = hybridMolecularIdentification({
                      edna: ednaSequence.length > 0 ? results?.results || [] : null,
                      snp: snpData.length > 0 ? results?.results || [] : null,
                      microsatellite: microsatelliteData.length > 0 ? results?.results || [] : null,
                    });
                    setResults({
                      method: 'Hybrid Molecular',
                      results: hybridResults,
                      input: 'Multiple methods',
                    });
                  } catch (err) {
                    Alert.alert('Hybrid Analysis Failed', err.message);
                  } finally {
                    setAnalyzing(false);
                  }
                }, 500);
              }}
              disabled={
                analyzing ||
                !(ednaSequence.length > 0 || snpData.length > 0 || microsatelliteData.length > 0)
              }
            >
              {analyzing ? (
                <ActivityIndicator color="#0a1628" size="small" />
              ) : (
                <>
                  <Ionicons name="shuffle-outline" size={18} color="#0a1628" />
                  <Text style={styles.analyzeBtnText}>Hybrid Analysis</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Results ─────────────────────────────────────────── */}
        {results && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsMethod}>{results.method}</Text>
                <Text style={styles.resultsInput}>{results.input}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#00d4aa" />
            </View>

            {results.results.slice(0, 3).map((result, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.resultItem}
                onPress={viewDetailedResults}
              >
                <View style={styles.resultRank}>
                  <Text style={styles.resultRankText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{result.species.name}</Text>
                  <Text style={styles.resultSci}>{result.species.scientificName}</Text>
                </View>
                <View style={styles.resultConf}>
                  <Text style={[styles.resultConfPct, { color: '#00d4aa' }]}>
                    {Math.round(result.confidence * 100)}%
                  </Text>
                  <Text style={styles.resultConfLabel}>match</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.viewBtn} onPress={viewDetailedResults}>
              <Text style={styles.viewBtnText}>View Full Results</Text>
              <Ionicons name="arrow-forward" size={16} color="#0a1628" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1628' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#e8f4fd', fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },

  infoCard: {
    backgroundColor: '#0f2044',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#142954',
    alignItems: 'center',
  },
  infoTitle: { color: '#e8f4fd', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  infoText: { color: '#8ab4d4', fontSize: 12, textAlign: 'center', lineHeight: 16 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#0f2044',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: '#142954' },
  tabLabel: { color: '#8ab4d4', fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: '#00d4aa' },

  content: { paddingHorizontal: 16, marginBottom: 16 },
  label: { color: '#e8f4fd', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  hint: { color: '#8ab4d4', fontSize: 11, marginBottom: 10 },

  input: {
    backgroundColor: '#0f2044',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#142954',
    color: '#e8f4fd',
    padding: 12,
    fontSize: 11,
    fontFamily: 'monospace',
    minHeight: 120,
    maxHeight: 200,
    marginBottom: 10,
  },

  charCount: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  charCountText: { color: '#8ab4d4', fontSize: 10 },

  analyzeBtn: {
    backgroundColor: '#00d4aa',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeBtnDisabled: { backgroundColor: '#4a7fa8', opacity: 0.6 },
  analyzeBtnText: { color: '#0a1628', fontSize: 14, fontWeight: '700' },

  methodCard: {
    backgroundColor: '#0f2044',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#142954',
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodName: { color: '#e8f4fd', fontSize: 13, fontWeight: '600' },
  methodStatus: { color: '#8ab4d4', fontSize: 11, marginTop: 2 },

  hybridInfo: { color: '#8ab4d4', fontSize: 11, marginVertical: 12, textAlign: 'center' },

  resultsCard: {
    backgroundColor: '#0f2044',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#142954',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsMethod: { color: '#e8f4fd', fontSize: 14, fontWeight: '700' },
  resultsInput: { color: '#8ab4d4', fontSize: 11, marginTop: 2 },

  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#142954',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  resultRank: {
    backgroundColor: '#0f2044',
    borderRadius: 6,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resultRankText: { color: '#00d4aa', fontWeight: '700', fontSize: 12 },
  resultName: { color: '#e8f4fd', fontSize: 13, fontWeight: '600' },
  resultSci: { color: '#8ab4d4', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  resultConf: { alignItems: 'flex-end' },
  resultConfPct: { fontSize: 14, fontWeight: '700' },
  resultConfLabel: { color: '#8ab4d4', fontSize: 9 },

  viewBtn: {
    backgroundColor: '#00d4aa',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  viewBtnText: { color: '#0a1628', fontSize: 13, fontWeight: '700' },
});

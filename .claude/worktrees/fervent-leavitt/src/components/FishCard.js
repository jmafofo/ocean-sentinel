import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfidenceBar from './ConfidenceBar';
import { getConfidenceColor } from '../services/fishIdentifier';
import { formatTimestamp } from '../services/database';

const DANGER_ICONS = {
  none: null,
  minor: { name: 'alert-circle-outline', color: '#ffb74d' },
  venomous: { name: 'warning-outline', color: '#ff8a65' },
  'potentially dangerous': { name: 'warning', color: '#ff7043' },
  aggressive: { name: 'flash', color: '#ff7043' },
  dangerous: { name: 'skull-outline', color: '#ef5350' },
  toxic: { name: 'nuclear-outline', color: '#ef5350' },
};

const STATUS_COLORS = {
  'Least Concern': '#00d4aa',
  'Near Threatened': '#ffb74d',
  'Vulnerable': '#ff8a65',
  'Endangered': '#ef5350',
  'Critically Endangered': '#b71c1c',
  'Not Evaluated': '#8ab4d4',
};

/**
 * FishCard
 *
 * Modes:
 *   result  — show species + confidence bar (used in IdentificationScreen)
 *   history — compact card for a saved sighting (used in HistoryScreen)
 *   detail  — full card with all species info
 */
export default function FishCard({ species, confidence, timestamp, mode = 'result', onPress, style }) {
  if (!species) return null;

  const dangerInfo = DANGER_ICONS[species.dangerLevel];
  const statusColor = STATUS_COLORS[species.conservationStatus] ?? '#8ab4d4';
  const confColor = getConfidenceColor(confidence ?? 0);

  if (mode === 'history') {
    return (
      <TouchableOpacity style={[styles.historyCard, style]} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.historyIcon}>
          <Text style={styles.historyEmoji}>🐟</Text>
        </View>
        <View style={styles.historyInfo}>
          <View style={styles.historyNameRow}>
            <Text style={styles.historyName} numberOfLines={1}>{species.speciesName || species.name}</Text>
            {dangerInfo && (
              <Ionicons name={dangerInfo.name} size={14} color={dangerInfo.color} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.historySci} numberOfLines={1}>{species.scientificName || ''}</Text>
          <Text style={styles.historyTime}>{timestamp ? formatTimestamp(timestamp) : ''}</Text>
        </View>
        {confidence != null && (
          <View style={styles.historyConf}>
            <Text style={[styles.historyConfText, { color: confColor }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (mode === 'detail') {
    return (
      <View style={[styles.detailCard, style]}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{species.name}</Text>
            <Text style={styles.detailSci}>{species.scientificName}</Text>
            <Text style={styles.detailFamily}>{species.family}</Text>
          </View>
          <View style={styles.detailBadges}>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{species.conservationStatus}</Text>
            </View>
            {dangerInfo && (
              <View style={[styles.dangerBadge, { borderColor: dangerInfo.color }]}>
                <Ionicons name={dangerInfo.name} size={12} color={dangerInfo.color} />
                <Text style={[styles.dangerText, { color: dangerInfo.color }]}>
                  {species.dangerLevel}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill icon="resize-outline" value={`Up to ${species.maxSizeCm}cm`} label="Max size" />
          <StatPill icon="arrow-down-outline" value={species.depth} label="Depth" />
          {species.edible != null && (
            <StatPill
              icon={species.edible ? 'restaurant-outline' : 'close-circle-outline'}
              value={species.edible ? 'Edible' : 'Not edible'}
              label=""
              color={species.edible ? '#00d4aa' : '#ff8a65'}
            />
          )}
        </View>

        {/* Description */}
        <Text style={styles.description}>{species.description}</Text>

        {/* Habitat & Diet */}
        <InfoRow icon="location-outline" label="Habitat" value={species.habitat} />
        <InfoRow icon="fish-outline" label="Diet" value={species.diet} />
        <InfoRow icon="globe-outline" label="Regions" value={species.regions?.join(', ')} />

        {/* Fun facts */}
        {species.funFacts?.length > 0 && (
          <View style={styles.factsSection}>
            <Text style={styles.sectionTitle}>Interesting Facts</Text>
            {species.funFacts.map((fact, i) => (
              <View key={i} style={styles.factRow}>
                <Text style={styles.factBullet}>•</Text>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Default: result mode
  return (
    <TouchableOpacity style={[styles.resultCard, style]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.resultLeft}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{species.rank ?? 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.resultName} numberOfLines={1}>{species.name}</Text>
            {dangerInfo && (
              <Ionicons name={dangerInfo.name} size={14} color={dangerInfo.color} style={{ marginLeft: 6 }} />
            )}
          </View>
          <Text style={styles.resultSci} numberOfLines={1}>{species.scientificName}</Text>
        </View>
      </View>
      <View style={styles.resultRight}>
        <ConfidenceBar confidence={confidence ?? 0} showLabel={false} height={6} />
        <Text style={[styles.confPct, { color: confColor }]}>
          {Math.round((confidence ?? 0) * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StatPill({ icon, value, label, color = '#8ab4d4' }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {label ? <Text style={styles.statLabel}>{label}</Text> : null}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#00d4aa" style={{ marginTop: 1 }} />
      <Text style={styles.infoLabel}>{label}: </Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── History card ─────────────────────────────────────────────
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#142954',
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyEmoji: { fontSize: 22 },
  historyInfo: { flex: 1 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center' },
  historyName: { color: '#e8f4fd', fontSize: 15, fontWeight: '600' },
  historySci: { color: '#8ab4d4', fontSize: 12, fontStyle: 'italic', marginTop: 1 },
  historyTime: { color: '#4a7fa8', fontSize: 11, marginTop: 3 },
  historyConf: { marginLeft: 8 },
  historyConfText: { fontSize: 15, fontWeight: '700' },

  // ── Result card ───────────────────────────────────────────────
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2044',
    borderRadius: 12,
    padding: 14,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#142954',
  },
  resultLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#142954',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: { color: '#00d4aa', fontSize: 12, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  resultName: { color: '#e8f4fd', fontSize: 15, fontWeight: '600', flex: 1 },
  resultSci: { color: '#8ab4d4', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  resultRight: { width: 90, alignItems: 'flex-end' },
  confPct: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // ── Detail card ───────────────────────────────────────────────
  detailCard: {
    backgroundColor: '#0f2044',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#142954',
  },
  detailHeader: { flexDirection: 'row', marginBottom: 14 },
  detailName: { color: '#e8f4fd', fontSize: 22, fontWeight: '700' },
  detailSci: { color: '#8ab4d4', fontSize: 14, fontStyle: 'italic', marginTop: 3 },
  detailFamily: { color: '#4a7fa8', fontSize: 12, marginTop: 3 },
  detailBadges: { alignItems: 'flex-end', gap: 6 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  dangerText: { fontSize: 10, fontWeight: '600' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#142954',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  statValue: { fontSize: 12, fontWeight: '600' },
  statLabel: { color: '#4a7fa8', fontSize: 10 },
  description: { color: '#c5dff0', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  infoLabel: { color: '#8ab4d4', fontSize: 13, fontWeight: '600', marginLeft: 6 },
  infoValue: { color: '#c5dff0', fontSize: 13, flex: 1 },
  factsSection: { marginTop: 10 },
  sectionTitle: { color: '#00d4aa', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  factRow: { flexDirection: 'row', marginBottom: 6 },
  factBullet: { color: '#00d4aa', fontSize: 14, marginRight: 8 },
  factText: { color: '#c5dff0', fontSize: 13, lineHeight: 19, flex: 1 },
});

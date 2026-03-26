/**
 * Database Service — expo-sqlite
 *
 * Stores all fish sightings locally on-device for fully offline history.
 * Schema:
 *   sightings (id, speciesId, speciesName, confidence, latitude, longitude,
 *              imageUri, timestamp, notes)
 */

import * as SQLite from 'expo-sqlite';

let db = null;

const DB_NAME = 'ocean_sentinel.db';

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initSchema(db);
  }
  return db;
}

async function initSchema(database) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sightings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      speciesId   TEXT    NOT NULL,
      speciesName TEXT    NOT NULL,
      confidence  REAL    NOT NULL,
      latitude    REAL,
      longitude   REAL,
      imageUri    TEXT,
      timestamp   INTEGER NOT NULL,
      notes       TEXT    DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_sightings_timestamp ON sightings(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_sightings_species   ON sightings(speciesId);
  `);
}

/**
 * Save a new fish sighting.
 *
 * @param {object} sighting
 * @param {string} sighting.speciesId
 * @param {string} sighting.speciesName
 * @param {number} sighting.confidence  0–1
 * @param {number|null} sighting.latitude
 * @param {number|null} sighting.longitude
 * @param {string|null} sighting.imageUri
 * @param {string} [sighting.notes]
 * @returns {Promise<number>} Inserted row id
 */
export async function saveSighting({ speciesId, speciesName, confidence, latitude, longitude, imageUri, notes = '' }) {
  const database = await getDb();
  const timestamp = Date.now();
  const result = await database.runAsync(
    `INSERT INTO sightings (speciesId, speciesName, confidence, latitude, longitude, imageUri, timestamp, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [speciesId, speciesName, confidence, latitude ?? null, longitude ?? null, imageUri ?? null, timestamp, notes]
  );
  return result.lastInsertRowId;
}

/**
 * Get all sightings, newest first.
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
export async function getAllSightings(limit = 100) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM sightings ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get sightings that have GPS coordinates (for map display).
 * @returns {Promise<Array>}
 */
export async function getSightingsWithLocation() {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM sightings WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY timestamp DESC`
  );
}

/**
 * Get sightings for a specific species.
 * @param {string} speciesId
 * @returns {Promise<Array>}
 */
export async function getSightingsBySpecies(speciesId) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM sightings WHERE speciesId = ? ORDER BY timestamp DESC`,
    [speciesId]
  );
}

/**
 * Delete a sighting by id.
 * @param {number} id
 */
export async function deleteSighting(id) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM sightings WHERE id = ?`, [id]);
}

/**
 * Update notes on a sighting.
 * @param {number} id
 * @param {string} notes
 */
export async function updateSightingNotes(id, notes) {
  const database = await getDb();
  await database.runAsync(`UPDATE sightings SET notes = ? WHERE id = ?`, [notes, id]);
}

/**
 * Get total count of sightings.
 * @returns {Promise<number>}
 */
export async function getSightingCount() {
  const database = await getDb();
  const row = await database.getFirstAsync(`SELECT COUNT(*) as count FROM sightings`);
  return row?.count ?? 0;
}

/**
 * Get count of unique species identified.
 * @returns {Promise<number>}
 */
export async function getUniqueSpeciesCount() {
  const database = await getDb();
  const row = await database.getFirstAsync(`SELECT COUNT(DISTINCT speciesId) as count FROM sightings`);
  return row?.count ?? 0;
}

/**
 * Get most recently sighted species (for Home screen widget).
 * @param {number} [limit=3]
 * @returns {Promise<Array>}
 */
export async function getRecentSightings(limit = 3) {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT * FROM sightings ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Format a timestamp for display.
 * @param {number} timestamp  Unix ms
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

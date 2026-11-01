/**
 * SEVA.GIS Remote Field Scout & Beacon Crowdsourcing Service
 * 
 * Enables a remote user (sitting at home on desktop/laptop) who doesn't know
 * their field coordinates to generate a shareable web link. A friend/worker standing
 * at the field opens the link in their mobile browser, snaps a photo or video with
 * hardware GPS, and sends it back to automatically pinpoint the field in SEVA.GIS.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'scout_sessions.json');

// In-memory sessions store
const sessionsMap = new Map();

// Session TTL: 48 hours
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // Ignore directory creation error
    }
  }
}

function loadSessionsFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.sessionId) {
            sessionsMap.set(item.sessionId, item);
          }
        }
      }
    }
  } catch (err) {
    console.debug('[ScoutBeacon] Note loading disk sessions:', err.message);
  }
}

function persistSessionsToDisk() {
  try {
    ensureDataDir();
    const arr = Array.from(sessionsMap.values()).slice(-100); // keep last 100
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.debug('[ScoutBeacon] Note saving disk sessions:', err.message);
  }
}

// Initialize on module load
loadSessionsFromDisk();

/**
 * Creates a new scout session
 */
export function createScoutSession(options = {}) {
  const sessionId = 'scout_' + crypto.randomBytes(6).toString('hex');
  const now = Date.now();
  
  const session = {
    sessionId,
    label: options.label || 'My Agricultural Field',
    requesterNote: options.requesterNote || '',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    status: 'waiting', // 'waiting' | 'completed' | 'expired'
    data: null,
  };

  sessionsMap.set(sessionId, session);
  persistSessionsToDisk();

  return session;
}

/**
 * Submits beacon telemetry, GPS coordinates, and photo/video from the friend on the ground
 */
export function submitScoutData(sessionId, payload = {}) {
  const session = sessionsMap.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found or expired' };
  }

  const lat = parseFloat(payload.latitude);
  const lon = parseFloat(payload.longitude);

  if (isNaN(lat) || isNaN(lon)) {
    return { success: false, error: 'Valid latitude and longitude are required' };
  }

  session.status = 'completed';
  session.submittedAt = new Date().toISOString();
  session.data = {
    latitude: lat,
    longitude: lon,
    accuracy: typeof payload.accuracy === 'number' ? payload.accuracy : null,
    altitude: typeof payload.altitude === 'number' ? payload.altitude : null,
    heading: typeof payload.heading === 'number' ? payload.heading : null,
    digipin: typeof payload.digipin === 'string' ? payload.digipin : null,
    scoutName: typeof payload.scoutName === 'string' ? payload.scoutName.trim() : 'Friend on Ground',
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
    photoBase64: typeof payload.photoBase64 === 'string' ? payload.photoBase64 : null,
    videoBase64: typeof payload.videoBase64 === 'string' ? payload.videoBase64 : null,
    corners: Array.isArray(payload.corners) ? payload.corners : null,
  };

  sessionsMap.set(sessionId, session);
  persistSessionsToDisk();

  return { success: true, session };
}

/**
 * Gets the status and data of a scout session
 */
export function getScoutSession(sessionId) {
  const session = sessionsMap.get(sessionId);
  if (!session) return null;

  // Check expiration
  if (Date.now() > new Date(session.expiresAt).getTime()) {
    session.status = 'expired';
  }

  return session;
}

/**
 * Lists recent sessions for the current host/environment
 */
export function listRecentSessions(limit = 10) {
  return Array.from(sessionsMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

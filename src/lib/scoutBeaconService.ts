/**
 * SEVA.GIS Remote Field Scout & Beacon Crowdsourcing Client Service
 * 
 * Enables a user at home/laptop to generate a secure link and share it
 * with a friend/worker standing at the agricultural field.
 * The friend opens the link, snaps a photo/video with real-time GPS,
 * and submits it back to automatically pinpoint and delineate the field in SEVA.GIS.
 */

import { encodeDigipin } from './digipin';

export interface GroundScoutPayload {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  digipin: string;
  scoutName?: string;
  notes?: string;
  photoBase64?: string | null;
  videoBase64?: string | null;
  corners?: [number, number][] | null;
}

export interface ScoutSessionRecord {
  sessionId: string;
  label: string;
  requesterNote?: string;
  createdAt: string;
  expiresAt: string;
  status: 'waiting' | 'completed' | 'expired';
  submittedAt?: string;
  data: GroundScoutPayload | null;
}

// Fallback in-memory storage for test runners or offline browser
const memStore = new Map<string, string>();

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memStore.get(key) || null;
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch {}
    memStore.set(key, val);
  },
};

/**
 * Creates a new remote scout session and returns the shareable URL.
 */
export async function createRemoteScoutSession(
  label: string = 'My Agricultural Field',
  requesterNote: string = ''
): Promise<{ sessionId: string; shareUrl: string; session: ScoutSessionRecord }> {
  const sessionId = 'scout_' + Math.random().toString(36).substring(2, 9);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

  const initialRecord: ScoutSessionRecord = {
    sessionId,
    label,
    requesterNote,
    createdAt: now.toISOString(),
    expiresAt,
    status: 'waiting',
    data: null,
  };

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/scout-beacon/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, requesterNote }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && serverData.sessionId) {
        safeStorage.setItem(`seva_scout_${serverData.sessionId}`, JSON.stringify(serverData.session || initialRecord));
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sevagis.dpdns.org';
        return {
          sessionId: serverData.sessionId,
          shareUrl: `${origin}/?scoutSession=${serverData.sessionId}`,
          session: serverData.session || initialRecord,
        };
      }
    }
  } catch {
    // Fall back to client-side session
  }

  // Fallback: store locally
  safeStorage.setItem(`seva_scout_${sessionId}`, JSON.stringify(initialRecord));
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sevagis.dpdns.org';
  return {
    sessionId,
    shareUrl: `${origin}/?scoutSession=${sessionId}`,
    session: initialRecord,
  };
}

/**
 * Checks the status of a scout session (polling or single-shot).
 */
export async function checkScoutBeaconStatus(sessionId: string): Promise<ScoutSessionRecord | null> {
  // 1. Try server endpoint
  try {
    const res = await fetch(`/api/scout-beacon/status?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.session) {
        safeStorage.setItem(`seva_scout_${sessionId}`, JSON.stringify(data.session));
        return data.session;
      }
    }
  } catch {
    // Check local fallback
  }

  const raw = safeStorage.getItem(`seva_scout_${sessionId}`);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

/**
 * Submits the ground beacon payload from the friend on the field.
 */
export async function submitGroundBeaconPayload(
  payload: GroundScoutPayload
): Promise<{ success: boolean; error?: string }> {
  if (!payload.sessionId || isNaN(payload.latitude) || isNaN(payload.longitude)) {
    return { success: false, error: 'Valid session ID and coordinates required.' };
  }

  // Ensure DIGIPIN is attached
  if (!payload.digipin) {
    try {
      payload.digipin = encodeDigipin(payload.latitude, payload.longitude);
    } catch {
      payload.digipin = 'UNKNOWN-PIN';
    }
  }

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/scout-beacon/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData.success) {
        safeStorage.setItem(`seva_scout_${payload.sessionId}`, JSON.stringify(serverData.session));
        // Trigger storage event for same-browser testing
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('seva_beacon_received', { detail: serverData.session }));
        }
        return { success: true };
      }
    }
  } catch {
    // Fall back to client storage
  }

  // Client storage fallback
  const existingRaw = safeStorage.getItem(`seva_scout_${payload.sessionId}`);
  let sessionRecord: ScoutSessionRecord;
  if (existingRaw) {
    try {
      sessionRecord = JSON.parse(existingRaw);
    } catch {
      sessionRecord = {
        sessionId: payload.sessionId,
        label: 'Field Beacon',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        status: 'waiting',
        data: null,
      };
    }
  } else {
    sessionRecord = {
      sessionId: payload.sessionId,
      label: 'Field Beacon',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      status: 'waiting',
      data: null,
    };
  }

  sessionRecord.status = 'completed';
  sessionRecord.submittedAt = new Date().toISOString();
  sessionRecord.data = payload;

  safeStorage.setItem(`seva_scout_${payload.sessionId}`, JSON.stringify(sessionRecord));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('seva_beacon_received', { detail: sessionRecord }));
  }

  return { success: true };
}

/**
 * Formats a pre-composed WhatsApp message for the friend.
 */
export function generateWhatsAppScoutInvite(shareUrl: string, plotName: string = 'our field'): string {
  const text = `🌾 *SEVA.GIS Field Location Request*\n\nHi! Could you help me locate ${plotName}?\n\nPlease tap this link on your phone while standing at or near the field:\n👉 ${shareUrl}\n\n1. Allow GPS & Camera\n2. Snap a photo or short video of the crop\n3. Tap "Done & Send"\n\nIt will instantly pinpoint our field boundary on my screen in real-time! Thank you!`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Formats a pre-composed SMS link for the friend.
 */
export function generateSmsScoutInvite(phone: string, shareUrl: string, plotName: string = 'our field'): string {
  const text = `SEVA.GIS Field Help: Please open this link while at ${plotName} to send GPS & crop photo: ${shareUrl}`;
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
}

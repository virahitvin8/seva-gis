export interface ScoutSessionData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  digipin: string | null;
  scoutName?: string;
  notes?: string;
  photoBase64?: string | null;
  videoBase64?: string | null;
  corners?: [number, number][] | null;
}

export interface ScoutSession {
  sessionId: string;
  label: string;
  requesterNote?: string;
  createdAt: string;
  expiresAt: string;
  status: 'waiting' | 'completed' | 'expired';
  submittedAt?: string;
  data: ScoutSessionData | null;
}

export function createScoutSession(options?: { label?: string; requesterNote?: string }): ScoutSession;
export function submitScoutData(sessionId: string, payload: any): { success: boolean; session?: ScoutSession; error?: string };
export function getScoutSession(sessionId: string): ScoutSession | null;
export function listRecentSessions(limit?: number): ScoutSession[];

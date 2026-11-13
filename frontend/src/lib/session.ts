import type { ParticipantSession } from "../types";

const KEY = "samtalekart.participant";

export function saveParticipantSession(session: ParticipantSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadParticipantSession(): ParticipantSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParticipantSession;
  } catch {
    return null;
  }
}

export function clearParticipantSession(): void {
  localStorage.removeItem(KEY);
}


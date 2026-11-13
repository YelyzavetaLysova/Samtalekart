import type { Activity, Participant, ParticipantSession } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Ukjent feil" }));
    throw new Error(payload.detail ?? `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  createActivity: (input: {
    topic: string;
    language_level: string;
    grouping_mode: "automatic" | "manual";
    target_group_size: number;
  }) => request<{ activity: Activity; host_token: string }>("/api/activities", {
    method: "POST",
    body: JSON.stringify(input),
  }),

  activity: (code: string) => request<Activity>(`/api/activities/${code}`),

  join: (code: string, nickname: string) => request<{ participant: Participant; activity: Activity }>(
    `/api/activities/${code}/join`,
    { method: "POST", body: JSON.stringify({ nickname }) },
  ),

  autoGroups: (code: string, hostToken: string) => request<Activity>(`/api/activities/${code}/groups/automatic`, {
    method: "POST",
    headers: { "X-Host-Token": hostToken },
  }),

  manualGroups: (code: string, hostToken: string, groups: string[][]) => request<Activity>(
    `/api/activities/${code}/groups/manual`,
    { method: "POST", headers: { "X-Host-Token": hostToken }, body: JSON.stringify({ groups }) },
  ),

  confirm: (session: ParticipantSession) => request<Activity>(
    `/api/activities/${session.activityCode}/participants/${session.participant.id}/confirm`,
    { method: "POST", headers: { "X-Participant-Token": session.participant.token ?? "" } },
  ),

  calibrated: (session: ParticipantSession) => request<Activity>(
    `/api/activities/${session.activityCode}/participants/${session.participant.id}/calibrated`,
    { method: "POST", headers: { "X-Participant-Token": session.participant.token ?? "" } },
  ),

  start: (code: string, hostToken: string) => request<Activity>(`/api/activities/${code}/start`, {
    method: "POST",
    headers: { "X-Host-Token": hostToken },
  }),

  end: (code: string, hostToken: string) => request<Activity>(`/api/activities/${code}/end`, {
    method: "POST",
    headers: { "X-Host-Token": hostToken },
  }),

  leave: (session: ParticipantSession) => request<Activity>(
    `/api/activities/${session.activityCode}/participants/${session.participant.id}/leave`,
    { method: "POST", headers: { "X-Participant-Token": session.participant.token ?? "" } },
  ),

  liveKitToken: (session: ParticipantSession) => request<{ mock: boolean; url: string; token: string | null }>(
    `/api/activities/${session.activityCode}/participants/${session.participant.id}/livekit-token`,
    { headers: { "X-Participant-Token": session.participant.token ?? "" } },
  ),

  helpSay: (groupId: string, participantId: string, nodeId: string | null, level: number) => request<{
    level: number; text: string; max_level: number;
  }>(`/api/groups/${groupId}/help/say`, {
    method: "POST",
    body: JSON.stringify({ participant_id: participantId, node_id: nodeId, level, recent_context: "" }),
  }),

  helpUnderstand: (groupId: string, participantId: string, level: number) => request<{
    level: number; text: string; max_level: number;
  }>(`/api/groups/${groupId}/help/understand`, {
    method: "POST",
    body: JSON.stringify({ participant_id: participantId, level, recent_context: "" }),
  }),

  suggestMap: (groupId: string, transcriptExcerpt: string) => request(
    `/api/groups/${groupId}/map/suggest`,
    { method: "POST", body: JSON.stringify({ transcript_excerpt: transcriptExcerpt }) },
  ),

  feedback: (session: ParticipantSession) => request<{ items: string[] }>(
    `/api/activities/${session.activityCode}/participants/${session.participant.id}/feedback`,
    { headers: { "X-Participant-Token": session.participant.token ?? "" } },
  ),
};

export function activityWebSocket(code: string): WebSocket {
  const base = API_BASE || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/activities/${code}`;
  return new WebSocket(url);
}


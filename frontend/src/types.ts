export type ParticipantStatus = "joined" | "grouped" | "confirmed" | "calibrated" | "left";

export interface Participant {
  id: string;
  nickname: string;
  token?: string;
  group_id: string | null;
  status: ParticipantStatus;
}

export interface MapNodeData {
  id: string;
  label: string;
  kind: string;
  question?: string;
  words: string[];
  phrases: string[];
  tentative: boolean;
}

export interface ConversationMapData {
  root_label: string;
  nodes: MapNodeData[];
  version: number;
}

export interface Group {
  id: string;
  number: number;
  participant_ids: string[];
  map: ConversationMapData;
}

export interface Activity {
  join_code: string;
  topic: string;
  language_level: string;
  grouping_mode: "automatic" | "manual";
  target_group_size: number;
  status: "lobby" | "active" | "ended";
  participants: Participant[];
  groups: Group[];
}

export interface ParticipantSession {
  participant: Participant;
  activityCode: string;
}


from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ActivityStatus(StrEnum):
    LOBBY = "lobby"
    ACTIVE = "active"
    ENDED = "ended"


class GroupingMode(StrEnum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


class ParticipantStatus(StrEnum):
    JOINED = "joined"
    GROUPED = "grouped"
    CONFIRMED = "confirmed"
    CALIBRATED = "calibrated"
    LEFT = "left"


class MapNode(BaseModel):
    id: str
    label: str
    kind: str = "topic"
    question: str | None = None
    words: list[str] = Field(default_factory=list)
    phrases: list[str] = Field(default_factory=list)
    tentative: bool = False


class ConversationMap(BaseModel):
    root_label: str
    nodes: list[MapNode] = Field(default_factory=list)
    version: int = 1


class Participant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    nickname: str
    token: str = Field(default_factory=lambda: str(uuid4()))
    group_id: str | None = None
    status: ParticipantStatus = ParticipantStatus.JOINED
    joined_at: str = Field(default_factory=now_iso)


class Group(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    number: int
    participant_ids: list[str] = Field(default_factory=list)
    map: ConversationMap
    transcript: list[str] = Field(default_factory=list)


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    join_code: str
    host_token: str = Field(default_factory=lambda: str(uuid4()))
    topic: str
    language_level: str
    grouping_mode: GroupingMode
    target_group_size: int = 4
    status: ActivityStatus = ActivityStatus.LOBBY
    participants: dict[str, Participant] = Field(default_factory=dict)
    groups: dict[str, Group] = Field(default_factory=dict)
    created_at: str = Field(default_factory=now_iso)


class CreateActivityRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=240)
    language_level: str = "A2"
    grouping_mode: GroupingMode = GroupingMode.AUTOMATIC
    target_group_size: int = Field(default=4, ge=2, le=6)


class JoinActivityRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=40)


class ManualGroupsRequest(BaseModel):
    groups: list[list[str]]


class RejoinRequest(BaseModel):
    same_group: bool = True


class MapSuggestionRequest(BaseModel):
    transcript_excerpt: str = Field(min_length=1, max_length=4000)


class HelpRequest(BaseModel):
    participant_id: str
    node_id: str | None = None
    level: int = Field(default=1, ge=1, le=6)
    recent_context: str = Field(default="", max_length=2000)


from __future__ import annotations

import asyncio
import math
import random
import string

from fastapi import HTTPException

from .models import (
    Activity,
    ActivityStatus,
    ConversationMap,
    CreateActivityRequest,
    Group,
    MapNode,
    Participant,
    ParticipantStatus,
)


def initial_map(topic: str) -> ConversationMap:
    return ConversationMap(
        root_label=topic,
        nodes=[
            MapNode(
                id="ideas",
                label="Ideer",
                question="Hvilke forslag har dere?",
                words=["forslag", "mulighet", "kanskje"],
                phrases=["Jeg foreslår at ...", "Vi kan kanskje ..."],
            ),
            MapNode(
                id="reasons",
                label="Begrunnelser",
                question="Hvorfor passer dette for gruppen?",
                words=["fordi", "fordel", "viktig"],
                phrases=["Det passer fordi ...", "En fordel er at ..."],
            ),
            MapNode(
                id="practical",
                label="Praktisk",
                question="Hva må dere planlegge?",
                words=["tid", "sted", "ansvar"],
                phrases=["Vi må bestemme ...", "Hvem kan ...?"],
            ),
        ],
    )


class MemoryStore:
    """Runnable first version. Replace with PostgreSQL without changing API routes."""

    def __init__(self) -> None:
        self.activities: dict[str, Activity] = {}
        self.lock = asyncio.Lock()

    @staticmethod
    def _code() -> str:
        alphabet = string.ascii_uppercase + string.digits
        return "".join(random.choice(alphabet) for _ in range(6))

    async def create_activity(self, request: CreateActivityRequest) -> Activity:
        async with self.lock:
            code = self._code()
            while code in self.activities:
                code = self._code()
            activity = Activity(join_code=code, **request.model_dump())
            self.activities[code] = activity
            return activity

    def get_activity(self, code: str) -> Activity:
        activity = self.activities.get(code.upper())
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        return activity

    @staticmethod
    def require_host(activity: Activity, token: str | None) -> None:
        if not token or token != activity.host_token:
            raise HTTPException(status_code=403, detail="Invalid host token")

    @staticmethod
    def require_participant(activity: Activity, participant_id: str, token: str | None) -> Participant:
        participant = activity.participants.get(participant_id)
        if not participant or not token or token != participant.token:
            raise HTTPException(status_code=403, detail="Invalid participant token")
        return participant

    async def join(self, code: str, nickname: str) -> Participant:
        async with self.lock:
            activity = self.get_activity(code)
            if activity.status == ActivityStatus.ENDED:
                raise HTTPException(status_code=409, detail="Activity has ended")
            participant = Participant(nickname=nickname.strip())
            activity.participants[participant.id] = participant
            if activity.status == ActivityStatus.ACTIVE and activity.groups:
                self._assign_to_least_populated(activity, participant)
            return participant

    def _new_group(self, activity: Activity) -> Group:
        number = len(activity.groups) + 1
        group = Group(number=number, map=initial_map(activity.topic))
        activity.groups[group.id] = group
        return group

    def _assign_to_least_populated(self, activity: Activity, participant: Participant) -> Group:
        if not activity.groups:
            group = self._new_group(activity)
        else:
            group = min(activity.groups.values(), key=lambda item: len(item.participant_ids))
        if participant.id not in group.participant_ids:
            group.participant_ids.append(participant.id)
        participant.group_id = group.id
        participant.status = ParticipantStatus.GROUPED
        return group

    async def automatic_groups(self, activity: Activity) -> None:
        async with self.lock:
            activity.groups.clear()
            active = [p for p in activity.participants.values() if p.status != ParticipantStatus.LEFT]
            if not active:
                return
            group_count = max(1, round(len(active) / activity.target_group_size))
            group_count = max(math.ceil(len(active) / 5), group_count)
            group_count = min(max(1, len(active) // 3), group_count) if len(active) >= 3 else 1
            groups = [self._new_group(activity) for _ in range(group_count)]
            for index, participant in enumerate(active):
                group = groups[index % group_count]
                group.participant_ids.append(participant.id)
                participant.group_id = group.id
                participant.status = ParticipantStatus.GROUPED

    async def manual_groups(self, activity: Activity, assignments: list[list[str]]) -> None:
        async with self.lock:
            activity.groups.clear()
            assigned: set[str] = set()
            for participant_ids in assignments:
                group = self._new_group(activity)
                for participant_id in participant_ids:
                    participant = activity.participants.get(participant_id)
                    if participant and participant_id not in assigned:
                        group.participant_ids.append(participant_id)
                        participant.group_id = group.id
                        participant.status = ParticipantStatus.GROUPED
                        assigned.add(participant_id)

    async def leave(self, activity: Activity, participant: Participant) -> None:
        async with self.lock:
            if participant.group_id and participant.group_id in activity.groups:
                group = activity.groups[participant.group_id]
                group.participant_ids = [item for item in group.participant_ids if item != participant.id]
            participant.status = ParticipantStatus.LEFT


store = MemoryStore()


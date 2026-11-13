from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .events import events
from .models import (
    ActivityStatus,
    CreateActivityRequest,
    HelpRequest,
    JoinActivityRequest,
    ManualGroupsRequest,
    MapSuggestionRequest,
    ParticipantStatus,
    RejoinRequest,
)
from .services.conversation import ConversationService
from .services.livekit_service import LiveKitService
from .store import store

settings = get_settings()
conversation = ConversationService(settings)
livekit = LiveKitService(settings)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def public_activity(activity) -> dict:
    return {
        "join_code": activity.join_code,
        "topic": activity.topic,
        "language_level": activity.language_level,
        "grouping_mode": activity.grouping_mode,
        "target_group_size": activity.target_group_size,
        "status": activity.status,
        "participants": [p.model_dump(exclude={"token"}) for p in activity.participants.values()],
        "groups": [g.model_dump() for g in activity.groups.values()],
    }


async def changed(activity, event: str = "activity.updated") -> None:
    await events.activity(activity.join_code, {"type": event, "activity": public_activity(activity)})
    for group in activity.groups.values():
        await events.group(group.id, {"type": event, "activity": public_activity(activity), "group": group.model_dump()})


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "mode": "mock" if settings.mock_services else "integrated",
        "livekit": bool(settings.livekit_url),
        "openai": bool(settings.openai_api_key),
        "azure_speech": bool(settings.azure_speech_key and settings.azure_speech_region),
    }


@app.post("/api/activities")
async def create_activity(request: CreateActivityRequest) -> dict:
    activity = await store.create_activity(request)
    return {"activity": public_activity(activity), "host_token": activity.host_token}


@app.get("/api/activities/{code}")
async def get_activity(code: str) -> dict:
    return public_activity(store.get_activity(code))


@app.post("/api/activities/{code}/join")
async def join_activity(code: str, request: JoinActivityRequest) -> dict:
    participant = await store.join(code, request.nickname)
    activity = store.get_activity(code)
    await changed(activity, "participant.joined")
    return {"participant": participant.model_dump(), "activity": public_activity(activity)}


@app.post("/api/activities/{code}/groups/automatic")
async def automatic_groups(code: str, x_host_token: str | None = Header(default=None)) -> dict:
    activity = store.get_activity(code)
    store.require_host(activity, x_host_token)
    await store.automatic_groups(activity)
    await changed(activity, "groups.updated")
    return public_activity(activity)


@app.post("/api/activities/{code}/groups/manual")
async def manual_groups(code: str, request: ManualGroupsRequest, x_host_token: str | None = Header(default=None)) -> dict:
    activity = store.get_activity(code)
    store.require_host(activity, x_host_token)
    await store.manual_groups(activity, request.groups)
    await changed(activity, "groups.updated")
    return public_activity(activity)


@app.post("/api/activities/{code}/participants/{participant_id}/confirm")
async def confirm_group(
    code: str,
    participant_id: str,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    if not participant.group_id:
        raise HTTPException(status_code=409, detail="Participant has not been assigned to a group")
    participant.status = ParticipantStatus.CONFIRMED
    await changed(activity, "participant.confirmed")
    return public_activity(activity)


@app.post("/api/activities/{code}/participants/{participant_id}/calibrated")
async def calibrated(
    code: str,
    participant_id: str,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    participant.status = ParticipantStatus.CALIBRATED
    await changed(activity, "participant.calibrated")
    return public_activity(activity)


@app.post("/api/activities/{code}/start")
async def start_activity(code: str, x_host_token: str | None = Header(default=None)) -> dict:
    activity = store.get_activity(code)
    store.require_host(activity, x_host_token)
    if not activity.groups:
        await store.automatic_groups(activity)
    confirmed = [p for p in activity.participants.values() if p.status in {ParticipantStatus.CONFIRMED, ParticipantStatus.CALIBRATED}]
    if not confirmed:
        raise HTTPException(status_code=409, detail="No participant has confirmed their group")
    activity.status = ActivityStatus.ACTIVE
    await changed(activity, "activity.started")
    return public_activity(activity)


@app.post("/api/activities/{code}/end")
async def end_activity(code: str, x_host_token: str | None = Header(default=None)) -> dict:
    activity = store.get_activity(code)
    store.require_host(activity, x_host_token)
    activity.status = ActivityStatus.ENDED
    await changed(activity, "activity.ended")
    return public_activity(activity)


@app.post("/api/activities/{code}/participants/{participant_id}/leave")
async def leave_activity(
    code: str,
    participant_id: str,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    await store.leave(activity, participant)
    await changed(activity, "participant.left")
    return public_activity(activity)


@app.post("/api/activities/{code}/participants/{participant_id}/rejoin")
async def rejoin_activity(
    code: str,
    participant_id: str,
    request: RejoinRequest,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    previous_group = activity.groups.get(participant.group_id or "")
    if request.same_group and previous_group:
        if participant.id not in previous_group.participant_ids:
            previous_group.participant_ids.append(participant.id)
        participant.status = ParticipantStatus.GROUPED
    else:
        participant.group_id = None
        store._assign_to_least_populated(activity, participant)
    await changed(activity, "participant.rejoined")
    return {"participant": participant.model_dump(), "activity": public_activity(activity)}


@app.get("/api/activities/{code}/participants/{participant_id}/livekit-token")
async def livekit_token(
    code: str,
    participant_id: str,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    if not participant.group_id:
        raise HTTPException(status_code=409, detail="Participant is not in a group")
    return livekit.participant_token(f"activity-{code}-group-{participant.group_id}", participant.id, participant.nickname)


@app.post("/api/groups/{group_id}/map/suggest")
async def suggest_map(group_id: str, request: MapSuggestionRequest) -> dict:
    for activity in store.activities.values():
        group = activity.groups.get(group_id)
        if group:
            group.transcript.append(request.transcript_excerpt)
            group.map = await conversation.suggest_map_update(group.map, request.transcript_excerpt)
            await changed(activity, "map.updated")
            return group.map.model_dump()
    raise HTTPException(status_code=404, detail="Group not found")


@app.post("/api/groups/{group_id}/help/say")
async def help_say(group_id: str, request: HelpRequest) -> dict:
    for activity in store.activities.values():
        group = activity.groups.get(group_id)
        if group:
            participant = activity.participants.get(request.participant_id)
            if not participant or participant.group_id != group_id:
                raise HTTPException(status_code=403, detail="Participant is not in this group")
            node = next((item for item in group.map.nodes if item.id == request.node_id), None)
            return await conversation.help_say(request, node)
    raise HTTPException(status_code=404, detail="Group not found")


@app.post("/api/groups/{group_id}/help/understand")
async def help_understand(group_id: str, request: HelpRequest) -> dict:
    return await conversation.help_understand(request)


@app.get("/api/activities/{code}/participants/{participant_id}/feedback")
async def get_feedback(
    code: str,
    participant_id: str,
    x_participant_token: str | None = Header(default=None),
) -> dict:
    activity = store.get_activity(code)
    participant = store.require_participant(activity, participant_id, x_participant_token)
    if activity.status != ActivityStatus.ENDED:
        raise HTTPException(status_code=409, detail="Feedback is available after the conversation")
    return {"items": await conversation.feedback(participant.nickname)}


@app.websocket("/ws/activities/{code}")
async def activity_socket(websocket: WebSocket, code: str) -> None:
    store.get_activity(code)
    await events.connect_activity(code, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        events.disconnect(websocket)


@app.websocket("/ws/groups/{group_id}")
async def group_socket(websocket: WebSocket, group_id: str) -> None:
    if not any(group_id in activity.groups for activity in store.activities.values()):
        await websocket.close(code=4404)
        return
    await events.connect_group(group_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        events.disconnect(websocket)


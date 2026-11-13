from __future__ import annotations

from ..config import Settings


class LiveKitService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def participant_token(self, room_name: str, participant_id: str, nickname: str) -> dict:
        if self.settings.mock_services:
            return {"mock": True, "url": self.settings.livekit_url, "token": None}

        from livekit import api

        token = (
            api.AccessToken(self.settings.livekit_api_key, self.settings.livekit_api_secret)
            .with_identity(participant_id)
            .with_name(nickname)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=False,
                )
            )
            .to_jwt()
        )
        return {"mock": False, "url": self.settings.livekit_url, "token": token}


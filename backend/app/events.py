from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class EventHub:
    def __init__(self) -> None:
        self.activity_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.group_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect_activity(self, code: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.activity_connections[code].add(websocket)

    async def connect_group(self, group_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.group_connections[group_id].add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        for connections in (*self.activity_connections.values(), *self.group_connections.values()):
            connections.discard(websocket)

    async def _broadcast(self, connections: set[WebSocket], payload: dict) -> None:
        stale: list[WebSocket] = []
        for connection in list(connections):
            try:
                await connection.send_json(payload)
            except Exception:
                stale.append(connection)
        for connection in stale:
            connections.discard(connection)

    async def activity(self, code: str, payload: dict) -> None:
        await self._broadcast(self.activity_connections[code], payload)

    async def group(self, group_id: str, payload: dict) -> None:
        await self._broadcast(self.group_connections[group_id], payload)


events = EventHub()


"""
GladME Studio V5 — Y.js WebSocket Collaboration Server
Phase 4: CRDT collaborative editing foundation.
Mounts alongside FastAPI on /ws/collab path.
"""

import asyncio
import json
import logging
from typing import Set

from fastapi import WebSocket, WebSocketDisconnect, Query, Depends

from auth import get_ws_user

logger = logging.getLogger(__name__)

class CollaborationRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.connections: Set[WebSocket] = set()
        self.document_state: bytes = b""

    def add(self, ws: WebSocket):
        self.connections.add(ws)

    def remove(self, ws: WebSocket):
        self.connections.discard(ws)

    async def broadcast(self, data: bytes, sender: WebSocket):
        for conn in list(self.connections):
            if conn != sender:
                try:
                    await conn.send_bytes(data)
                except Exception:
                    self.connections.discard(conn)


rooms: dict[str, CollaborationRoom] = {}


def get_room(room_id: str) -> CollaborationRoom:
    if room_id not in rooms:
        rooms[room_id] = CollaborationRoom(room_id)
    return rooms[room_id]


async def collab_endpoint(websocket: WebSocket, token: str = Query(default="")):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Auth required")
        return

    room_id = websocket.query_params.get("room", "default")
    room = get_room(room_id)

    await websocket.accept()
    room.add(websocket)

    if room.document_state:
        try:
            await websocket.send_bytes(room.document_state)
        except Exception:
            pass

    try:
        while True:
            data = await websocket.receive_bytes()
            room.document_state = data
            await room.broadcast(data, sender=websocket)
    except WebSocketDisconnect:
        room.remove(websocket)
    except Exception:
        room.remove(websocket)
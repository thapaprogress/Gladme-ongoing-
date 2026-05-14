"""
GladME Studio V4 — JWT Authentication
Issue #3 FIX: WebSocket auth uses query param token, not Depends.
"""

from datetime import datetime, timezone, timedelta
import jwt as pyjwt
import bcrypt
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from database import SessionLocal, User
from config import settings

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, role: str = "developer") -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.jwt_expiry_hours)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        decoded = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return decoded
    except pyjwt.InvalidTokenError:
        return {}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    finally:
        db.close()


async def get_ws_user(token: str):
    """
    Issue #3 FIX: WebSocket authentication via query parameter token.
    FastAPI WebSockets don't support Depends() directly.
    """
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user:
            return None
        return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    finally:
        db.close()

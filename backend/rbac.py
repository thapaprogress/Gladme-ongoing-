"""
GladME Studio V4 — Role-Based Access Control
"""

from functools import wraps
from fastapi import HTTPException, status


ROLE_HIERARCHY = {
    "admin": 3,
    "developer": 2,
    "viewer": 1,
}


def require_role(min_role: str):
    def decorator(func):
        async def wrapper(*args, user=None, **kwargs):
            if user is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
            user_level = ROLE_HIERARCHY.get(user.get("role", "viewer"), 0)
            required_level = ROLE_HIERARCHY.get(min_role, 99)
            if user_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{min_role}' required. You have '{user.get('role', 'viewer')}'",
                )
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator

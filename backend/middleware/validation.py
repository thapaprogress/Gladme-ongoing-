"""
GladME Studio V4 — Input Validation Middleware
"""

import re
from config import settings


def sanitize_input(text: str) -> str:
    if not text:
        return text
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return sanitized


def validate_length(text: str, field: str) -> tuple[bool, str]:
    limits = {
        "goal": settings.max_goal_length,
        "logic": settings.max_logic_length,
        "code": settings.max_code_length,
        "plan": settings.max_plan_length,
        "evolution": settings.max_evolution_length,
    }
    max_len = limits.get(field, 10000)
    if len(text) > max_len:
        return False, f"{field} exceeds maximum length of {max_len} characters"
    return True, ""


def validate_project_data(data: dict) -> list[str]:
    errors = []
    for field in ["goal", "logic", "plan", "code", "evolution"]:
        value = data.get(field, "")
        if value:
            ok, msg = validate_length(value, field)
            if not ok:
                errors.append(msg)
    return errors

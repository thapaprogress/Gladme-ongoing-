"""
GladME Studio V4 — Centralized Configuration
All secrets from environment variables. Never hardcode.
Issue #6 FIX: API keys are server-only, never exposed to frontend.
SECURITY FIX: Refuse to start with default JWT secret in production.
"""

import os
import sys
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    database_url: str = "sqlite:///./gladme_v4.db"
    jwt_secret: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    ollama_base_url: str = "http://localhost:11434"
    default_model: str = "gemma4:latest"

    sandbox_type: str = "docker"

    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None

    mcp_servers: str = ""

    rate_limit_per_minute: int = 30

    max_goal_length: int = 5000
    max_logic_length: int = 10000
    max_code_length: int = 50000
    max_plan_length: int = 20000
    max_evolution_length: int = 5000

    env: str = "development"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def mcp_server_dict(self) -> dict:
        if not self.mcp_servers:
            return {}
        result = {}
        for entry in self.mcp_servers.split(";"):
            if "=" in entry:
                name, url = entry.split("=", 1)
                result[name.strip()] = url.strip()
        return result

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

if settings.jwt_secret == "CHANGE-ME-IN-PRODUCTION" and settings.env != "development":
    print("FATAL: JWT_SECRET is set to the default value. Set a secure JWT_SECRET in .env before running in production.")
    sys.exit(1)

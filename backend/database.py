"""
GladME Studio V4 — Database Models
All ORM models with User, Session, ChatMessage tables added.
SECURITY FIX: Added foreign key constraints and indexes.
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
from config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="developer")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    current_phase = Column(String, default="Goal")


class ProjectState(Base):
    __tablename__ = "project_states"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    goal = Column(Text, default="")
    logic = Column(Text, default="")
    plan = Column(Text, default="")
    code = Column(Text, default="")
    evolution = Column(Text, default="")
    tests = Column(Text, default="")
    current_phase = Column(String, default="Goal")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class ProjectVersion(Base):
    __tablename__ = "project_versions"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    goal = Column(Text, default="")
    logic = Column(Text, default="")
    plan = Column(Text, default="")
    code = Column(Text, default="")
    evolution = Column(Text, default="")
    tests = Column(Text, default="")
    current_phase = Column(String, default="Goal")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    action = Column(String, nullable=False)
    module = Column(String, default="System")
    result = Column(String, default="OK")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    """
    Issue #4 FIX: Persistent chat message storage.
    Chat history survives page refresh.
    """
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InstalledSkill(Base):
    __tablename__ = "installed_skills"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    version = Column(String, default="1.0.0")
    category = Column(String, default="custom")
    manifest_json = Column(Text, nullable=False)
    installed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ArtifactHash(Base):
    __tablename__ = "artifact_hashes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    phase = Column(String, nullable=False)
    hash_sha256 = Column(String, nullable=False)
    computed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Artifact(Base):
    __tablename__ = "artifacts"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    name = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    mime_type = Column(String, default="text/plain")
    studio_tab = Column(String, nullable=True)
    read_only = Column(Boolean, default=False)
    generated_by = Column(String, default="user")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))


class DashboardManifest(Base):
    __tablename__ = "dashboard_manifests"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    route = Column(String, nullable=False)
    layout_json = Column(Text, default="{}")
    components_json = Column(Text, default="[]")
    nav_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))


class NavRoute(Base):
    __tablename__ = "nav_routes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    path = Column(String, nullable=False)
    label = Column(String, nullable=False)
    icon = Column(String, default="")
    dashboard_id = Column(Integer, ForeignKey("dashboard_manifests.id"), nullable=True)
    order = Column(Integer, default=0)
    visible = Column(Boolean, default=True)


Base.metadata.create_all(bind=engine)

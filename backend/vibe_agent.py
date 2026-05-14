"""
V5 Vibe Agent — autonomous project builder.
Reads goal/logic/plan/code from project state, executes full Plan→Code→Test pipeline.
Writes generated files to project workspace.
"""

import json
import asyncio
import logging
import pathlib
from datetime import datetime, timezone
from typing import Optional

from database import SessionLocal, Project, ProjectState, DashboardManifest, Artifact, NavRoute, ActivityLog, ChatMessage
from llm_router import LLMRouter

logger = logging.getLogger("vibe_agent")
router = LLMRouter()
WORKSPACES_ROOT = pathlib.Path("workspaces")


class VibeAgent:
    def __init__(self, agent_id: int, project_id: int, task: str, model: str = "gemma4:latest", provider: Optional[str] = None):
        self.agent_id = agent_id
        self.project_id = project_id
        self.task = task
        self.model = model
        self.provider = provider
        self.log = []
        self.status = "planning"
        self.cancelled = False

    def _db(self):
        return SessionLocal()

    def _log(self, msg: str, level: str = "info"):
        entry = {"ts": datetime.now(timezone.utc).isoformat(), "msg": msg, "level": level}
        self.log.append(entry)
        logger.info(f"[vibe:{self.agent_id}] {msg}")

    def _state(self, db):
        return db.query(ProjectState).filter(ProjectState.project_id == self.project_id).first()

    def _update_state(self, db, **kwargs):
        state = self._state(db)
        if not state:
            return
        for k, v in kwargs.items():
            if hasattr(state, k):
                setattr(state, k, v)
        db.commit()

    async def _generate(self, prompt: str) -> str:
        result, _ = await router.generate(
            prompt=prompt,
            model=self.model,
            provider=self.provider,
        )
        return result

    def _write_file(self, path: str, content: str):
        """Write a file to the project workspace."""
        try:
            workspace = WORKSPACES_ROOT / str(self.project_id)
            workspace.mkdir(parents=True, exist_ok=True)
            target = workspace / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            self._log(f"File written: {path}")
        except Exception as e:
            self._log(f"Failed to write {path}: {e}", "warn")

    async def run(self):
        self._log(f"Starting vibe agent for task: {self.task}")
        db = self._db()
        try:
            state = self._state(db)
            goal = self.task or (state.goal if state else "")
            self._log(f"Goal: {goal[:100]}...")

            # Phase 1: Plan
            self.status = "planning"
            self._log("Generating plan...")
            plan = await self._generate(
                f"You are a technical lead. Create a detailed implementation plan for: {goal}"
            )
            self._update_state(db, plan=plan, current_phase="Plan")
            self._write_file("_studio/plan.md", plan)
            self._log("Plan generated.")

            # Phase 2: Code
            self.status = "coding"
            self._log("Generating code...")
            code = await self._generate(
                f"You are a senior developer. Goal: {goal}\nPlan:\n{plan}\n\nWrite the complete code implementation. Output only code with minimal comments."
            )
            self._update_state(db, code=code, current_phase="Code")
            self._write_file("main.py", code)
            self._log("Code generated.")

            # Phase 3: Test
            self.status = "testing"
            self._log("Generating tests...")
            tests = await self._generate(
                f"You are a QA engineer. Code:\n{code}\n\nWrite comprehensive tests for this code. Output test code."
            )
            self._update_state(db, tests=tests, current_phase="Tests")
            self._write_file("tests.py", tests)
            self._log("Tests generated.")

            # Phase 4: Optional — auto-create dashboard if task mentions visualize/data/chart
            keywords = ["dashboard", "chart", "visualize", "graph", "plot", "data"]
            if any(k in self.task.lower() for k in keywords):
                self._log("Task mentions visualization — creating dashboard...")
                await self._create_dashboard(db, goal, code)

            # Phase 5: Verify
            self._log("Verifying implementation...")
            self.status = "done"
            self._update_state(db, current_phase="Verify")
            log = ActivityLog(project_id=self.project_id, action=f"Vibe Agent completed: {self.task[:50]}", module="VibeAgent")
            db.add(log)
            db.commit()
            self._log("Agent completed successfully.")

        except asyncio.CancelledError:
            self.status = "cancelled"
            self._log("Agent cancelled.", "warn")
            raise
        except Exception as e:
            self.status = "error"
            self._log(f"Unexpected error: {e}", "error")
        finally:
            db.close()

    async def _create_dashboard(self, db, goal: str, code: str):
        """Auto-create dashboard with relevant charts when task is visualization-related."""
        try:
            # Create dashboard record
            name = f"Vibe: {self.task[:30]}"
            route = f"/dashboards/vibe-{self.agent_id}"
            dash = DashboardManifest(
                project_id=self.project_id,
                name=name,
                route=route,
                layout_json=json.dumps({"columns": 2}),
                components_json=json.dumps([
                    {"id": "auto-1", "type": "line_chart", "title": "Trend", "config": {}},
                    {"id": "auto-2", "type": "kpi", "title": "Score", "config": {"value": "N/A"}},
                ]),
                nav_order=0,
            )
            db.add(dash)
            db.flush()

            # Create nav route
            nav = NavRoute(
                project_id=self.project_id,
                path=route,
                label=name,
                icon="🤖",
                dashboard_id=dash.id,
                order=0,
                visible=True,
            )
            db.add(nav)

            # Register artifact
            art = Artifact(
                project_id=self.project_id,
                kind="dashboard",
                name=name,
                file_name=f"dashboards/vibe-{self.agent_id}.json",
                studio_tab="dashboard",
                read_only=False,
                generated_by="vibe_agent",
            )
            db.add(art)
            db.commit()
            self._log(f"Dashboard '{name}' created (id={dash.id})")
        except Exception as e:
            self._log(f"Dashboard creation failed: {e}", "error")

    def to_dict(self):
        return {
            "id": self.agent_id,
            "project_id": self.project_id,
            "task": self.task,
            "status": self.status,
            "log": self.log,
            "model": self.model,
            "provider": self.provider,
        }


# In-memory agent registry
_active_agents = {}
_active_tasks = {}


async def launch_vibe_agent(project_id: int, task: str, model: str = "gemma4:latest", provider: Optional[str] = None) -> dict:
    """Launch a new vibe agent and run it in background."""
    db = SessionLocal()
    try:
        from main import _next_agent_id
        agent_id = _next_agent_id()
    finally:
        db.close()

    agent = VibeAgent(agent_id, project_id, task, model, provider)
    _active_agents[agent_id] = agent

    # Run in background
    task = asyncio.create_task(agent.run())
    task.add_done_callback(lambda _task, aid=agent_id: _active_tasks.pop(aid, None))
    _active_tasks[agent_id] = task
    return agent.to_dict()


def get_vibe_agent(agent_id: int) -> Optional[dict]:
    agent = _active_agents.get(agent_id)
    return agent.to_dict() if agent else None


def cancel_vibe_agent(agent_id: int) -> bool:
    agent = _active_agents.get(agent_id)
    if agent:
        agent.status = "cancelled"
        task = _active_tasks.pop(agent_id, None)
        if task and not task.done():
            task.cancel()
        return True
    return False

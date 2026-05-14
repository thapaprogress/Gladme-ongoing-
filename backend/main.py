"""
GladME Studio V5 — Main FastAPI Application
All endpoints, WebSocket handlers, with fixes for Issues #1-6.
"""

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from string import Template
import asyncio
import io
import json
import zipfile

from config import settings
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_ws_user,
)
from database import (
    get_db, SessionLocal,
    User, Session as SessionModel, Project, ProjectState, ProjectVersion,
    ActivityLog, ChatMessage, InstalledSkill, ArtifactHash,
    Artifact, DashboardManifest, NavRoute,
)
from sandbox.docker_sandbox import get_sandbox
from middleware.validation import sanitize_input, validate_project_data
from middleware.ratelimit import limiter
from llm_router import llm_router
from verifier import verify_project_state
from test_engine import generate_tests
from chat_engine import ChatEngine
from collab import collab_endpoint
from vibe_agent import launch_vibe_agent, get_vibe_agent, cancel_vibe_agent
from skills.skill_registry import (
    get_all_skills, get_skill, execute_skill, install_skill, uninstall_skill,
)
from mcp.server import get_mcp_tools_list, get_mcp_resources_list
from mcp.client import mcp_client
from provenance.provenance import (
    store_artifact_hash, verify_artifact_integrity,
    generate_sbom, generate_compliance_report,
)

app = FastAPI(title="GladME Studio V5", version="5.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter


# ══════════════════════════════════════════════
# Pydantic Schemas
# ══════════════════════════════════════════════

class AuthRegister(BaseModel):
    email: str
    password: str
    name: str

class AuthLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    title: str

class ProjectStateUpdate(BaseModel):
    goal: Optional[str] = ""
    logic: Optional[str] = ""
    plan: Optional[str] = ""
    code: Optional[str] = ""
    evolution: Optional[str] = ""
    tests: Optional[str] = ""
    current_phase: Optional[str] = "Goal"

class GenerateRequest(BaseModel):
    goal: str
    logic: str
    plan: Optional[str] = ""
    code: Optional[str] = ""
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class VerifyRequest(BaseModel):
    goal: str = ""
    logic: str = ""
    plan: str = ""
    code: str = ""
    tests: str = ""

class ExecuteRequest(BaseModel):
    code: str
    timeout: Optional[int] = 30

class ExecuteTestsRequest(BaseModel):
    code: str
    tests: str
    timeout: Optional[int] = 45

class ChatRequest(BaseModel):
    message: str
    goal: Optional[str] = ""
    logic: Optional[str] = ""
    plan: Optional[str] = ""
    code: Optional[str] = ""
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class LogCreate(BaseModel):
    project_id: Optional[int] = None
    action: str
    module: Optional[str] = "System"
    result: Optional[str] = "OK"

class SkillInstallRequest(BaseModel):
    manifest_json: str

class SkillExecuteRequest(BaseModel):
    skill_name: str
    project_state: dict
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class MCPCallRequest(BaseModel):
    server_name: str
    tool_name: str
    arguments: dict

class AgentCreate(BaseModel):
    project_id: int
    task: str
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None


class TemplateCreate(BaseModel):
    title: str
    template_id: str


class DashboardCreate(BaseModel):
    name: str
    route: Optional[str] = None
    layout_json: Optional[str] = "{}"
    components_json: Optional[str] = "[]"
    nav_order: Optional[int] = 0

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    route: Optional[str] = None
    layout_json: Optional[str] = None
    components_json: Optional[str] = None
    nav_order: Optional[int] = None


class DashboardComponentUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    query: Optional[str] = None
    config_json: Optional[str] = None
    position_json: Optional[str] = None


class NavRouteUpdate(BaseModel):
    routes: list


# ══════════════════════════════════════════════
# Auth Endpoints
# ══════════════════════════════════════════════

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: AuthRegister):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user = User(
            email=data.email,
            name=data.name,
            password_hash=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id, user.role)
        return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}, "token": token}
    finally:
        db.close()


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, data: AuthLogin):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == data.email).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(user.id, user.role)
        return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}, "token": token}
    finally:
        db.close()


@app.get("/api/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ══════════════════════════════════════════════
# System / Health — Issue #6 FIX: no API keys exposed
# ══════════════════════════════════════════════

@app.get("/api/health")
async def health():
    provider_status = await llm_router.get_provider_status()
    return {
        "status": "ok",
        "version": "5.0.0",
        "providers": provider_status,
    }


# ══════════════════════════════════════════════
# Project CRUD (auth-protected)
# ══════════════════════════════════════════════

@app.get("/api/projects")
def get_projects(user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.owner_id == user["id"]).order_by(Project.created_at.desc()).all()
        return [
            {"id": p.id, "title": p.title, "currentPhase": p.current_phase,
             "createdAt": p.created_at.isoformat() if p.created_at else None}
            for p in projects
        ]
    finally:
        db.close()


@app.post("/api/projects")
def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = Project(title=data.title, owner_id=user["id"])
        db.add(project)
        db.commit()
        db.refresh(project)
        state = ProjectState(project_id=project.id)
        db.add(state)
        log = ActivityLog(project_id=project.id, action=f"Project '{data.title}' created", module="ProjectManager")
        db.add(log)
        db.commit()
        return {"id": project.id, "title": project.title, "currentPhase": project.current_phase}
    finally:
        db.close()


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user["id"]).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        db.query(ProjectState).filter(ProjectState.project_id == project_id).delete()
        db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id).delete()
        db.query(ActivityLog).filter(ActivityLog.project_id == project_id).delete()
        db.query(ChatMessage).filter(ChatMessage.project_id == project_id).delete()
        db.query(ArtifactHash).filter(ArtifactHash.project_id == project_id).delete()
        db.delete(project)
        db.commit()
        return {"status": "deleted", "id": project_id}
    finally:
        db.close()


# ══════════════════════════════════════════════
# Project State
# ══════════════════════════════════════════════

def _verify_project_owner(project_id: int, user: dict, db):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user["id"]).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/projects/{project_id}/state")
def get_project_state(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            return {"goal": "", "logic": "", "plan": "", "code": "", "evolution": "", "tests": "", "currentPhase": "Goal"}
        return {
            "goal": state.goal or "", "logic": state.logic or "",
            "plan": state.plan or "", "code": state.code or "",
            "evolution": state.evolution or "", "tests": state.tests or "",
            "currentPhase": state.current_phase or "Goal",
        }
    finally:
        db.close()


@app.put("/api/projects/{project_id}/state")
def update_project_state(project_id: int, data: ProjectStateUpdate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        errors = validate_project_data(data.dict())
        if errors:
            raise HTTPException(status_code=422, detail=errors)

        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            state = ProjectState(project_id=project_id)
            db.add(state)

        state.goal = sanitize_input(data.goal)
        state.logic = sanitize_input(data.logic)
        state.plan = sanitize_input(data.plan)
        state.code = sanitize_input(data.code)
        state.evolution = sanitize_input(data.evolution)
        state.tests = sanitize_input(data.tests)
        state.current_phase = sanitize_input(data.current_phase)
        state.updated_at = datetime.now(timezone.utc)

        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.current_phase = data.current_phase

        for phase_name, content in [("goal", data.goal), ("logic", data.logic),
                                     ("plan", data.plan), ("code", data.code),
                                     ("tests", data.tests)]:
            if content and content.strip():
                store_artifact_hash(project_id, phase_name, content)

        db.commit()
        return {"status": "saved"}
    finally:
        db.close()


# ══════════════════════════════════════════════
# AI Generation — Issue #5 FIX: Full fallback chain
# ══════════════════════════════════════════════

PLAN_PROMPT = Template("""You are an expert software architect using the GladME framework.
Given the following Goal and Logic, generate a detailed, structured development plan.

## Goal
$goal

## Logic
$logic

Create a plan with: Architecture Overview, Module Breakdown, Data Flow, Implementation Steps, Tech Stack, Risk Assessment.
Be specific, actionable, and thorough. Format with markdown.""")

CODE_PROMPT = Template("""You are an expert software developer using the GladME framework.
Given the Goal, Logic, and Plan below, generate production-quality Python code.

## Goal
$goal

## Logic
$logic

## Plan
$plan

Include: imports, classes with docstrings, main entry point, error handling, type hints.
Output ONLY Python code, no explanations.""")

EVOLUTION_PROMPT = Template("""You are the Evolution Agent in the GladME framework.
Analyze the current project and suggest improvements.

## Goal
$goal

## Logic
$logic

## Plan Summary
$plan

## Code Summary
$code

Suggest: Performance Improvements, Architecture Refinements, New Features, Bug Prevention, Next Evolution Note.
Be concise and actionable.""")


@app.post("/api/generate/plan")
@limiter.limit("15/minute")
async def api_generate_plan(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = PLAN_PROMPT.safe_substitute(goal=data.goal, logic=data.logic)
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"plan": result, "model": data.model, "provider": provider}


@app.post("/api/generate/code")
@limiter.limit("15/minute")
async def api_generate_code(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = CODE_PROMPT.safe_substitute(goal=data.goal, logic=data.logic, plan=data.plan)
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"code": result, "model": data.model, "provider": provider}


@app.post("/api/generate/evolution")
@limiter.limit("15/minute")
async def api_suggest_evolution(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = EVOLUTION_PROMPT.safe_substitute(
        goal=data.goal, logic=data.logic,
        plan=data.plan[:1000], code=data.code[:1000],
    )
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"suggestions": result, "model": data.model, "provider": provider}


@app.post("/api/generate/tests")
@limiter.limit("15/minute")
async def api_generate_tests(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    result, provider = await generate_tests(
        data.goal, data.logic, data.plan, data.code, data.model, data.provider,
    )
    return {"tests": result, "model": data.model, "provider": provider}


# ══════════════════════════════════════════════
# SSE Streaming Generation — V5 Phase 4
# ══════════════════════════════════════════════

async def _sse_stream(prompt: str, model: str, provider: Optional[str]):
    async for chunk in llm_router.generate_stream(prompt, model, provider):
        if "token" in chunk:
            yield f"data: {json.dumps({'token': chunk['token'], 'provider': chunk.get('provider', '')})}\n\n"
        elif "done" in chunk:
            yield f"data: {json.dumps({'done': True, 'provider': chunk.get('provider', '')})}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/api/generate/plan/stream")
@limiter.limit("15/minute")
async def api_generate_plan_stream(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = PLAN_PROMPT.safe_substitute(goal=data.goal, logic=data.logic)
    return StreamingResponse(_sse_stream(prompt, data.model, data.provider), media_type="text/event-stream")


@app.post("/api/generate/code/stream")
@limiter.limit("15/minute")
async def api_generate_code_stream(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = CODE_PROMPT.safe_substitute(goal=data.goal, logic=data.logic, plan=data.plan)
    return StreamingResponse(_sse_stream(prompt, data.model, data.provider), media_type="text/event-stream")


@app.post("/api/generate/evolution/stream")
@limiter.limit("15/minute")
async def api_suggest_evolution_stream(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = EVOLUTION_PROMPT.safe_substitute(
        goal=data.goal, logic=data.logic,
        plan=data.plan[:1000], code=data.code[:1000],
    )
    return StreamingResponse(_sse_stream(prompt, data.model, data.provider), media_type="text/event-stream")


# ══════════════════════════════════════════════
# Verification
# ══════════════════════════════════════════════

@app.post("/api/verify")
async def api_verify(data: VerifyRequest, user=Depends(get_current_user)):
    return verify_project_state(data.goal, data.logic, data.plan, data.code, data.tests)


# ══════════════════════════════════════════════
# Code Execution — Issue #1 FIX: Docker sandbox with pytest
# ══════════════════════════════════════════════

@app.post("/api/execute")
async def execute_code(data: ExecuteRequest, user=Depends(get_current_user)):
    sandbox = get_sandbox()
    return await sandbox.execute(data.code, data.timeout)


@app.post("/api/execute/tests")
async def execute_tests(data: ExecuteTestsRequest, user=Depends(get_current_user)):
    sandbox = get_sandbox()
    if hasattr(sandbox, "execute_tests"):
        return await sandbox.execute_tests(data.code, data.tests, data.timeout)
    return {"stdout": "", "stderr": "Test execution requires Docker sandbox", "exit_code": -1, "status": "error",
            "test_results": None, "coverage": None}


# ══════════════════════════════════════════════
# Chat — Issue #3 FIX: WebSocket auth via query param
# ══════════════════════════════════════════════

@app.post("/api/chat")
async def api_chat(data: ChatRequest, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.owner_id == user["id"]).order_by(Project.id.desc()).first()
        project_id = project.id if project else 0
    finally:
        db.close()

    if project_id == 0:
        raise HTTPException(status_code=400, detail="No project found. Create a project first.")

    engine = ChatEngine(project_id)
    response, provider = await engine.chat(
        data.message, data.goal, data.logic, data.plan, data.code, data.model, data.provider,
    )
    return {"response": response, "provider": provider}


@app.get("/api/chat/history/{project_id}")
async def api_chat_history(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
    finally:
        db.close()
    engine = ChatEngine(project_id)
    return {"messages": engine.get_history()}


@app.delete("/api/chat/history/{project_id}")
async def api_chat_clear(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
    finally:
        db.close()
    engine = ChatEngine(project_id)
    engine.clear_history()
    return {"status": "cleared"}


@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket, token: str = Query(default="")):
    """
    Issue #3 FIX: WebSocket authentication via query parameter token.
    Example: ws://localhost:8001/ws/chat?token=<jwt_token>
    """
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    project_id = 0

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            user_msg = payload.get("message", "")
            goal = payload.get("goal", "")
            logic = payload.get("logic", "")
            plan = payload.get("plan", "")
            code = payload.get("code", "")
            model = payload.get("model", "gemma4:latest")
            provider = payload.get("provider")

            pid = payload.get("projectId", 0)
            if pid:
                db_check = SessionLocal()
                try:
                    own = db_check.query(Project).filter(Project.id == pid, Project.owner_id == user["id"]).first()
                    if not own:
                        await websocket.send_json({"type": "error", "message": "Project not found"})
                        continue
                finally:
                    db_check.close()
                project_id = pid

            engine = ChatEngine(project_id)
            response, used_provider = await engine.chat(
                user_msg, goal, logic, plan, code, model, provider,
            )

            await websocket.send_json({
                "type": "message",
                "content": response,
                "provider": used_provider,
            })
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass


@app.websocket("/ws/execute")
async def ws_execute(websocket: WebSocket, token: str = Query(default="")):
    """
    Issue #3 FIX: WebSocket auth via query param.
    """
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            code = payload.get("code", "")

            sandbox = get_sandbox()
            result = await sandbox.execute(code, timeout=15)
            await websocket.send_json({
                "type": "result",
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code", -1),
                "status": result.get("status", "error"),
            })
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket, token: str = Query(default=""), project_id: int = Query(default=0)):
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    
    cwd = None
    if project_id:
        workspace_dir = _project_workspace(project_id)
        workspace_dir.mkdir(parents=True, exist_ok=True)
        cwd = str(workspace_dir)

    import sys
    import os
    import shutil
    import asyncio
    
    try:
        # Resolve shell path
        if sys.platform == "win32":
            # Windows: Use pywinpty if available
            try:
                from winpty import PtyProcess
                shell_path = shutil.which("powershell.exe") or shutil.which("cmd.exe") or os.environ.get("COMSPEC", "cmd.exe")
                # Try Git Bash if available
                git_bash = "C:\\Program Files\\Git\\bin\\bash.exe"
                if os.path.exists(git_bash):
                    shell_path = git_bash
                    
                process = PtyProcess.spawn(shell_path, cwd=cwd, env=os.environ.copy())
                
                async def read_pty():
                    try:
                        while process.isalive():
                            # Use thread pool to avoid blocking async loop on winpty read
                            data = await asyncio.get_event_loop().run_in_executor(None, lambda: process.read(1024))
                            if data:
                                await websocket.send_text(data)
                            else:
                                await asyncio.sleep(0.01)
                    except Exception as e:
                        print(f"[TERMINAL_READ_ERROR] {e}")
                    finally:
                        try:
                            await websocket.close()
                        except:
                            pass

                async def write_pty():
                    try:
                        while process.isalive():
                            data = await websocket.receive_text()
                            if data:
                                # Handle resize message
                                if data.startswith('{"resize":'):
                                    import json
                                    res = json.loads(data)
                                    process.set_size(res["resize"]["cols"], res["resize"]["rows"])
                                else:
                                    process.write(data)
                    except Exception as e:
                        # print(f"[TERMINAL_WRITE_ERROR] {e}")
                        pass

                await asyncio.gather(read_pty(), write_pty())
                if process.isalive():
                    process.terminate()
                return
            except ImportError:
                # Fallback handled below
                pass

        # Unix / Fallback Windows logic
        if sys.platform != "win32":
            import pty
            import termios
            import struct
            import fcntl
            
            master_fd, slave_fd = pty.openpty()
            shell_path = shutil.which("bash") or shutil.which("sh") or "/bin/bash"
            
            process = await asyncio.create_subprocess_exec(
                shell_path,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=cwd,
                env=os.environ.copy(),
                preexec_fn=os.setsid
            )
            os.close(slave_fd)
            
            async def read_pty():
                try:
                    while True:
                        loop = asyncio.get_event_loop()
                        data = await loop.run_in_executor(None, lambda: os.read(master_fd, 1024))
                        if not data:
                            break
                        await websocket.send_text(data.decode("utf-8", errors="replace"))
                except Exception:
                    pass

            async def write_pty():
                try:
                    while True:
                        data = await websocket.receive_text()
                        if data:
                            if data.startswith('{"resize":'):
                                import json
                                res = json.loads(data)
                                cols, rows = res["resize"]["cols"], res["resize"]["rows"]
                                s = struct.pack('HHHH', rows, cols, 0, 0)
                                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, s)
                            else:
                                os.write(master_fd, data.encode("utf-8"))
                except Exception:
                    pass

            await asyncio.gather(read_pty(), write_pty())
            os.close(master_fd)
        else:
            # Simple Subprocess fallback for Windows if winpty fails
            shell_path = shutil.which("powershell.exe") or shutil.which("cmd.exe")
            process = await asyncio.create_subprocess_exec(
                shell_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=cwd,
                env=os.environ.copy()
            )
            async def read_stdout():
                while True:
                    data = await process.stdout.read(1024)
                    if not data: break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
            async def write_stdin():
                while True:
                    data = await websocket.receive_text()
                    if data:
                        process.stdin.write(data.encode("utf-8"))
                        await process.stdin.drain()
            await asyncio.gather(read_stdout(), write_stdin())
            
    except Exception as e:
        await websocket.send_text(f"\x1b[31mTerminal Error: {e}\x1b[0m\r\n")
        await websocket.close()
    
    try:
        process.terminate()
    except Exception:
        pass


# ══════════════════════════════════════════════
# Collaborative Editing WebSocket (V5 Phase 4)
# ══════════════════════════════════════════════

@app.websocket("/ws/collab")
async def ws_collab(websocket: WebSocket, token: str = Query(default="")):
    await collab_endpoint(websocket, token=token)


# ══════════════════════════════════════════════
# Versions
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/versions")
def get_versions(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        versions = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
        ).order_by(ProjectVersion.version_number.desc()).all()
        return [
            {"id": v.id, "versionNumber": v.version_number, "currentPhase": v.current_phase,
             "evolution": v.evolution, "createdAt": v.created_at.isoformat() if v.created_at else None}
            for v in versions
        ]
    finally:
        db.close()


@app.post("/api/projects/{project_id}/versions")
def create_version(project_id: int, data: ProjectStateUpdate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        latest = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
        ).order_by(ProjectVersion.version_number.desc()).first()
        next_num = (latest.version_number + 1) if latest else 1

        version = ProjectVersion(
            project_id=project_id, version_number=next_num,
            goal=data.goal, logic=data.logic, plan=data.plan,
            code=data.code, evolution=data.evolution, tests=data.tests,
            current_phase=data.current_phase,
        )
        db.add(version)
        log = ActivityLog(project_id=project_id, action=f"Version v{next_num} saved",
                          module="EvolutionEngine", result="Success")
        db.add(log)
        db.commit()
        db.refresh(version)
        return {"id": version.id, "versionNumber": next_num}
    finally:
        db.close()


@app.get("/api/projects/{project_id}/versions/{version_id}")
def get_version_detail(project_id: int, version_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        v = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
            ProjectVersion.id == version_id,
        ).first()
        if not v:
            raise HTTPException(status_code=404, detail="Version not found")
        return {
            "id": v.id, "versionNumber": v.version_number,
            "goal": v.goal, "logic": v.logic, "plan": v.plan,
            "code": v.code, "evolution": v.evolution, "tests": v.tests,
            "currentPhase": v.current_phase,
            "createdAt": v.created_at.isoformat() if v.created_at else None,
        }
    finally:
        db.close()


# ══════════════════════════════════════════════
# Version Diff (V5 Phase 5)
# ══════════════════════════════════════════════

class VersionDiffRequest(BaseModel):
    version_id_a: int
    version_id_b: int

@app.post("/api/projects/{project_id}/versions/diff")
def api_version_diff(project_id: int, data: VersionDiffRequest, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        va = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
            ProjectVersion.id == data.version_id_a,
        ).first()
        vb = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
            ProjectVersion.id == data.version_id_b,
        ).first()
        if not va or not vb:
            raise HTTPException(status_code=404, detail="Version not found")

        def _diff_lines(old, new):
            old_lines = (old or "").splitlines()
            new_lines = (new or "").splitlines()
            result = []
            import difflib
            sm = difflib.SequenceMatcher(None, old_lines, new_lines)
            for op, i1, i2, j1, j2 in sm.get_opcodes():
                if op == "equal":
                    for k in range(i1, i2):
                        result.append({"type": "unchanged", "num": k + 1, "line": old_lines[k]})
                elif op == "replace":
                    for k in range(i1, i2):
                        result.append({"type": "removed", "num": k + 1, "line": old_lines[k]})
                    for k in range(j1, j2):
                        result.append({"type": "added", "num": k + 1, "line": new_lines[k]})
                elif op == "delete":
                    for k in range(i1, i2):
                        result.append({"type": "removed", "num": k + 1, "line": old_lines[k]})
                elif op == "insert":
                    for k in range(j1, j2):
                        result.append({"type": "added", "num": k + 1, "line": new_lines[k]})
            return result

        return {
            "version_a": {"id": va.id, "number": va.version_number, "date": va.created_at.isoformat() if va.created_at else None},
            "version_b": {"id": vb.id, "number": vb.version_number, "date": vb.created_at.isoformat() if vb.created_at else None},
            "diff_code": _diff_lines(va.code, vb.code),
            "diff_plan": _diff_lines(va.plan, vb.plan),
            "summary": {
                "code_added": sum(1 for l in _diff_lines(va.code, vb.code) if l["type"] == "added"),
                "code_removed": sum(1 for l in _diff_lines(va.code, vb.code) if l["type"] == "removed"),
            },
        }
    finally:
        db.close()


# ══════════════════════════════════════════════
# Activity Logs
# ══════════════════════════════════════════════

@app.get("/api/logs")
def get_logs(project_id: Optional[int] = None, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        query = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc())
        if project_id:
            query = query.filter(ActivityLog.project_id == project_id)
        logs = query.limit(100).all()
        return [
            {"id": l.id, "projectId": l.project_id, "action": l.action,
             "module": l.module, "result": l.result,
             "timestamp": l.timestamp.isoformat() if l.timestamp else None}
            for l in logs
        ]
    finally:
        db.close()


@app.post("/api/logs")
def create_log(data: LogCreate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        log = ActivityLog(project_id=data.project_id, action=data.action,
                          module=data.module, result=data.result)
        db.add(log)
        db.commit()
        return {"status": "logged"}
    finally:
        db.close()


# ══════════════════════════════════════════════
# Export
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/export")
def export_project(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("goal.md", f"# Goal\n\n{state.goal if state else ''}")
            z.writestr("logic.md", f"# Logic\n\n{state.logic if state else ''}")
            z.writestr("plan.md", f"# Plan\n\n{state.plan if state else ''}")
            z.writestr("main.py", state.code if state else "# No code generated yet")
            if state and state.tests:
                z.writestr("test_main.py", state.tests)
            z.writestr("evolution.md", f"# Evolution Notes\n\n{state.evolution if state else ''}")
            z.writestr("README.md", f"# {project.title}\n\nGenerated by GladME Studio V5\n\nPhase: {state.current_phase if state else 'Goal'}")
        buf.seek(0)
        return StreamingResponse(
            buf, media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=gladme_{project.title.replace(' ', '_')}.zip"},
        )
    finally:
        db.close()


# ══════════════════════════════════════════════
# Skills Endpoints
# ══════════════════════════════════════════════

@app.get("/api/skills")
def api_list_skills(user=Depends(get_current_user)):
    return get_all_skills()


@app.get("/api/skills/{skill_name}")
def api_get_skill(skill_name: str, user=Depends(get_current_user)):
    skill = get_skill(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill.to_dict()


@app.post("/api/skills/install")
def api_install_skill(data: SkillInstallRequest, user=Depends(get_current_user)):
    result = install_skill(data.manifest_json)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.delete("/api/skills/{skill_name}")
def api_uninstall_skill(skill_name: str, user=Depends(get_current_user)):
    result = uninstall_skill(skill_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/skills/execute")
async def api_execute_skill(data: SkillExecuteRequest, user=Depends(get_current_user)):
    result = await execute_skill(data.skill_name, data.project_state, data.model, data.provider)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ══════════════════════════════════════════════
# MCP Endpoints
# ══════════════════════════════════════════════

@app.get("/api/mcp/tools")
def api_mcp_tools(user=Depends(get_current_user)):
    return get_mcp_tools_list()


@app.get("/api/mcp/resources")
def api_mcp_resources(user=Depends(get_current_user)):
    return get_mcp_resources_list()


@app.get("/api/mcp/servers")
async def api_mcp_servers(user=Depends(get_current_user)):
    return await mcp_client.list_servers()


@app.get("/api/mcp/servers/{server_name}/tools")
async def api_mcp_server_tools(server_name: str, user=Depends(get_current_user)):
    tools = await mcp_client.list_server_tools(server_name)
    return tools


@app.post("/api/mcp/call")
async def api_mcp_call(data: MCPCallRequest, user=Depends(get_current_user)):
    result = await mcp_client.call_tool(data.server_name, data.tool_name, data.arguments)
    return result


# ══════════════════════════════════════════════
# Provenance / SBOM
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/sbom")
def api_sbom(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            raise HTTPException(status_code=400, detail="Project has no state")
        state_dict = {
            "goal": state.goal, "logic": state.logic, "plan": state.plan,
            "code": state.code, "tests": state.tests, "evolution": state.evolution,
        }
        sbom = generate_sbom(project_id, project.title, state_dict, "gemma4:latest", "ollama")
        return sbom
    finally:
        db.close()


@app.get("/api/projects/{project_id}/compliance")
def api_compliance(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            raise HTTPException(status_code=400, detail="Project has no state")
        state_dict = {
            "goal": state.goal, "logic": state.logic, "plan": state.plan,
            "code": state.code, "tests": state.tests, "evolution": state.evolution,
        }
        verify_result = verify_project_state(state.goal, state.logic, state.plan, state.code, state.tests)
        report = generate_compliance_report(project_id, state_dict, verify_result=verify_result)
        return report
    finally:
        db.close()


# ══════════════════════════════════════════════
# Project Templates (V5 Phase 4)
# ══════════════════════════════════════════════

TEMPLATES = {
    "flask-api": {
        "id": "flask-api",
        "name": "Flask REST API",
        "description": "Minimal Flask REST API with health check and CRUD endpoints",
        "icon": "🌶️",
        "files": {
            "app.py": '''from flask import Flask, jsonify, request

app = Flask(__name__)

items = []

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "items": len(items)})

@app.route("/api/items", methods=["GET"])
def list_items():
    return jsonify(items)

@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json()
    item = {"id": len(items) + 1, **data}
    items.append(item)
    return jsonify(item), 201

@app.route("/api/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        return jsonify({"error": "Not found"}), 404
    return jsonify(item)

@app.route("/api/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    global items
    items = [i for i in items if i["id"] != item_id]
    return "", 204

if __name__ == "__main__":
    app.run(debug=True, port=5000)
''',
            "requirements.txt": "flask>=3.0\n",
            "README.md": "# Flask REST API\\n\\nMinimal CRUD API built with GladME Studio.\\n\\n```bash\\npip install -r requirements.txt\\npython app.py\\n```\\n",
        },
    },
    "fastapi-app": {
        "id": "fastapi-app",
        "name": "FastAPI Service",
        "description": "Async FastAPI service with Pydantic models and CORS",
        "icon": "⚡",
        "files": {
            "main.py": '''from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="GladME FastAPI Service")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Item(ItemCreate):
    id: int

items_db: list[dict] = []
counter = 0

@app.get("/api/health")
def health():
    return {"status": "ok", "count": len(items_db)}

@app.get("/api/items")
def list_items():
    return items_db

@app.post("/api/items", status_code=201)
def create_item(data: ItemCreate):
    global counter
    counter += 1
    item = {"id": counter, "name": data.name, "description": data.description}
    items_db.append(item)
    return item

@app.get("/api/items/{item_id}")
def get_item(item_id: int):
    item = next((i for i in items_db if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    global items_db
    items_db = [i for i in items_db if i["id"] != item_id]
''',
            "requirements.txt": "fastapi>=0.110\\nuvicorn>=0.29\\n",
            "README.md": "# FastAPI Service\\n\\nAsync API built with GladME Studio.\\n\\n```bash\\npip install -r requirements.txt\\nuvicorn main:app --reload\\n```\\n",
        },
    },
    "cli-tool": {
        "id": "cli-tool",
        "name": "CLI Tool",
        "description": "Python CLI tool with argparse and colored output",
        "icon": "🖥️",
        "files": {
            "cli.py": '''#!/usr/bin/env python3
import argparse
import sys

def main():
    parser = argparse.ArgumentParser(
        prog="gladme-cli",
        description="CLI tool scaffolded by GladME Studio",
    )
    sub = parser.add_subparsers(dest="command")

    hello = sub.add_parser("hello", help="Say hello")
    hello.add_argument("name", nargs="?", default="World", help="Who to greet")

    args = parser.parse_args()

    if args.command == "hello":
        print(f"Hello, {args.name}!")
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
''',
            "requirements.txt": "",
            "README.md": "# CLI Tool\\n\\nPython CLI scaffolded by GladME Studio.\\n\\n```bash\\npython cli.py hello\\npython cli.py hello GladME\\n```\\n",
        },
    },
}


@app.get("/api/templates")
def api_list_templates(user=Depends(get_current_user)):
    return [
        {"id": t["id"], "name": t["name"], "description": t["description"], "icon": t["icon"]}
        for t in TEMPLATES.values()
    ]


@app.post("/api/projects/from-template")
def api_create_from_template(data: TemplateCreate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        template = TEMPLATES.get(data.template_id)
        if not template:
            raise HTTPException(status_code=404, detail=f"Template '{data.template_id}' not found")
        project = Project(title=data.title, owner_id=user["id"])
        db.add(project)
        db.commit()
        db.refresh(project)
        state = ProjectState(project_id=project.id)
        db.add(state)
        log = ActivityLog(project_id=project.id, action=f"Project '{data.title}' created from template '{template['name']}'", module="ProjectManager")
        db.add(log)
        db.commit()
        workspace = _project_workspace(project.id)
        for fname, content in template["files"].items():
            fpath = workspace / fname
            fpath.parent.mkdir(parents=True, exist_ok=True)
            fpath.write_text(content, encoding="utf-8")
        return {
            "id": project.id,
            "title": project.title,
            "currentPhase": project.current_phase,
            "template": data.template_id,
            "files": list(template["files"].keys()),
        }
    finally:
        db.close()


# ══════════════════════════════════════════════
# Artifact Registry Endpoints
# ══════════════════════════════════════════════

@app.get("/api/projects/{pid}/artifacts")
def list_artifacts(pid: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Artifact).filter(Artifact.project_id == pid).order_by(Artifact.created_at).all()
    return [{"id": a.id, "kind": a.kind, "name": a.name, "file_name": a.file_name,
             "mime_type": a.mime_type, "studio_tab": a.studio_tab,
             "read_only": a.read_only, "generated_by": a.generated_by,
             "created_at": a.created_at.isoformat() if a.created_at else None,
             "updated_at": a.updated_at.isoformat() if a.updated_at else None}
            for a in rows]


@app.post("/api/projects/{pid}/artifacts", status_code=201)
def create_artifact(pid: int, kind: str, name: str, file_name: str,
                    studio_tab: Optional[str] = None, mime_type: str = "text/plain",
                    read_only: bool = False, generated_by: str = "user",
                    user=Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == pid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    a = Artifact(project_id=pid, kind=kind, name=name, file_name=file_name,
                 mime_type=mime_type, studio_tab=studio_tab,
                 read_only=read_only, generated_by=generated_by)
    db.add(a)
    db.commit()
    db.refresh(a)
    log = ActivityLog(project_id=pid, action=f"Artifact '{name}' created", module="ArtifactRegistry")
    db.add(log)
    db.commit()
    return {"id": a.id, "kind": a.kind, "name": a.name, "file_name": a.file_name,
            "studio_tab": a.studio_tab, "read_only": a.read_only, "generated_by": a.generated_by}


@app.delete("/api/projects/{pid}/artifacts/{aid}")
def delete_artifact(pid: int, aid: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(Artifact).filter(Artifact.id == aid, Artifact.project_id == pid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Artifact not found")
    db.delete(a)
    log = ActivityLog(project_id=pid, action=f"Artifact '{a.name}' deleted", module="ArtifactRegistry")
    db.add(log)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
# Dashboard CRUD Endpoints
# ══════════════════════════════════════════════

@app.get("/api/projects/{pid}/dashboards")
def list_dashboards(pid: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(DashboardManifest).filter(DashboardManifest.project_id == pid).order_by(DashboardManifest.nav_order).all()
    result = []
    for d in rows:
        comps = json.loads(d.components_json) if d.components_json else []
        layout = json.loads(d.layout_json) if d.layout_json else {}
        nav = db.query(NavRoute).filter(NavRoute.dashboard_id == d.id).first()
        result.append({"id": d.id, "name": d.name, "route": d.route,
                        "layout": layout, "components": comps,
                        "nav_order": d.nav_order, "nav_route": {
                            "path": nav.path, "label": nav.label, "icon": nav.icon, "visible": nav.visible
                        } if nav else None,
                        "created_at": d.created_at.isoformat() if d.created_at else None})
    return result


@app.post("/api/projects/{pid}/dashboards", status_code=201)
def create_dashboard(pid: int, data: DashboardCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == pid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    route = data.route or f"/dashboards/{data.name.lower().replace(' ', '-')}"
    d = DashboardManifest(project_id=pid, name=data.name, route=route,
                           layout_json=data.layout_json, components_json=data.components_json,
                           nav_order=data.nav_order)
    db.add(d)
    db.commit()
    db.refresh(d)
    nav = NavRoute(project_id=pid, path=route, label=data.name, icon="Dashboard",
                   dashboard_id=d.id, order=data.nav_order or 0)
    db.add(nav)
    log = ActivityLog(project_id=pid, action=f"Dashboard '{data.name}' created", module="DashboardManager")
    db.add(log)
    db.commit()
    return {"id": d.id, "name": d.name, "route": route, "nav_route_id": nav.id}


@app.patch("/api/projects/{pid}/dashboards/{did}")
def update_dashboard(pid: int, did: int, data: DashboardUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(DashboardManifest).filter(DashboardManifest.id == did, DashboardManifest.project_id == pid).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if data.name:
        d.name = data.name
    if data.layout_json:
        d.layout_json = data.layout_json
    if data.components_json:
        d.components_json = data.components_json
    if data.nav_order is not None:
        d.nav_order = data.nav_order
    db.commit()
    return {
        "id": d.id,
        "project_id": d.project_id,
        "name": d.name,
        "route": d.route,
        "layout_json": d.layout_json or "{}",
        "components_json": d.components_json or "[]",
        "nav_order": d.nav_order or 0
    }


@app.delete("/api/projects/{pid}/dashboards/{did}")
def delete_dashboard(pid: int, did: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(DashboardManifest).filter(DashboardManifest.id == did, DashboardManifest.project_id == pid).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.query(NavRoute).filter(NavRoute.dashboard_id == did).delete()
    db.delete(d)
    log = ActivityLog(project_id=pid, action=f"Dashboard '{d.name}' deleted", module="DashboardManager")
    db.add(log)
    db.commit()
    return {"ok": True}


@app.get("/api/projects/{pid}/nav-routes")
def list_nav_routes(pid: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(NavRoute).filter(NavRoute.project_id == pid).order_by(NavRoute.order).all()
    return [{"id": r.id, "path": r.path, "label": r.label, "icon": r.icon,
             "dashboard_id": r.dashboard_id, "order": r.order, "visible": r.visible}
            for r in rows]


@app.put("/api/projects/{pid}/nav-routes")
def update_nav_routes(pid: int, data: NavRouteUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(NavRoute).filter(NavRoute.project_id == pid).delete()
    for idx, r in enumerate(data.routes):
        nr = NavRoute(project_id=pid, path=r.get("path", ""), label=r.get("label", ""),
                       icon=r.get("icon", ""), dashboard_id=r.get("dashboard_id"),
                       order=r.get("order", idx), visible=r.get("visible", True))
        db.add(nr)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
# Agent Endpoints (V5 — Mission Control)
# Agents are in-memory; each runs the full Plan→Code→Test pipeline.
# ══════════════════════════════════════════════

import uuid
import threading

_agents: dict = {}  # agent_id -> agent dict
_next_id = 0

def _next_agent_id() -> int:
    global _next_id
    _next_id += 1
    return _next_id


def _agent_status(agent_id: str) -> dict:
    return _agents.get(agent_id, {})

def _run_agent(agent_id: str, project_id: int, task: str, model: str, provider: str | None):
    """Background thread: runs Plan→Code→Test pipeline and streams log."""
    def log(msg: str, phase: str = "running"):
        _agents[agent_id]["logs"].append(msg)
        _agents[agent_id]["phase"] = phase

    try:
        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            log("Project not found.", "error")
            _agents[agent_id]["status"] = "error"
            db.close()
            return

        log(f"Starting agent for: {task}", "planning")
        _agents[agent_id]["status"] = "running"

        # Step 1: Generate plan
        log("Generating plan...", "planning")
        plan_prompt = (
            "You are a software architect. Create a concise implementation plan.\n\n"
            f"Task: {task}"
        )
        plan, plan_provider = asyncio.run(llm_router.generate(
            prompt=plan_prompt,
            model=model,
            provider=provider,
        ))
        log(f"Plan ready ({len(plan)} chars via {plan_provider})", "coding")

        # Step 2: Generate code
        log("Generating code...", "coding")
        code_prompt = (
            "You are an expert programmer. Write clean, working Python code.\n\n"
            f"Task: {task}\nPlan:\n{plan}\n\nWrite the full implementation."
        )
        code, code_provider = asyncio.run(llm_router.generate(
            prompt=code_prompt,
            model=model,
            provider=provider,
        ))
        log(f"Code ready ({len(code)} chars via {code_provider})", "testing")

        # Step 3: Save to project state
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if state:
            state.plan = plan
            state.code = code
            state.current_phase = "Code"
            db.commit()

        # Step 4: Write to workspace
        workspace = WORKSPACES_ROOT / str(project_id)
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "main.py").write_text(code, encoding="utf-8")
        log("Saved main.py to workspace", "testing")

        # Step 5: Run tests in sandbox
        log("Running code in sandbox...", "testing")
        sandbox = get_sandbox()
        result = sandbox.run_code(code, timeout=30)
        exit_code = result.get("exit_code", -1)
        if exit_code == 0:
            log(f"Sandbox OK (exit 0)\n{result.get('stdout','')[:500]}", "done")
        else:
            log(f"Sandbox exit {exit_code}\n{result.get('stderr','')[:500]}", "done")

        _agents[agent_id]["status"] = "done"
        _agents[agent_id]["phase"] = "done"
        _agents[agent_id]["code"] = code
        _agents[agent_id]["plan"] = plan

        db_log = ActivityLog(
            project_id=project_id,
            action=f"Agent completed: {task[:60]}",
            module="AgentRunner",
            result="Success" if exit_code == 0 else "Warning",
        )
        db.add(db_log)
        db.commit()
        db.close()

    except Exception as exc:
        _agents[agent_id]["logs"].append(f"Error: {exc}")
        _agents[agent_id]["status"] = "error"
        _agents[agent_id]["phase"] = "error"


@app.post("/api/agents")
def api_create_agent(body: AgentCreate, user=Depends(get_current_user)):
    _verify_project_owner(body.project_id, user, SessionLocal())
    agent_id = str(uuid.uuid4())[:8]
    _agents[agent_id] = {
        "id": agent_id,
        "project_id": body.project_id,
        "task": body.task,
        "status": "queued",
        "phase": "queued",
        "logs": [f"Agent {agent_id} queued: {body.task}"],
        "code": None,
        "plan": None,
    }
    t = threading.Thread(
        target=_run_agent,
        args=(agent_id, body.project_id, body.task, body.model, body.provider),
        daemon=True,
    )
    t.start()
    return _agents[agent_id]


@app.get("/api/agents")
def api_list_agents(project_id: Optional[int] = None, user=Depends(get_current_user)):
    agents = list(_agents.values())
    if project_id is not None:
        agents = [a for a in agents if a["project_id"] == project_id]
    return agents


@app.get("/api/agents/{agent_id}")
def api_get_agent(agent_id: str, user=Depends(get_current_user)):
    if agent_id not in _agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agents[agent_id]


@app.delete("/api/agents/{agent_id}")
def api_delete_agent(agent_id: str, user=Depends(get_current_user)):
    if agent_id not in _agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    del _agents[agent_id]
    return {"status": "removed"}


@app.post("/api/agents/vibe")
async def api_launch_vibe(project_id: int, task: str, model: str = "gemma4:latest", provider: str = None, user=Depends(get_current_user)):
    agent = await launch_vibe_agent(project_id, task, model, provider)
    return agent


@app.get("/api/agents/vibe/{agent_id}")
def api_get_vibe(agent_id: int, user=Depends(get_current_user)):
    agent = get_vibe_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Vibe agent not found")
    return agent


@app.delete("/api/agents/vibe/{agent_id}")
def api_cancel_vibe(agent_id: int, user=Depends(get_current_user)):
    if cancel_vibe_agent(agent_id):
        return {"status": "cancelled"}
    raise HTTPException(status_code=404, detail="Vibe agent not found")


# ══════════════════════════════════════════════
# File System Endpoints (V5 — Coder Tab)
# Files are stored under ./workspaces/<project_id>/
# ══════════════════════════════════════════════

import pathlib
import shutil
import os

WORKSPACES_ROOT = pathlib.Path("workspaces")

FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "")

if FRONTEND_DIST and pathlib.Path(FRONTEND_DIST).exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/assets", StaticFiles(directory=str(pathlib.Path(FRONTEND_DIST) / "assets")), name="assets")
    _frontend_dir = pathlib.Path(FRONTEND_DIST)

def _project_workspace(project_id: int) -> pathlib.Path:
    path = WORKSPACES_ROOT / str(project_id)
    path.mkdir(parents=True, exist_ok=True)
    return path

def _safe_path(workspace: pathlib.Path, rel_path: str) -> pathlib.Path:
    """Resolve rel_path inside workspace; raise 400 if path escapes root."""
    target = (workspace / rel_path).resolve()
    if not str(target).startswith(str(workspace.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target

def _build_tree(root: pathlib.Path, base: pathlib.Path) -> list:
    nodes = []
    try:
        entries = sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name))
    except PermissionError:
        return nodes
    for entry in entries:
        rel = str(entry.relative_to(base)).replace("\\", "/")
        if entry.is_dir():
            nodes.append({
                "name": entry.name,
                "path": rel,
                "type": "directory",
                "children": _build_tree(entry, base),
            })
        else:
            nodes.append({
                "name": entry.name,
                "path": rel,
                "type": "file",
                "size": entry.stat().st_size,
            })
    return nodes


class FileCreate(BaseModel):
    path: str
    content: Optional[str] = ""

class FileUpdate(BaseModel):
    path: str
    content: str


@app.get("/api/projects/{project_id}/preview/{path:path}")
async def preview_project_file(project_id: int, path: str):
    workspace = _project_workspace(project_id)
    file_path = workspace / path
    if not file_path.exists() or not file_path.is_file():
        return {"error": "File not found"}
    
    from fastapi.responses import FileResponse
    import mimetypes
    
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=mime_type or "application/octet-stream")

@app.get("/api/projects/{project_id}/files")
def api_list_files(project_id: int, user=Depends(get_current_user)):
    _verify_project_owner(project_id, user, SessionLocal())
    workspace = _project_workspace(project_id)
    return {"tree": _build_tree(workspace, workspace)}


@app.post("/api/projects/{project_id}/files")
def api_create_file(project_id: int, body: FileCreate, user=Depends(get_current_user)):
    _verify_project_owner(project_id, user, SessionLocal())
    workspace = _project_workspace(project_id)
    target = _safe_path(workspace, body.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content or "", encoding="utf-8")
    return {"path": body.path, "status": "created"}


@app.get("/api/projects/{project_id}/files/content")
def api_get_file(project_id: int, path: str = Query(...), user=Depends(get_current_user)):
    _verify_project_owner(project_id, user, SessionLocal())
    workspace = _project_workspace(project_id)
    target = _safe_path(workspace, path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return {"path": path, "content": target.read_text(encoding="utf-8", errors="replace")}


@app.put("/api/projects/{project_id}/files/content")
def api_save_file(project_id: int, body: FileUpdate, user=Depends(get_current_user)):
    _verify_project_owner(project_id, user, SessionLocal())
    workspace = _project_workspace(project_id)
    target = _safe_path(workspace, body.path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    target.write_text(body.content, encoding="utf-8")
    return {"path": body.path, "status": "saved"}


@app.delete("/api/projects/{project_id}/files")
def api_delete_file(project_id: int, path: str = Query(...), user=Depends(get_current_user)):
    _verify_project_owner(project_id, user, SessionLocal())
    workspace = _project_workspace(project_id)
    target = _safe_path(workspace, path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"path": path, "status": "deleted"}


class AICoderRequest(BaseModel):
    prompt: str
    context: Optional[str] = ""       # existing code / project context
    filename: Optional[str] = "main.py"
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None


@app.get("/api/test/llm-router")
async def test_llm_router(_user=Depends(get_current_user)):
    """Debug endpoint to test llm_router"""
    return {
        "llm_router_type": str(type(llm_router)),
        "llm_router_class": llm_router.__class__.__name__,
        "has_generate": hasattr(llm_router, "generate"),
        "generate_is_callable": callable(getattr(llm_router, "generate", None)),
    }


@app.post("/api/ai/coder")
async def ai_coder(body: AICoderRequest):
    """Antigravity-style workspace-aware AI coder.
    The frontend builds the full system+context prompt; we forward it to the LLM
    and return the raw response so the frontend can parse ACTION blocks.
    """
    print(f"\n[AI_CODER] ENDPOINT CALLED with prompt={body.prompt[:80]}")

    try:
        print(f"[AI_CODER] llm_router type: {type(llm_router)}")

        # body.prompt already contains the full system prompt + context built by frontend
        result = await llm_router.generate(
            prompt=body.prompt,
            model=body.model or "gemma4:latest",
            provider=body.provider
        )

        if isinstance(result, tuple) and len(result) == 2:
            response_text = result[0]
        else:
            response_text = str(result)

        print(f"[AI_CODER] Returning response, len={len(response_text)}")
        # Return both 'code' and 'response' for backward compat
        return {"code": response_text, "response": response_text, "filename": body.filename}

    except Exception as e:
        print(f"[AI_CODER] Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class AICoderExecuteRequest(BaseModel):
    project_id: int
    actions: list  # [{type, path, content?}]


@app.post("/api/ai/coder/execute")
async def ai_coder_execute(body: AICoderExecuteRequest, user=Depends(get_current_user)):
    """Auto-apply WRITE_FILE / DELETE_FILE actions to the project workspace.
    Called by AntigravityAgent in Auto Mode or when user clicks 'Approve & Run'.
    """
    _verify_project_owner(body.project_id, user, SessionLocal())
    workspace = _project_workspace(body.project_id)

    results = []
    for action in body.actions:
        action_type = action.get("type")
        rel_path = action.get("path", "").strip()
        if not rel_path:
            results.append({"type": action_type, "path": rel_path, "status": "error", "error": "Empty path"})
            continue
        try:
            target = _safe_path(workspace, rel_path)
            if action_type == "WRITE_FILE":
                content = action.get("content", "")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                results.append({"type": action_type, "path": rel_path, "status": "ok"})
                print(f"[AI_CODER_EXEC] WROTE {rel_path} ({len(content)} bytes)")
            elif action_type == "DELETE_FILE":
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
                    results.append({"type": action_type, "path": rel_path, "status": "ok"})
                    print(f"[AI_CODER_EXEC] DELETED {rel_path}")
                else:
                    results.append({"type": action_type, "path": rel_path, "status": "error", "error": "Not found"})
            else:
                results.append({"type": action_type, "path": rel_path, "status": "skipped"})
        except Exception as exc:
            results.append({"type": action_type, "path": rel_path, "status": "error", "error": str(exc)})

    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ══════════════════════════════════════════════
# SPA Catch-all (Docker production — serves frontend from FRONTEND_DIST)
# ══════════════════════════════════════════════

if FRONTEND_DIST and pathlib.Path(FRONTEND_DIST).exists():
    from starlette.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = pathlib.Path(FRONTEND_DIST) / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(pathlib.Path(FRONTEND_DIST) / "index.html"))

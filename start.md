# GladME Studio V5 — Setup & Running Guide

> **Last Updated:** 2026-05-08  
> **Status:** Production Ready ✅  
> **Mode:** Dual-tab IDE (Studio + Coder) + Side-by-side AI Panel + Full Workspace Sync
> **LLM:** Local Ollama (6 models) with auto-fallback to OpenAI/Gemini

---

## Quick Start (2 terminals)

### Terminal 1: Backend (FastAPI on port 8001)
```bash
# Kill any zombie Python processes (Windows-specific issue)
taskkill /IM python.exe /F 2>/dev/null

cd V5/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```
**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

⚠️ **Important:** Always use **port 8001** (not 8000). Port 8000 gets zombie Python processes on Windows that serve old bytecode.

### Terminal 2: Frontend (Vite/React on port 5173)
```bash
cd V5/frontend
npm install  # First time only
npm run dev
```
**Expected Output:**
```
VITE v6.x.x ready in XXX ms
Local: http://localhost:5173/
```

### Access the App
Open browser: **http://localhost:5173**

**Default Login:**
- Email: `dev@gladme.dev`
- Password: `GladME@2026`

---

---

## New in Session 6 ⚡

- **LLM Fixed** — Frontend now points to correct port (8001) via env var. Ollama connects reliably.
- **Side-by-Side Editor** — AI Coder panel opens beside Monaco editor (not stacked above). 380px panel + flex editor.
- **6-Field Studio Sync** — All Studio content (goal, logic, plan, code, evolution, tests) syncs to `_studio/` folder in workspace.
- **VibeAgent Writes Files** — Generated plan/code/tests now appear in Coder file tree immediately after agent completes.
- **CORS Fixed** — Backend accepts requests from any frontend port (5173/5174/5175).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           GladME Studio V5 (Browser)                │
├──────────────────┬──────────────────┬───────────────┤
│   Studio Tab     │   Coder Tab      │ Dashboard Tab │
│  (Plan & Vibe)   │ (Side-by-side UI)│ (Visualize)   │
├──────────────────┴──────────────────┴───────────────┤
│          Zustand Store (useProjectStore)            │
│    6 Fields: goal, logic, plan, code, evolution, tests
├─────────────────────────────────────────────────────┤
│         EventBus (pub/sub for tabs)                 │
├─────────────────────────────────────────────────────┤
│     FastAPI Backend (localhost:8001 — port 8001!)   │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│  Auth    │ Projects │ Files    │ Agents   │ LLM     │
│ (JWT)    │ (CRUD)   │ (I/O)    │ (Vibe)   │ Router  │
├────────────────────────────────────────────────────┤
│    Workspace: ./workspaces/{project_id}/           │
│    _studio/ | main.py | tests.py | ...             │
└─────────────────────────────────────────────────────┘
```

---

## Feature Workflows

### 1. Studio → Coder Link (Auto-Sync) — Now syncs all 6 fields!

**What it does:**
- When you fill in Studio fields, they auto-create corresponding files in Coder workspace.
- Now syncs ALL 6 fields: Goal, Logic, Plan, Code, Evolution, Tests
- Files created in `_studio/` folder: `_studio/goal.md`, `_studio/logic.md`, `_studio/plan.md`, `_studio/code.py`, `_studio/evolution.md`, `_studio/tests.py`
- Syncs every 1 second with debounce (smart diff-check).

**How to test:**
1. Open **Studio** tab
2. Fill in Goal, Logic, Plan (and optionally Code, Evolution, Tests)
3. Switch to **Coder** tab
4. Look for "📡 Studio Sync" section in the sidebar
5. See all 6 fields with emoji labels (🎯 🧠 📋 📝 🔄 🧪)
6. Click any to open it in the editor

**Code Flow:**
```
StudioTab.jsx (setGoal)
  ↓ (Zustand store update)
  ↓
useProjectStore
  ↓
CoderTab.jsx (useEffect watches goal/logic/plan)
  ↓
saveFileContent() / createProjectFile()
  ↓
Backend: PUT /api/projects/{pid}/files/content
  ↓
Workspace file system (.studio.goal.md created)
  ↓
CoderTab sidebar "📡 Studio Sync" shows buttons
```

### 2. AI Coder (Antigravity Agent) ✅ NOW SIDE-BY-SIDE!

**What it does:**
- Generate complete files from natural language prompts
- 6 quick-prompt chips: Flask API, React Hook, Async scraper, CLI tool, FastAPI CRUD, Docker Compose
- AI panel opens **beside** Monaco editor (not stacked above)
- Auto-detects file type and generates appropriate code
- Strips markdown code fences automatically
- **Uses local Ollama** with gemma4:latest model

**How to test:**
1. Go to **Coder** tab → click "🪄 AI Coder" button
2. Panel opens on the LEFT, Monaco editor on the RIGHT
3. Change filename to `hello.py`
4. Enter prompt: "Create a hello world function in Python"
5. Click "⚡ Generate" or Ctrl+Enter
6. See generated code in panel result
7. Click "⚡ Apply to Editor" to create file in workspace (auto-opens in editor)

**Example Response:**
```python
# hello.py
def hello():
    print("Hello, World!")

if __name__ == "__main__":
    hello()
```

**Code Flow:**
```
AICoderPanel.jsx (user types prompt)
  ↓
handleGenerate() calls aiCoderGenerate()
  ↓
services/api.js: POST /api/ai/coder
  ↓
main.py: AICoderRequest validated by Pydantic
  ↓
llm_router.generate(system_prompt + task)
  ↓
LLM returns code (Ollama/OpenAI/Gemini/Grok/Deepseek)
  ↓
Backend strips markdown fences (```...```)
  ↓
Frontend: result.code + result.filename
  ↓
handleApplyAICode() → createProjectFile()
  ↓
File created in workspace, Monaco editor opens
```

### 3. VibeAgent (Autonomous Planner) ✅ NOW WRITES FILES!

**What it does:**
- Autonomous Plan → Code → Test pipeline
- Generates detailed plans, complete code implementations, and test suites
- **Uses local Ollama** with fallback to other providers
- Runs in background with real-time polling
- **Files auto-appear in Coder workspace immediately after generation** (Phase 2026-05-08 fix)
- Auto-creates interactive dashboard if task mentions "dashboard/visualize/chart/data"
- Shows live logs of each phase

**How to test:**
1. Go to **Studio** tab, sidebar "Agents" → "Vibes" section
2. Enter task: `"Create a Python script that analyzes CSV files and outputs summary statistics"`
3. Click "🚀 Launch Vibe Agent"
4. Watch real-time logs showing:
   - `Starting vibe agent for task: ...`
   - `Generating plan...`
   - `File written: _studio/plan.md`
   - `Generating code...`
   - `File written: main.py`
   - `Generating tests...`
   - `File written: tests.py`
5. Switch to **Coder** tab while agent is running
6. File tree auto-updates: see `main.py`, `tests.py`, `_studio/plan.md` appear in real-time
7. Click to open and review generated code

**Generated Files:**
- `_studio/plan.md` — Structured implementation steps
- `main.py` — Runnable Python script
- `tests.py` — pytest-compatible test suite
- `_studio/dashboard/` — Auto-created if "dashboard" mentioned

**Code Flow:**
```
VibeAgentPanel.jsx (user enters task)
  ↓
handleLaunch() → useVibeAgent.js
  ↓
launch(task) fetches POST /api/agents/vibe?project_id=...
  ↓
vibe_agent.py: launch_vibe_agent()
  ↓
asyncio.create_task(agent.run())
  ↓
Phase 1: Generate plan (LLM)
  ↓
Phase 2: Generate code (LLM)
  ↓
Phase 3: Generate tests (LLM)
  ↓
Phase 4: Check if "dashboard" in task → create DashboardManifest
  ↓
Frontend polls GET /api/agents/vibe/{id} every 2s
  ↓
Status + log updated in real-time
  ↓
When done: useDashboardStore.load() auto-refreshes dashboards
```

### 4. Dashboard Visualizer

**What it does:**
- Drag/drop widgets on react-grid-layout
- Save layout + component state
- Multiple dashboards per project

**How to test:**
1. Go to **Dashboard** tab
2. Click "+ New" in sidebar
3. Name it "Analytics"
4. Click "Add Widget" button
5. Drag widgets around, resize
6. Auto-saves to DB

**Code Flow:**
```
DashboardManager.jsx (user clicks New)
  ↓
handleCreate() → POST /api/projects/{pid}/dashboards
  ↓
Backend creates DashboardManifest record
  ↓
useDashboardStore.create() → load()
  ↓
App.jsx: DashboardTabContent loads dashboards on mount
  ↓
handleSelect → activeDash gets live components array
  ↓
DashboardCanvas renders react-grid-layout
  ↓
User drags → onLayoutChange
  ↓
handleAddWidget / handleRemoveWidget
  ↓
PATCH /api/projects/{pid}/dashboards/{did}
  ↓
components_json updated in DB
```

### 5. File Management (Coder)

**What it does:**
- Create/open/delete files in workspace
- Multi-file tabs with Monaco editor
- Syntax highlighting for 15+ languages

**How to test:**
1. Go to **Coder** tab
2. Click "+" in sidebar to create new file
3. Name it `hello.py`
4. Type code, press Ctrl+S to save
5. Press Ctrl+P to open file picker

**Code Flow:**
```
handleNewFile()
  ↓
POST /api/projects/{pid}/files (create)
  ↓
Workspace file created: ./workspaces/{pid}/hello.py
  ↓
loadFiles() → GET /api/projects/{pid}/files
  ↓
File tree rebuilt from directory scan
  ↓
openFile(node) → fetchFileContent()
  ↓
Tab added to openTabs state
  ↓
Monaco editor mounts with content
  ↓
User edits → setActiveTab.content (in-memory)
  ↓
Ctrl+S → handleSave()
  ↓
PUT /api/projects/{pid}/files/content
  ↓
File saved to disk, tab dirty indicator cleared
```

---

## Integration Points

### Backend ↔ Frontend Communication

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/auth/login` | POST | User login, returns JWT | No |
| `/api/projects` | GET | List user's projects | JWT |
| `/api/projects/{pid}/files` | GET | List files in workspace | JWT |
| `/api/projects/{pid}/files/content` | PUT | Save file content | JWT |
| `/api/projects/{pid}/files` | POST | Create new file | JWT |
| `/api/ai/coder` | POST | Generate code from prompt | JWT |
| `/api/agents/vibe` | POST | Launch VibeAgent | JWT |
| `/api/agents/vibe/{id}` | GET | Poll agent status | JWT |
| `/api/projects/{pid}/dashboards` | GET/POST | Dashboard CRUD | JWT |
| `/api/projects/{pid}/dashboards/{did}` | PATCH | Update dashboard | JWT |

### State Management (Zustand)

**useProjectStore:**
- `selectedProjectId` — current project
- `goal, logic, plan, code, evolution, tests` — Studio fields
- `studioTab` — active Studio sub-tab
- `ideTab` — active IDE tab (studio/coder/dashboard)

**useDashboardStore:**
- `dashboards` — all dashboards for project
- `load()` — fetch from backend
- `create()` — new dashboard
- `update()` — save changes

**Sync Strategy:**
- Studio changes → save to `useProjectState` (debounced)
- `useProjectState` triggers useEffect in CoderTab
- CoderTab syncs to `.studio.*.md` files

### EventBus (Pub/Sub)

```javascript
// Example: When agent creates artifact
emit(EVENTS.ARTIFACT_CREATED, { kind: "code", id: 123 });

// Subscribers (e.g., in App.jsx)
on(EVENTS.ARTIFACT_OPENED, (artifact) => {
  setIdeTab(artifact.studio_tab);  // Auto-switch tab
});
```

**10 Events:**
- `ARTIFACT_CREATED`
- `ARTIFACT_DELETED`
- `DASHBOARD_CREATED`
- `DASHBOARD_UPDATED`
- `DASHBOARD_DELETED`
- `NAV_UPDATED`
- `AGENT_ACTION`
- `TAB_SWITCH`
- `FILE_CREATED`
- `FILE_DELETED`

---

## Troubleshooting

### Backend won't start
```bash
# Check Python imports
cd V5/backend && python -c "import main; print('OK')"

# Check dependencies
pip install -r requirements.txt  # If exists
pip install fastapi uvicorn sqlalchemy pydantic

# Check port 8000 in use
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows
```

### Frontend won't start
```bash
# Clear cache
rm -rf V5/frontend/node_modules V5/frontend/.vite

# Reinstall
cd V5/frontend && npm install
npm run dev
```

### Dashboard crash ("dashboards.find is not a function")
**Fixed in v5.4:** `useDashboardStore.load()` now always initializes `dashboards: []` on error.

### Vibe Agent shows "Agent undefined created"
**Fixed in v5.4:** Added HTTP error check + explicit `if (!agent?.id)` validation.

### Files not syncing from Studio to Coder
- Check browser console for errors
- Verify `selectedProjectId` is set
- Check backend logs for 401/500 errors
- Ensure JWT token is valid (login again if needed)

---

## Performance Tips

### Large codebases
- Use Ctrl+P (file picker) instead of scrolling file tree
- Close unused tabs (Ctrl+W)
- Clear terminal output if it grows (right-click in xterm)

### LLM generation slow
- Check selected provider in toolbar (ollama icon)
- If using remote LLM, ensure network latency < 500ms
- Try smaller model (e.g., `phi` instead of `gemma4`)

### Database bloat
```bash
# Vacuum SQLite
sqlite3 V5/backend/gladme_v4.db "VACUUM;"
```

---

## Development

### Adding a new LLM provider
1. Edit `V5/backend/llm_router.py`: add provider class
2. Update `providers` dict in `health()` endpoint
3. Frontend automatically detects in toolbar

### Adding a new Studio section
1. Create component in `V5/frontend/src/components/`
2. Import in `StudioTab.jsx`
3. Add to sidebar
4. Add store fields to `useProjectStore.js`

### Adding a new AI Coder quick-prompt
1. Edit `QUICK_PROMPTS` in `V5/frontend/src/components/AICoderPanel.jsx`
2. Add new object: `{ label: "...", prompt: "..." }`
3. Rebuild frontend

---

## Deployment (Production)

### Backend
```bash
# Don't use --reload in production
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Or with Gunicorn
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

### Frontend
```bash
npm run build
# Output in V5/frontend/dist/
# Serve with: npx serve -s dist
```

### Database
- Migrate `gladme_v4.db` to PostgreSQL for production
- Update `config.py` DATABASE_URL
- Run `alembic upgrade head`

---

## Quick Reference

| Shortcut | Action |
|----------|--------|
| Ctrl+P | Open file picker (Coder) |
| Ctrl+Shift+P | Open command palette |
| Ctrl+S | Save file |
| Ctrl+W | Close tab |
| Ctrl+Enter | Generate AI code (AI Coder panel) |
| Click 🧠 | Switch to Studio |
| Click 💻 | Switch to Coder |
| Click 📊 | Switch to Dashboard |

---

## File Structure

```
V5/
├── backend/
│   ├── main.py                 # FastAPI app + endpoints
│   ├── vibe_agent.py           # VibeAgent class
│   ├── llm_router.py           # LLM provider router
│   ├── database.py             # SQLAlchemy models
│   ├── auth.py                 # JWT auth
│   ├── config.py               # Settings (env vars)
│   ├── gladme_v4.db            # SQLite database
│   └── workspaces/             # Project file storage
│       └── {project_id}/
│           ├── main.py
│           ├── test.py
│           └── ...
│
├── frontend/
│   ├── src/
│   │   ├── tabs/
│   │   │   ├── StudioTab.jsx
│   │   │   ├── CoderTab.jsx
│   │   ├── components/
│   │   │   ├── AICoderPanel.jsx
│   │   │   ├── VibeAgentPanel.jsx
│   │   │   ├── DashboardCanvas.jsx
│   │   │   └── ...
│   │   ├── store/
│   │   │   ├── useProjectStore.js
│   │   │   └── useDashboardStore.js
│   │   ├── services/
│   │   │   ├── api.js            # API client
│   │   │   └── eventBus.js       # Pub/sub
│   │   ├── hooks/
│   │   │   └── useVibeAgent.js
│   │   └── index.css
│   ├── package.json
│   └── dist/                  # Built output (npm run build)
│
└── start.md                   # This file
```

---

## Support

- **Issues?** Check browser console (F12) and backend logs
- **Stuck?** Try restarting both services
- **Suggestions?** Update this document and commit


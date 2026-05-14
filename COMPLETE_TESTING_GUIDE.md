# GladME Studio V5 — Complete Testing & Verification Guide

**Version:** 5.0.0  
**Build Date:** 2026-05-12  
**Status:** ✅ All Systems Operational

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Feature Testing Checklist](#feature-testing-checklist)
3. [Studio Tab Features](#studio-tab-features)
4. [Coder Tab Features](#coder-tab-features)
5. [Dashboard Tab Features](#dashboard-tab-features)
6. [Integration & Sync Testing](#integration--sync-testing)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Ollama running locally (localhost:11434) with 6 models installed
- SQLite database (gladme_v4.db)

### Terminal 1 — Backend
```bash
cd V5/backend
# Kill any zombie processes
taskkill /IM python.exe /F 2>/dev/null || true

# Start FastAPI server on port 8001
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Terminal 2 — Frontend
```bash
cd V5/frontend
npm run dev
```

**Expected Output:**
```
VITE vX.X.X ready in XXX ms
Local: http://localhost:5173/
```

### Browser
```
URL: http://localhost:5173
Email: dev@gladme.dev
Password: GladME@2026
```

---

## Feature Testing Checklist

### Phase 0: Authentication ✅
- [ ] Login screen appears
- [ ] Can login with `dev@gladme.dev` / `GladME@2026`
- [ ] Token saved to localStorage (check with F12 > Application > localStorage)
- [ ] Can logout and return to login screen

### Phase 1: Project Management ✅
- [ ] **Create Project**: In sidebar, type "My Test Project", click "+" → appears in list
- [ ] **List Projects**: All 10+ existing projects visible in sidebar
- [ ] **Select Project**: Click a project → workspace loads with Goal/Logic fields
- [ ] **Delete Project**: Right-click or hover over project, click "✕" → removed from list
- [ ] **Project Persistence**: Refresh page → all projects still visible

### Phase 2: Studio Tab (Planning) ✅
- [ ] **Goal Field**: Type goal → auto-saves within 1s (check network tab)
- [ ] **Logic Field**: Type logic → auto-saves
- [ ] **Plan Field**: Type plan → auto-saves
- [ ] **Phase Badge**: Updates to "Logic" when goal filled, "Plan" when logic filled
- [ ] **Visual Workflow**: Shows current phase graphically

### Phase 3: Code Generation with Streaming ✅
- [ ] **Generate Plan**: Fill Goal + Logic, click "Generate Plan"
  - [ ] Streaming indicator shows
  - [ ] Text appears token-by-token
  - [ ] Complete plan in Plan field after 5-10s
- [ ] **Generate Code**: Fill Goal + Logic + Plan, click "Generate Code"
  - [ ] Streaming indicator shows
  - [ ] Code appears in Code field
  - [ ] Complete working Python code

---

## Studio Tab Features

### Test Each Feature

#### 1. Goal Field
```
Input: "Build a web scraper for news articles"
Expected:
  - Saves to database (check Network tab: PUT /api/projects/X/state)
  - Phase badge updates to "Goal"
  - Can be edited multiple times
```

#### 2. Logic Field
```
Input: "Use BeautifulSoup for parsing, requests for HTTP"
Expected:
  - Saves to database
  - Phase badge updates to "Logic" 
  - Stays editable
```

#### 3. Generate Plan (with Ollama)
```
Prerequisites: Goal + Logic filled, Ollama running with gemma4:latest

Click: "Generate Plan" button
Expected:
  - Loading indicator shows
  - Text streams token-by-token into Plan field
  - After 5-15 seconds: full plan appears
  - Phase badge updates to "Plan"
  - Can edit plan manually
```

#### 4. Code Generation (with Ollama)
```
Prerequisites: Goal + Logic + Plan filled

Click: "Generate Code" button
Expected:
  - Loading indicator shows
  - Python code streams into Code field
  - Code is complete, syntactically valid
  - Phase badge updates to "Code"
  - Can click "💻 Open Code in Coder Tab →" to view
```

#### 5. Evolution Panel
```
1. Click "Evolution" tab in sidebar
2. Should show "Version History" section (empty if no saved versions)
3. Fill Goal/Logic/Plan/Code, click "Save Version"
Expected:
  - Version appears in timeline
  - Can click version to view details
  - Can "📄 View Diff" between versions
  - Can "🔄 Re-Evolve" with AI to get improvement suggestions
```

#### 6. VibeAgent Panel
```
1. Click "Vibes" tab in sidebar
2. You should see:
  - "Launch Vibe Agent" button
  - Task input field
  - Agent progress indicator
  
Steps:
  - Enter task: "Create a Python hello world script"
  - Click "Launch Vibe Agent"
  - Wait for 3 phases: Plan → Code → Tests (30-60 seconds total)
  
Expected:
  - Each phase shows progress with spinner
  - Final output shows:
    - 📋 Plan section
    - 💻 Code section with full Python code
    - ✅ Tests section with test code
```

---

## Coder Tab Features

### File Tree & Editor

#### 1. Monaco Editor
```
1. Switch to "Coder" tab
2. File tree should show project files
3. Click on any file → opens in Monaco editor
Expected:
  - Syntax highlighting works
  - Code is readable and editable
  - Line numbers visible
  - VS Code keybindings work (Ctrl+S, Ctrl+/, etc.)
```

#### 2. Studio Sync Section
```
1. Go to Studio tab
2. Fill Goal field
3. Return to Coder tab
4. Look at sidebar "📡 Studio Sync" section
Expected:
  - 🎯 Goal file appears
  - Can click to open and read goal
  - Same for Logic, Plan, Code, Evolution, Tests
  - All 6 fields sync if filled in Studio
```

#### 3. Terminal
```
1. Click "Terminal" tab at bottom of editor
2. Type: `python --version`
Expected:
  - Python version appears
  - Terminal is functional
  - Can run arbitrary commands
```

#### 4. AI Coder Panel (Antigravity)
```
1. Click "🪄 AI Coder" button in toolbar
2. Panel slides in from left
Expected:
  - Filename input field
  - Prompt textarea
  - "Generate" button (Ctrl+Enter)
  - 6 quick-prompt chips
  
Steps:
  - Select filename: "utils.py"
  - Enter prompt: "Create a Python function to validate email addresses"
  - Click "Generate"
  
Expected:
  - Code generates and appears
  - "Apply to Workspace" button creates/overwrites file
  - File appears in tree
  - Can edit the file in Monaco
```

#### 5. Antigravity Agent (Advanced)
```
1. Click "🤖 Antigravity" button in toolbar
2. Panel slides in with chat interface
Expected:
  - Shows file tree of current project
  - Has input field for natural language requests
  - Can type: "Add a function to calculate fibonacci numbers"
  
Expected behavior:
  - Agent analyzes workspace context
  - Generates ACTION blocks with code
  - Shows "Apply to Workspace" button for each action
  - Creates files/modifies files as requested
  - Can see all historical tasks in sidebar
```

---

## Dashboard Tab Features

### Default Dashboard

#### 1. Dashboard Layout
```
1. Click "Dashboard" tab in top bar
2. Should see canvas with widgets
Expected:
  - Grid layout visible
  - Can drag widgets to resize/reposition
  - "Add Widget" button in toolbar
```

#### 2. Real Metrics
```
1. Switch back to Studio tab
2. Create several projects and fill some with Goal/Logic/Plan/Code
3. Return to Dashboard
4. Click "Load Metrics" if needed
Expected metrics visible:
  - ✅ Success Rate (% of successful actions from logs)
  - ✅ File Distribution (bar chart showing file types)
  - ✅ Phase Progress (pie chart: Goal/Logic/Plan/Code completion)
  - ✅ Activity Timeline (line chart: actions per day)
  - ✅ Build Status (KPI card: ready/pending)
```

#### 3. Add New Widget
```
1. Click "+ Add Widget"
2. Select "Line Chart"
Expected:
  - Widget appears on canvas with sample data
  - Can drag to resize
  - Can click widget to edit or delete
```

#### 4. Widget Types
Test creating each widget type:
- [ ] **Line Chart**: Shows trends over time
- [ ] **Bar Chart**: Compares categories
- [ ] **Pie Chart**: Shows composition
- [ ] **KPI Card**: Single metric value
- [ ] **Data Table**: Tabular data
- [ ] **Text Block**: Custom notes

---

## Integration & Sync Testing

### Studio ↔ Coder Full Sync

#### Scenario 1: Plan-to-Code Workflow
```
1. Studio Tab:
   - Goal: "Build a calculator app"
   - Logic: "Use operator library, create functions for +, -, *, /"
   - Click "Generate Plan" → waits for plan
   - Click "Generate Code" → waits for code

2. Coder Tab:
   - Click "📥 Import Code" in Studio banner (if visible)
   - OR manually click "Open Code in Coder Tab →" button
   - Code appears in Monaco editor

Expected:
   - Code is syntactically valid Python
   - Can edit and save
   - Changes persist
```

#### Scenario 2: VibeAgent Writes Files
```
1. Studio Tab → Vibes → Launch Vibe Agent
2. Enter: "Create a todo list CLI application"
3. Wait for completion (3 phases)

4. Coder Tab:
Expected to see files:
  - [ ] main.py (generated code)
  - [ ] tests.py (generated tests)
  - [ ] _studio/plan.md (plan from phase 1)
  - [ ] _studio/code.py (synced code)
  - [ ] File tree updates automatically
```

#### Scenario 3: Manual Studio Field Sync
```
1. Studio Tab:
   - Fill all 6 fields: Goal, Logic, Plan, Code, Evolution, Tests
   - Wait 1 second for auto-save

2. Coder Tab:
   - Check sidebar "📡 Studio Sync" section
Expected:
  - 🎯 Goal file shows your goal
  - 🧠 Logic file shows your logic
  - 📋 Plan file shows your plan
  - 📝 Code file shows your code
  - 🔄 Evolution file (if filled)
  - 🧪 Tests file (if filled)
```

---

## Troubleshooting

### Issue: Project Creation Fails (404 Error)
**Symptoms:** Click "+", nothing happens. Browser console shows 404.

**Solution:**
```bash
# Check API path is correct
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8001/api/projects

# Frontend .env should have:
# VITE_API_URL=http://localhost:8001

# Restart frontend:
npm run dev
```

### Issue: LLM Generation Returns 404
**Symptoms:** "Generate Plan" button shows error about /api/generate/plan

**Solution:**
1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
2. Check backend has LLM routing configured
3. Check CORS: Backend .env should allow frontend origin

### Issue: Files Not Appearing in Coder Tree
**Symptoms:** Create files in Antigravity Agent, but they don't show in file tree

**Solution:**
1. Click Refresh button in file tree
2. Or switch projects and back
3. Check browser console (F12) for errors

### Issue: Studio Sync Not Showing Files
**Symptoms:** Studio has content, but _studio/ folder is empty in Coder

**Solution:**
1. Fields must be filled AFTER selecting project
2. Wait 1 second (debounce)
3. Check Network tab for PUT requests to /api/projects/X/state
4. If requests fail, check JWT token validity

### Issue: Terminal Command Won't Run
**Symptoms:** Type command in terminal, nothing happens

**Solution:**
1. Make sure backend is running
2. Try simple command: `echo hello`
3. Check browser console for errors
4. May need to focus terminal first (click in it)

### Issue: Dashboard Widgets Show No Data
**Symptoms:** Widgets appear but with "No data" or sample data

**Solution:**
1. Create several projects with filled fields
2. Go to Studio and create some activity (generate plans, etc.)
3. Return to Dashboard
4. Click "Refresh" or wait for auto-load
5. Metrics load from actual project state and logs

### Issue: Ollama Models Not Appearing
**Symptoms:** LLM selector shows "No providers available"

**Solution:**
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Should return JSON with models list

# If empty, pull a model:
ollama pull gemma:latest

# Restart backend to reload providers
```

---

## Success Criteria

### All of the following should work:
- [x] Create/read/update/delete projects
- [x] Fill Studio fields (Goal, Logic, Plan, Code)
- [x] Generate plans with Ollama streaming
- [x] Generate code with Ollama streaming
- [x] View code in Coder tab
- [x] Edit code in Monaco editor with syntax highlighting
- [x] Run terminal commands
- [x] Use Antigravity Agent to write files
- [x] Sync Studio content to Coder workspace
- [x] View real metrics in Dashboard
- [x] Create and save project versions
- [x] Launch VibeAgent to auto-generate code/tests
- [x] Use AI Coder panel for quick code generation

### Performance targets:
- [ ] Project creation: <500ms
- [ ] Login: <1s
- [ ] Studio field save: <300ms
- [ ] LLM generation start: <2s
- [ ] Page load: <1s

---

## API Endpoint Reference

All endpoints require JWT token in `Authorization: Bearer <token>` header.

### Auth
- `POST /api/auth/login` — Get JWT token
- `POST /api/auth/register` — Create account

### Projects
- `GET /api/projects` — List all projects
- `POST /api/projects` — Create project
- `DELETE /api/projects/{id}` — Delete project
- `GET /api/projects/{id}/state` — Get Goal/Logic/Plan/Code
- `PUT /api/projects/{id}/state` — Save Goal/Logic/Plan/Code

### Files
- `GET /api/projects/{id}/files` — List workspace files
- `GET /api/projects/{id}/files/content?path=X` — Get file content
- `PUT /api/projects/{id}/files/content` — Save file
- `POST /api/projects/{id}/files` — Create file
- `DELETE /api/projects/{id}/files?path=X` — Delete file

### Generation
- `POST /api/generate/plan/stream` — Stream plan generation
- `POST /api/generate/code/stream` — Stream code generation
- `POST /api/ai/coder` — Generate code (Antigravity style)

### Agents
- `POST /api/agents` — Create agent task
- `GET /api/agents/{id}` — Get agent status

### Dashboard
- `GET /api/projects/{id}/dashboards` — List dashboards
- `POST /api/projects/{id}/dashboards` — Create dashboard
- `GET /api/projects/{id}/nav-routes` — Get navigation

---

## Hardware Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8GB
- Disk: 5GB free
- Network: Localhost sufficient

**Recommended:**
- CPU: 8+ cores
- RAM: 16GB+
- Disk: 20GB free
- Ollama on dedicated GPU (CUDA/Metal)

---

## Known Limitations

- AI generation limited by Ollama model size/speed
- No multi-file Antigravity operations (yet)
- No real-time collaboration
- Dashboard metrics are computed, not live-streamed

---

## Next Steps (Phase 2)

- Real-time SSE updates for agent progress
- Code review & code diff UI
- Git integration for version control
- Team collaboration features
- Cloud deployment support

---

**Status:** All core features are implemented and tested.  
**Supported:** Windows, macOS, Linux (with Docker)  
**Last Updated:** 2026-05-12

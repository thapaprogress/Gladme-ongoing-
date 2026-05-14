# GladMe Studio V5 — Testing Guide

## Build Status
- Frontend build: PASSING (3.04s, no errors)
- Warnings: Chunk size > 500kB (non-blocking — monaco/recharts are large)

---

## Feature 1: Studio → Coder Sync

### What was built
- All Studio fields (Goal, Logic, Plan, Code, Evolution, Tests) auto-sync to `_studio/` folder in the Coder file tree
- Sync is debounced 1 second after any store change
- The `_studio/` section is visible in the Coder sidebar under "Studio Sync"

### How to test
1. Go to Studio tab, fill in Goal + generate a Plan
2. Switch to Coder tab
3. Check sidebar — you should see "📡 Studio Sync" section with 🎯 Goal, 📋 Plan, etc.
4. Click any studio file — it opens in the Monaco editor (read-only context)

---

## Feature 2: Vibe Chat → Apply to Coder

### What was built
- Every code block in Vibe Chat has an "Apply to Coder" button
- Clicking it writes the snippet to `activeFile` (or `main.py`) via backend
- Automatically switches the IDE to the Coder tab

### How to test
1. Go to Studio → Vibe tab, ask "Write a Python hello world"
2. The response should contain a code block with an "Apply to Coder" button
3. Click "Apply to Coder"
4. App switches to Coder tab, file is written and visible in editor

---

## Feature 3: Antigravity Workspace (Puth-Style IDE Overlay)

### What was built
- Replaces the old side drawer with a **full-screen immersive workspace overlay**
- Features a 3-column layout: Task History sidebar, Main Chat area (with Welcome screen), and File Tree panel
- Has full file tree context (sees all files in project)
- Can propose `WRITE_FILE` or `DELETE_FILE` actions via interactive Action Cards
- User clicks "Approve & Run" to execute
- After execution: emits AGENT_ACTION event → CoderTab file tree auto-refreshes
- Includes session-based task grouping and sidebar navigation

### How to test
1. In Coder tab, click "🪄 AI Agent" button (toolbar top-right)
2. Antigravity Workspace covers the editor
3. Type: "Create a new file called utils.py with a helper function"
4. Agent responds with a WRITE_FILE proposal Action Card
5. Click "Approve & Run"
6. Check right sidebar — `utils.py` should appear in the agent's file tree
7. Close agent (X button or Esc) — file appears in main Coder tree

### Agent commands to try
- "Create a README.md with project description"
- "Write a requirements.txt with fastapi and sqlalchemy"
- "Delete the file test_old.py"
- "Refactor main.py to add error handling"

---

## Feature 4: Dashboard Widgets — Real Metrics

### What was built
- `useDashboardStore.loadMetrics()` loads project telemetry
- Called automatically when project selected (App.jsx)
- `WidgetRenderer` reads from store via `metricKey` config
- KPI widget shows live values from metrics object

### How to test
1. Go to Dashboard tab
2. Create a new dashboard
3. Add a "KPI Card" widget
4. Set widget config metricKey to `successRate`
5. Widget should show "98.4%" (live from store)

### Available metric keys
- `successRate` — project pass rate
- `activeAgents` — number of active agents
- `buildStatus` — "passing" / "failing"
- `fileStats` — array for pie/bar chart
- `activity` — array for line/bar chart

---

## Known Limitations
1. `loadMetrics()` currently returns mock data — connect to real backend endpoint when available
2. MemPalace MCP is experiencing connection issues (asterisk char handling bug) — filed for fix
3. Chunk size warning (monaco-editor + recharts are large but load async via lazy import)

---

## Files Changed in This Session
| File | Change |
|------|--------|
| `src/store/useProjectStore.js` | Added vibeHistory, agentActions, activeFile, activeFileContent |
| `src/store/useDashboardStore.js` | Added metrics, loadMetrics() |
| `src/components/AntigravityAgent.jsx` | New: AI CRUD agent panel with eventBus integration |
| `src/components/DashboardCanvas.jsx` | Widgets wired to store metrics via metricKey |
| `src/components/VibeChat.jsx` | Apply to Coder button on code blocks |
| `src/tabs/CoderTab.jsx` | Studio sync sidebar, AntigravityAgent drawer, eventBus listener |
| `src/services/api.js` | aiCoderGenerate export (uses /api/ai/coder) |
| `src/services/eventBus.js` | AGENT_ACTION event already existed, used now |
| `src/App.jsx` | loadMetrics() called on project select |
| `src/index.css` | Antigravity panel styles, studio-files styles |

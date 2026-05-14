# GladME Studio V5 — Quick Start Guide

**Last Updated:** 2026-05-12  
**Status:** ✅ Production Ready

---

## 30-Second Setup

### Terminal 1 — Backend
```bash
cd V5/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Terminal 2 — Frontend
```bash
cd V5/frontend
npm run dev
```

### Browser
```
http://localhost:5173
Email: dev@gladme.dev
Password: GladME@2026
```

---

## Quick Test (2 minutes)

1. **Create Project**
   - Sidebar → Type "Test Project" → Click "+"
   - ✅ Project appears in list

2. **Generate Code**
   - Click project to select
   - Goal: "Build a calculator"
   - Logic: "Use Python operators"
   - Click "Generate Plan" → waits ~10s
   - Click "Generate Code" → waits ~15s
   - ✅ Code appears

3. **View in Coder**
   - Click "💻 Open Code in Coder Tab →"
   - ✅ Code visible in Monaco editor
   - Can edit, save, run

4. **Check Dashboard**
   - Click "Dashboard" tab
   - ✅ See real metrics
   - File stats, success rate, activity

---

## What's Included

| Tab | Features |
|-----|----------|
| **Studio** | Goal/Logic/Plan → AI generation with streaming |
| **Coder** | Monaco editor + file tree + terminal + AI agent |
| **Dashboard** | Real-time metrics from project state |

---

## Common Tasks

### Create a Project
```
Sidebar → "Projects" section
Type project name → Click "+" button
```

### Generate Code
```
Studio Tab:
1. Fill Goal (what you want to build)
2. Fill Logic (how to build it)
3. Click "Generate Plan" → wait for plan
4. Click "Generate Code" → wait for code
```

### Edit Code
```
Coder Tab:
1. File tree on left shows all files
2. Click file to open in Monaco
3. Edit and press Ctrl+S to save
4. Terminal at bottom for running commands
```

### Use AI Agent
```
Coder Tab → Click "🤖 Antigravity"
Type task: "Add a function to calculate fibonacci"
Agent analyzes workspace and writes code
```

### View Metrics
```
Dashboard Tab → Shows:
- Success rate (% of successful actions)
- File distribution (bar chart)
- Phase completion (pie chart)
- Activity timeline (line chart)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+/` | Toggle comment |
| `Ctrl+P` | Open AI Coder panel |
| `Ctrl+Enter` | Send prompt in AI panels |

---

## Troubleshooting

### "Project creation doesn't work"
→ Check browser console (F12). If 404 error, restart frontend: `npm run dev`

### "LLM generation returns error"
→ Verify Ollama running: `curl http://localhost:11434/api/tags`

### "Files don't appear in Coder"
→ Refresh file tree or switch projects

### "Dashboard shows no data"
→ Create project, fill Goal/Logic, generate plan. Metrics load from real data.

---

## Status

✅ **All features operational**  
✅ **Project creation fixed**  
✅ **Dashboard metrics real**  
✅ **All agents working**  
✅ **Production ready**

---

**For detailed testing:** See `COMPLETE_TESTING_GUIDE.md`  
**For session details:** See `SESSION_9_COMPLETION_REPORT.md`

🚀 **Happy coding!**

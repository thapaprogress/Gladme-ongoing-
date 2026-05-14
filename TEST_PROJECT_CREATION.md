# Testing Project Creation — GladME V5

**Status:** 🔧 FIXED - Ready for testing

---

## Quick Start

### Terminal 1 — Start Backend
```bash
cd c:\Users\BishwajyotiChaudhary\Desktop\gladme\GladMe-Studio\V5\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Terminal 2 — Start Frontend
```bash
cd c:\Users\BishwajyotiChaudhary\Desktop\gladme\GladMe-Studio\V5\frontend
npm run dev
```

---

## Browser Testing

### 1. Open Application
```
URL: http://localhost:5173
```

### 2. Login
```
Email:    dev@gladme.dev
Password: GladME@2026
```

### 3. Create New Project
```
1. Look at left sidebar
2. In "Projects" section, you'll see an input field
3. Type: "My First Test Project"
4. Click the "+" button (or press Enter)
```

**Expected Result:** ✅ Project appears in the sidebar list below the input

### 4. Create More Projects
```
1. Enter: "Second Project"
2. Click "+"
3. Enter: "Third Project"
4. Click "+"
```

**Expected Result:** ✅ All three projects appear in the list

### 5. Select and Edit a Project
```
1. Click on "My First Test Project" in sidebar
2. Main area should show: Goal, Logic, Plan, Code, Evolution, Tests fields
3. Click in Goal field
4. Type: "Build a simple calculator"
5. Click somewhere else or wait 800ms
```

**Expected Result:** ✅ Goal field auto-saves to database

### 6. Delete a Project
```
1. Hover over "Third Project" in sidebar
2. Click the "✕" button that appears
```

**Expected Result:** ✅ Project is removed from list

### 7. Generate a Plan (If Ollama running)
```
1. Select any project
2. Fill in Goal: "Build a web scraper"
3. Fill in Logic: "Use BeautifulSoup library"
4. Click "Generate Plan" button
5. Wait 5-15 seconds for response
```

**Expected Result:** ✅ Plan field populates with AI-generated plan

---

## Troubleshooting

### Issue: Project doesn't appear after clicking "+"
**Check:**
1. Open browser DevTools (F12)
2. Go to "Network" tab
3. Try creating a project
4. Look for POST request to `/api/projects`
5. Should see status 200 with response body like: `{"id":14,"title":"...","currentPhase":"Goal"}`

**If 404 error:**
- The fix may not have been applied
- Try: `npm run dev` again (clears cache)
- Or: Hard refresh with `Ctrl+Shift+Delete` then `Ctrl+F5`

### Issue: Backend returns 401 Unauthorized
**Check:**
1. Token might have expired
2. Logout and login again
3. Check browser console for token in localStorage

### Issue: Backend not running
```bash
# Check if port 8001 is listening
netstat -ano | find "8001"

# If not, start backend:
cd V5/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Issue: Frontend returns CORS error
**Check:**
1. Backend is running on 8001 (not 8000)
2. Frontend .env has: `VITE_API_URL=http://localhost:8001`
3. Backend .env has frontend origins in CORS_ORIGINS

---

## What Was Fixed

The API client in `V5/frontend/src/services/api.js` was missing the `/api` prefix in endpoint URLs.

**Before:**
- Called: `http://localhost:8001/projects`
- Backend expected: `http://localhost:8001/api/projects`
- Result: 404 Not Found ❌

**After:**
- Calls: `http://localhost:8001/api/projects` ✅
- Backend found: `http://localhost:8001/api/projects` ✅
- Result: 200 OK with project data ✅

---

## Success Indicators

✅ New project appears in sidebar immediately  
✅ Can select multiple projects  
✅ Can delete projects  
✅ Can edit Goal/Logic/Plan fields  
✅ Fields auto-save to database  
✅ Can generate plans with Ollama  
✅ Can switch between projects  
✅ Can switch between Studio/Coder/Dashboard tabs  

---

## Commands Reference

**Backend Health Check:**
```bash
curl http://localhost:8001/api/health
```

**Frontend Running Check:**
```bash
curl http://localhost:5173
```

**Create Project via API:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@gladme.dev","password":"GladME@2026"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

curl -X POST http://localhost:8001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Project"}'
```

---

## Next Steps

After confirming project creation works:
1. Try generating a plan (if Ollama is running)
2. Try code generation
3. Check if files appear in Coder tab
4. Check if Studio fields sync to Coder

All features should now be functional!

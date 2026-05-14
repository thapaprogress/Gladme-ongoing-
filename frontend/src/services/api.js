/**
 * GladME Studio V5 — API Service Layer
 * Extended from V4: adds /files and /agents endpoints.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

let authToken = localStorage.getItem("gladme_token") || "";

const setToken = (token) => {
  authToken = token;
  localStorage.setItem("gladme_token", token);
};

const clearToken = () => {
  authToken = "";
  localStorage.removeItem("gladme_token");
};

const headers = () => ({
  "Content-Type": "application/json",
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

const apiFetch = async (url, options = {}) => {
  const fullUrl = `${BASE}/api${url}`;
  const res = await fetch(fullUrl, { ...options, headers: { ...headers(), ...options.headers } });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth-expired"));
    throw new Error("Authentication required");
  }
  return res;
};

// ── Auth ──
export const register = async (email, password, name) => {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  if (data.token) setToken(data.token);
  return data;
};

export const login = async (email, password) => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  if (data.token) setToken(data.token);
  return data;
};

export const getMe = async () => {
  const res = await apiFetch("/auth/me");
  return res.json();
};

export const logout = () => clearToken();
export const isLoggedIn = () => !!authToken;
export const getToken = () => authToken;

// ── Health ──
export const checkHealth = async () => {
  const res = await fetch(`${BASE}/api/health`);
  return res.json();
};

// ── Projects ──
export const fetchProjects = async () => {
  const res = await apiFetch("/projects");
  return res.json();
};

export const createProject = async (title) => {
  const res = await apiFetch("/projects", {
    method: "POST", body: JSON.stringify({ title }),
  });
  return res.json();
};

export const deleteProject = async (id) => {
  const res = await apiFetch(`/projects/${id}`, { method: "DELETE" });
  return res.json();
};

// ── State ──
export const fetchProjectState = async (id) => {
  const res = await apiFetch(`/projects/${id}/state`);
  return res.json();
};

export const updateProjectState = async (id, data) => {
  await apiFetch(`/projects/${id}/state`, {
    method: "PUT", body: JSON.stringify(data),
  });
};

// ── Files (V5 new) ──
export const fetchProjectFiles = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/files`);
  return res.json();
};

export const fetchFileContent = async (projectId, filePath) => {
  const res = await apiFetch(`/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`);
  return res.json();
};

export const saveFileContent = async (projectId, filePath, content) => {
  const res = await apiFetch(`/projects/${projectId}/files/content`, {
    method: "PUT",
    body: JSON.stringify({ path: filePath, content }),
  });
  return res.json();
};

export const createProjectFile = async (projectId, filePath, content = "") => {
  const res = await apiFetch(`/projects/${projectId}/files`, {
    method: "POST",
    body: JSON.stringify({ path: filePath, content }),
  });
  return res.json();
};

export const deleteProjectFile = async (projectId, filePath) => {
  const res = await apiFetch(`/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  return res.json();
};

// ── AI Generation ──
export const generatePlan = async (goal, logic, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/plan", {
    method: "POST", body: JSON.stringify({ goal, logic, model, provider }),
  });
  return res.json();
};

export const generateCode = async (goal, logic, plan, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/code", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, model, provider }),
  });
  return res.json();
};

export const suggestEvolution = async (goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/evolution", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

export const generateTests = async (goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/tests", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

// ── SSE Streaming Generation (V5 Phase 4) ──
export const streamGenerate = async (endpoint, body, onToken, onDone) => {
  const res = await fetch(`${BASE}/api${endpoint}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth-expired"));
    throw new Error("Authentication required");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        if (onDone) onDone(fullText);
        return fullText;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) {
          fullText += parsed.token;
          if (onToken) onToken(parsed.token, fullText, parsed.provider);
        }
      } catch { /* skip malformed */ }
    }
  }
  if (onDone) onDone(fullText);
  return fullText;
};

// ── Templates (V5 Phase 4) ──
export const fetchTemplates = async () => {
  const res = await apiFetch("/templates");
  return res.json();
};

export const createProjectFromTemplate = async (title, templateId) => {
  const res = await apiFetch("/projects/from-template", {
    method: "POST",
    body: JSON.stringify({ title, template_id: templateId }),
  });
  return res.json();
};;

// ── Verification ──
export const verifyProject = async (goal, logic, plan, code, tests = "") => {
  const res = await apiFetch("/verify", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, tests }),
  });
  return res.json();
};

// ── Execution ──
export const executeCode = async (code, timeout = 30) => {
  const res = await apiFetch("/execute", {
    method: "POST", body: JSON.stringify({ code, timeout }),
  });
  return res.json();
};

export const executeTests = async (code, tests, timeout = 45) => {
  const res = await apiFetch("/execute/tests", {
    method: "POST", body: JSON.stringify({ code, tests, timeout }),
  });
  return res.json();
};

// ── Chat ──
export const sendChat = async (message, goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/chat", {
    method: "POST", body: JSON.stringify({ message, goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

export const fetchChatHistory = async (projectId) => {
  const res = await apiFetch(`/chat/history/${projectId}`);
  return res.json();
};

export const clearChatHistory = async (projectId) => {
  const res = await apiFetch(`/chat/history/${projectId}`, { method: "DELETE" });
  return res.json();
};

// ── Versions ──
export const fetchVersions = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/versions`);
  return res.json();
};

export const createVersion = async (projectId, data) => {
  const res = await apiFetch(`/projects/${projectId}/versions`, {
    method: "POST", body: JSON.stringify(data),
  });
  return res.json();
};

export const fetchVersionDetail = async (projectId, versionId) => {
  const res = await apiFetch(`/projects/${projectId}/versions/${versionId}`);
  return res.json();
};

export const fetchVersionDiff = async (projectId, versionAId, versionBId) => {
  const res = await apiFetch(`/projects/${projectId}/versions/diff`, {
    method: "POST",
    body: JSON.stringify({ version_id_a: versionAId, version_id_b: versionBId }),
  });
  return res.json();
};

// ── Logs ──
export const fetchLogs = async (projectId) => {
  const url = projectId ? `/logs?project_id=${projectId}` : "/logs";
  const res = await apiFetch(url);
  return res.json();
};

export const createLog = async (data) => {
  await apiFetch("/logs", {
    method: "POST", body: JSON.stringify(data),
  });
};

// ── Export ──
export const exportProject = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/export`);
  return res.blob();
};

// ── Skills ──
export const fetchSkills = async () => {
  const res = await apiFetch("/skills");
  return res.json();
};

export const executeSkill = async (skillName, projectState, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/skills/execute", {
    method: "POST", body: JSON.stringify({ skill_name: skillName, project_state: projectState, model, provider }),
  });
  return res.json();
};

// ── AI Coder (Antigravity-style prompt → file) ──
export const aiCoderGenerate = async ({ prompt, filename, context, model, provider }) => {
  const res = await apiFetch("/ai/coder", {
    method: "POST",
    body: JSON.stringify({ prompt, filename, context: context || "", model: model || "gemma4:latest", provider: provider || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── AI Coder Execute — auto-apply actions to workspace ──
export const executeCoderActions = async (projectId, actions) => {
  const res = await apiFetch("/ai/coder/execute", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, actions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

export const installSkill = async (manifestJson) => {
  const res = await apiFetch("/skills/install", {
    method: "POST", body: JSON.stringify({ manifest_json: manifestJson }),
  });
  return res.json();
};

// ── MCP ──
export const fetchMCPServers = async () => {
  const res = await apiFetch("/mcp/servers");
  return res.json();
};

export const fetchMCPTools = async () => {
  const res = await apiFetch("/mcp/tools");
  return res.json();
};

export const callMCPTool = async (serverName, toolName, arguments_) => {
  const res = await apiFetch("/mcp/call", {
    method: "POST", body: JSON.stringify({ server_name: serverName, tool_name: toolName, arguments: arguments_ }),
  });
  return res.json();
};

// ── Agents (V5 Mission Control) ──
export const fetchAgents = async (projectId) => {
  const url = projectId ? `/agents?project_id=${projectId}` : "/agents";
  const res = await apiFetch(url);
  return res.json();
};

export const createAgent = async (projectId, task, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/agents", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, task, model, provider }),
  });
  return res.json();
};

export const getAgent = async (agentId) => {
  const res = await apiFetch(`/agents/${agentId}`);
  return res.json();
};

export const deleteAgent = async (agentId) => {
  const res = await apiFetch(`/agents/${agentId}`, { method: "DELETE" });
  return res.json();
};

// ── Provenance ──
export const fetchSBOM = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/sbom`);
  return res.json();
};

export const fetchCompliance = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/compliance`);
  return res.json();
};

// ── Artifacts (V5 Artifact Registry) ──
export const fetchArtifacts = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/artifacts`);
  return res.json();
};

export const createArtifact = async (projectId, { kind, name, file_name, studio_tab, mime_type, read_only, generated_by }) => {
  const params = new URLSearchParams({ kind, name, file_name });
  if (studio_tab) params.set("studio_tab", studio_tab);
  if (mime_type) params.set("mime_type", mime_type);
  if (read_only) params.set("read_only", "true");
  if (generated_by) params.set("generated_by", generated_by);
  const res = await apiFetch(`/projects/${projectId}/artifacts?${params}`, { method: "POST" });
  return res.json();
};

export const deleteArtifact = async (projectId, artifactId) => {
  const res = await apiFetch(`/projects/${projectId}/artifacts/${artifactId}`, { method: "DELETE" });
  return res.json();
};

// ── Dashboards (V5 Dashboard Manager) ──
export const fetchDashboards = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/dashboards`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

export const createDashboard = async (projectId, { name, route, layout_json, components_json, nav_order }) => {
  const res = await apiFetch(`/projects/${projectId}/dashboards`, {
    method: "POST",
    body: JSON.stringify({ name, route, layout_json: layout_json || "{}", components_json: components_json || "[]", nav_order: nav_order || 0 }),
  });
  return res.json();
};

export const updateDashboard = async (projectId, dashboardId, data) => {
  const res = await apiFetch(`/projects/${projectId}/dashboards/${dashboardId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

export const deleteDashboard = async (projectId, dashboardId) => {
  const res = await apiFetch(`/projects/${projectId}/dashboards/${dashboardId}`, { method: "DELETE" });
  return res.json();
};

// ── Nav Routes (V5) ──
export const fetchNavRoutes = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/nav-routes`);
  return res.json();
};

export const updateNavRoutes = async (projectId, routes) => {
  const res = await apiFetch(`/projects/${projectId}/nav-routes`, {
    method: "PUT",
    body: JSON.stringify({ routes }),
  });
  return res.json();
};

import { create } from "zustand";

const _loadTheme = () => {
  try {
    return localStorage.getItem("gladme_theme") || "dark";
  } catch { return "dark"; }
};

const useProjectStore = create((set, get) => ({
  // Auth
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // LLM
  providers: {},
  setProviders: (providers) => set({ providers }),
  selectedModel: "gemma4:latest",
  selectedProvider: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),

  // Projects
  projects: [],
  setProjects: (projects) => set({ projects }),
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  // Project state
  goal: "",
  logic: "",
  plan: "",
  code: "",
  evolution: "",
  tests: "",
  currentPhase: "Goal",
  setGoal: (v) => set({ goal: v }),
  setLogic: (v) => set({ logic: v }),
  setPlan: (v) => set({ plan: v }),
  setCode: (v) => set({ code: v }),
  setEvolution: (v) => set({ evolution: v }),
  setTests: (v) => set({ tests: v }),
  setCurrentPhase: (v) => set({ currentPhase: v }),

  resetProjectState: () =>
    set({ goal: "", logic: "", plan: "", code: "", evolution: "", tests: "", currentPhase: "Goal" }),

  // Execution results (shared between Studio and Coder)
  verifyResult: null,
  execResult: null,
  setVerifyResult: (v) => set({ verifyResult: v }),
  setExecResult: (v) => set({ execResult: v }),

  // Active file in Coder tab (path string)
  activeFile: null,
  activeFileContent: "",
  setActiveFile: (path) => set({ activeFile: path }),
  setActiveFileContent: (content) => set({ activeFileContent: content }),

  // Top-level IDE tab: "studio" | "coder"
  ideTab: "studio",
  setIdeTab: (tab) => set({ ideTab: tab }),

  // Studio sub-tab
  studioTab: "workspace",
  setStudioTab: (tab) => set({ studioTab: tab }),

  // SSE streaming state (V5 Phase 4)
  isStreaming: false,
  streamingText: "",
  streamingPhase: null, // "plan" | "code" | "evolution" | null
  setStreaming: (phase) => set({ isStreaming: true, streamingText: "", streamingPhase: phase }),
  appendStreamingText: (token) => set((s) => ({ streamingText: s.streamingText + token })),
  clearStreaming: () => set({ isStreaming: false, streamingText: "", streamingPhase: null }),

  // Theme (V5 Phase 4) — "dark" | "light"
  theme: _loadTheme(),
  setTheme: (theme) => {
    try { localStorage.setItem("gladme_theme", theme); } catch {}
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("gladme_theme", next); } catch {}
    set({ theme: next });
  },

  // Vibe & Agent History
  vibeHistory: [],
  setVibeHistory: (history) => set({ vibeHistory: history }),
  agentActions: [],
  addAgentAction: (action) => set((s) => ({ agentActions: [action, ...s.agentActions] })),
  clearAgentActions: () => set({ agentActions: [] }),

  // Templates (V5 Phase 4)
  templates: [],
  setTemplates: (templates) => set({ templates }),
}));

export default useProjectStore;

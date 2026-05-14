import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

import LoginScreen from "./components/LoginScreen";
import StudioTab from "./tabs/StudioTab";
import CoderTab from "./tabs/CoderTab";
import DashboardManager from "./components/DashboardManager";
import DashboardCanvas, { WIDGET_TYPES } from "./components/DashboardCanvas";
import useProjectStore from "./store/useProjectStore";
import useDashboardStore from "./store/useDashboardStore";
import { checkHealth, fetchProjects, isLoggedIn, logout } from "./services/api";
import { on, EVENTS } from "./services/eventBus";

function DashboardTabContent() {
  const { selectedProjectId } = useProjectStore();
  const { dashboards, load, create, loading } = useDashboardStore();
  const [activeDashId, setActiveDashId] = useState(null);

  // Load dashboards when project changes
  useEffect(() => {
    if (selectedProjectId) {
      const loadDashboards = async () => {
        await load(selectedProjectId);
        await useDashboardStore.getState().loadMetrics(selectedProjectId);
      };
      loadDashboards();
    }
  }, [selectedProjectId]);

  // Auto-create initial dashboard if none exist
  useEffect(() => {
    if (selectedProjectId && !loading && Array.isArray(dashboards) && dashboards.length === 0) {
      const createInitialDashboard = async () => {
        try {
          await create(selectedProjectId, { name: "Project Overview" });
        } catch (e) {
          console.error("Failed to create initial dashboard:", e);
        }
      };
      createInitialDashboard();
    }
  }, [selectedProjectId, loading, dashboards, create]);

  // Auto-select first dashboard when loaded
  useEffect(() => {
    if (Array.isArray(dashboards) && dashboards.length > 0 && !activeDashId) {
      setActiveDashId(dashboards[0].id);
    }
  }, [dashboards, activeDashId]);

  // Keep activeDash in sync with latest store state (after widget add/remove)
  const activeDash = Array.isArray(dashboards) ? dashboards.find(d => d.id === activeDashId) || null : null;

  // Log state changes for debugging
  React.useEffect(() => {
    console.log("Dashboard state updated:", {
      activeDashId,
      activeDashComponentCount: activeDash?.components?.length || 0,
      allDashboards: dashboards.length
    });
  }, [activeDash?.components?.length, dashboards.length, activeDashId]);

  const handleSelect = (d) => {
    setActiveDashId(d.id);
    // Reload to get full components array from backend
    if (selectedProjectId) load(selectedProjectId);
  };

  const handleAddWidget = async (type) => {
    if (!activeDash || !selectedProjectId) return;
    try {
      const widgetInfo = WIDGET_TYPES.find(w => w.type === type);
      const comp = {
        id: `widget_${Date.now()}`,
        type,
        title: widgetInfo?.label || type,
        config: {},
      };
      const newComponents = [...(activeDash.components || []), comp];
      console.log("Adding widget:", comp, "Total:", newComponents.length);
      await useDashboardStore.getState().update(selectedProjectId, activeDash.id, {
        components_json: JSON.stringify(newComponents),
      });
      console.log("Widget added successfully");
    } catch (e) {
      console.error("Failed to add widget:", e);
      alert("Failed to add widget: " + e.message);
    }
  };

  const handleRemoveWidget = async (idx) => {
    if (!activeDash || !selectedProjectId) return;
    try {
      const comps = [...(activeDash.components || [])];
      comps.splice(idx, 1);
      await useDashboardStore.getState().update(selectedProjectId, activeDash.id, {
        components_json: JSON.stringify(comps),
      });
    } catch (e) {
      console.error("Failed to remove widget:", e);
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="dashboard-sidebar">
        <DashboardManager onSelect={handleSelect} />
      </div>
      <div className="dashboard-main">
        {activeDash ? (
          <DashboardCanvas
            key={activeDash.id}
            dashboard={activeDash}
            onAddWidget={handleAddWidget}
            onRemoveWidget={handleRemoveWidget}
          />
        ) : (
          <div className="dashboard-placeholder">
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "80px 20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
              <h3>Select a Dashboard</h3>
              <p style={{ fontSize: "13px", marginTop: "8px" }}>Choose from the sidebar or create a new one.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const {
    currentUser, setCurrentUser,
    setProviders, providers,
    setSelectedModel,
    setProjects,
    ideTab, setIdeTab,
    theme, toggleTheme,
  } = useProjectStore();

  const initApp = useCallback(async () => {
    try {
      const health = await checkHealth();
      setProviders(health.providers || {});
      const ollamaModels = Array.isArray(health.providers?.ollama?.models) ? health.providers.ollama.models : [];
      const gemma = ollamaModels.find((m) => m.toLowerCase().includes("gemma"));
      setSelectedModel(gemma || ollamaModels[0] || "gemma4:latest");
    } catch (e) {
      console.error("Health check failed:", e);
    }
    try {
      const data = await fetchProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  }, [setProviders, setSelectedModel, setProjects]);

  // Re-hydrate session on mount
  useEffect(() => {
    if (isLoggedIn()) initApp();
  }, [initApp]);

  // Handle token expiry from any tab
  useEffect(() => {
    const handler = () => setCurrentUser(null);
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, [setCurrentUser]);

  // EventBus: artifact-opened auto-switches IDE tab
  useEffect(() => {
    const unsub = on(EVENTS.TAB_SWITCH, ({ tab }) => {
      if (tab) setIdeTab(tab);
    });
    const unsub2 = on(EVENTS.ARTIFACT_OPENED, (artifact) => {
      if (artifact.studio_tab) setIdeTab(artifact.studio_tab);
    });
    // P6: Agent creates dashboard → auto-navigate to Dashboard tab
    const unsub3 = on(EVENTS.NAV_UPDATED, () => {
      setIdeTab("dashboard");
    });
    const unsub4 = on(EVENTS.DASHBOARD_CREATED, () => {
      setIdeTab("dashboard");
    });
    return () => { unsub(); unsub2(); unsub3(); unsub4(); };
  }, [setIdeTab]);

  const handleAuth = (user, token) => {
    setCurrentUser(user);
    initApp();
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setProjects([]);
  };

  const activeProviders = useMemo(
    () => Object.entries(providers).filter(([, v]) => v.available).map(([k]) => k),
    [providers]
  );

  if (!currentUser) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  return (
    <div className="v5-shell" data-theme={theme}>
      {/* ── Top IDE Tab Bar ── */}
      <div className="ide-tabbar">
        <div className="ide-tabbar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">GladME Studio V5</span>
        </div>

        <div className="ide-tabs">
          <button
            className={`ide-tab ${ideTab === "studio" ? "ide-tab--active" : ""}`}
            onClick={() => setIdeTab("studio")}
          >
            🧠 Studio
            <span className="ide-tab-hint">Plan &amp; Vibe</span>
          </button>
          <button
            className={`ide-tab ${ideTab === "coder" ? "ide-tab--active" : ""}`}
            onClick={() => setIdeTab("coder")}
          >
            💻 Coder
            <span className="ide-tab-hint">Edit &amp; Run</span>
          </button>
          <button
            className={`ide-tab ${ideTab === "dashboard" ? "ide-tab--active" : ""}`}
            onClick={() => setIdeTab("dashboard")}
          >
            📊 Dashboard
            <span className="ide-tab-hint">Visualize</span>
          </button>
        </div>

        <div className="ide-tabbar-right">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <span className="provider-badge">
            {activeProviders.length > 0
              ? activeProviders.join(" + ")
              : "Template Mode"}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="ide-content">
        <div 
          className="ide-panel" 
          style={{ display: ideTab === "studio" ? "flex" : "none" }}
        >
          <StudioTab onLogout={handleLogout} />
        </div>
        <div 
          className="ide-panel" 
          style={{ display: ideTab === "coder" ? "flex" : "none" }}
        >
          <CoderTab isVisible={ideTab === "coder"} />
        </div>
        <div 
          className="ide-panel" 
          style={{ display: ideTab === "dashboard" ? "flex" : "none" }}
        >
          <DashboardTabContent />
        </div>
      </div>
    </div>
  );
}

export default App;

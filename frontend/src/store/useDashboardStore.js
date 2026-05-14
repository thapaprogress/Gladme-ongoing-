/**
 * V5 Dashboard Store — Zustand + API sync for dashboards + nav routes.
 */

import { create } from "zustand";
import {
  fetchDashboards, createDashboard as apiCreate,
  updateDashboard as apiUpdate, deleteDashboard as apiDelete,
  fetchNavRoutes, updateNavRoutes as apiUpdateNav,
} from "../services/api";
import { emit, EVENTS } from "../services/eventBus";

const useDashboardStore = create((set, get) => ({
  dashboards: [],
  navRoutes: [],
  loading: false,
  error: null,

  load: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const [dashboards, navRoutes] = await Promise.all([
        fetchDashboards(projectId),
        fetchNavRoutes(projectId),
      ]);
      
      // Parse components_json for each dashboard
      const parsedDashboards = (dashboards || []).map(d => ({
        ...d,
        components: d.components_json ? JSON.parse(d.components_json) : []
      }));

      set({ dashboards: parsedDashboards, navRoutes: navRoutes || [], loading: false });
    } catch (e) {
      set({ dashboards: [], navRoutes: [], error: e.message, loading: false });
    }
  },

  create: async (projectId, data) => {
    const created = await apiCreate(projectId, data);
    set(state => ({ dashboards: [...state.dashboards, created] }));
    emit(EVENTS.DASHBOARD_CREATED, created);
    await get().load(projectId);
    return created;
  },

  update: async (projectId, dashboardId, data) => {
    try {
      console.log("Updating dashboard", dashboardId, "with data:", data);
      const result = await apiUpdate(projectId, dashboardId, data);
      console.log("Update response:", result);
      emit(EVENTS.DASHBOARD_UPDATED, { id: dashboardId, ...data });
      // Reload to ensure fresh components_json is parsed
      await new Promise(resolve => setTimeout(resolve, 100));
      await get().load(projectId);
      console.log("Dashboard reloaded after update");
    } catch (e) {
      console.error("Dashboard update failed:", e);
      set({ error: e.message });
      throw e;
    }
  },

  remove: async (projectId, dashboardId) => {
    await apiDelete(projectId, dashboardId);
    set(state => ({ dashboards: state.dashboards.filter(d => d.id !== dashboardId) }));
    emit(EVENTS.DASHBOARD_DELETED, { id: dashboardId });
  },

  updateNav: async (projectId, routes) => {
    await apiUpdateNav(projectId, routes);
    set({ navRoutes: routes });
    emit(EVENTS.NAV_UPDATED, routes);
  },

  // Project Metrics for Widgets
  metrics: {},
  loadMetrics: async (projectId) => {
    try {
      // Import fetchLogs to get real data
      const { fetchLogs, fetchProjectState, fetchProjectFiles } = await import("../services/api");

      // Get real project data with proper error handling
      const logs = await fetchLogs(projectId).catch(() => []);
      const state = await fetchProjectState(projectId).catch(() => ({}));
      const filesResp = await fetchProjectFiles(projectId).catch(() => ({ tree: [] }));
      const files = filesResp?.tree || [];

      // Calculate real metrics from logs
      const logsArray = Array.isArray(logs) ? logs : [];
      const successCount = logsArray.filter(l => l.result === "Success" || l.status === "success").length;
      const errorCount = logsArray.filter(l => l.result !== "Success" && l.status !== "success").length;
      const totalCount = successCount + errorCount;
      const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0;

      // Count file types from file tree
      const fileStats = {};
      const flattenTree = (nodes) => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (node.type === "file") {
            const ext = node.path?.split(".").pop() || "other";
            fileStats[ext] = (fileStats[ext] || 0) + 1;
          }
          if (node.children) flattenTree(node.children);
        }
      };
      flattenTree(files);

      const fileStatsArray = Object.entries(fileStats).map(([name, value]) => ({
        name: name || "other",
        value: value || 0,
      }));

      // Phase completion - map state fields to phase progress
      const phases = {
        "Goal": !!state.goal,
        "Logic": !!state.logic,
        "Plan": !!state.plan,
        "Code": !!state.code,
        "Tests": !!state.tests,
      };
      const completedPhases = Object.values(phases).filter(Boolean).length;
      const phaseProgress = [
        { name: "Completed", value: completedPhases },
        { name: "Remaining", value: Object.keys(phases).length - completedPhases },
      ];

      // Activity log - aggregate by day (last 7 days)
      const activity = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
        activity[dayName] = 0;
      }

      logsArray.forEach(log => {
        const logDate = new Date(log.created_at || log.timestamp);
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][logDate.getDay()];
        if (activity[dayName] !== undefined) activity[dayName]++;
      });

      const activityArray = Object.entries(activity).map(([name, value]) => ({
        name,
        value: value || 0,
      }));

      const metrics = {
        successRate: parseFloat(successRate),
        totalActions: totalCount,
        successCount,
        errorCount,
        fileTypes: fileStatsArray.length || 0,
        fileStats: fileStatsArray.length > 0 ? fileStatsArray : [
          { name: "No files", value: 0 },
        ],
        phaseProgress,
        activity: activityArray.length > 0 ? activityArray : [
          { name: "No activity", value: 0 },
        ],
        buildStatus: state.code ? "ready" : "pending",
        hasTests: !!state.tests,
        testCount: state.tests ? state.tests.split("\n").filter(l => l.includes("def test")).length : 0,
      };

      set({ metrics });
    } catch (e) {
      console.error("Failed to load metrics:", e);
      set({ metrics: {} });
    }
  },
}));

export default useDashboardStore;
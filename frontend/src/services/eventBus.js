/**
 * V5 EventBus — lightweight pub/sub for cross-module orchestration.
 * Decouples artifact registry, editor, studio, dashboards, and vibe agent.
 */

const listeners = {};

export const on = (event, handler) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
  return () => {
    listeners[event] = listeners[event].filter(h => h !== handler);
  };
};

export const emit = (event, payload) => {
  (listeners[event] || []).forEach(h => {
    try { h(payload); } catch (e) { console.error(`[eventBus] ${event}`, e); }
  });
};

export const EVENTS = {
  ARTIFACT_CREATED: "artifact:created",
  ARTIFACT_UPDATED: "artifact:updated",
  ARTIFACT_DELETED: "artifact:deleted",
  ARTIFACT_OPENED: "artifact:opened",
  ARTIFACT_SAVED: "artifact:saved",
  DASHBOARD_CREATED: "dashboard:created",
  DASHBOARD_UPDATED: "dashboard:updated",
  DASHBOARD_DELETED: "dashboard:deleted",
  AGENT_ACTION: "agent:action",
  NAV_UPDATED: "nav:updated",
  TAB_SWITCH: "tab:switch",
};
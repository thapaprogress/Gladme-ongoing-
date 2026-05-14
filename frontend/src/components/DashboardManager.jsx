import React, { useEffect, useState } from "react";
import useProjectStore from "../store/useProjectStore";
import useDashboardStore from "../store/useDashboardStore";
import { emit, EVENTS } from "../services/eventBus";

export default function DashboardManager({ onSelect }) {
  const { selectedProjectId } = useProjectStore();
  const { dashboards, navRoutes, loading, error, load, create, remove } = useDashboardStore();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (selectedProjectId) load(selectedProjectId);
  }, [selectedProjectId]);

  const handleCreate = async () => {
    if (!newName.trim() || !selectedProjectId) return;
    setCreating(true);
    try {
      const db = await create(selectedProjectId, { name: newName.trim() });
      setNewName("");
      emit(EVENTS.ARTIFACT_CREATED, { kind: "dashboard", name: db.name, id: db.id });
    } catch (e) {
      console.error("Dashboard create failed:", e);
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!selectedProjectId) return;
    await remove(selectedProjectId, id);
  };

  const handleOpen = (dash) => {
    if (onSelect) onSelect(dash);
    emit(EVENTS.TAB_SWITCH, { tab: "dashboard", dashboardId: dash.id });
  };

  if (!selectedProjectId) return <div className="dm-empty">📊 Select a project first</div>;

  return (
    <div className="dashboard-manager">
      <div className="dm-header">
        <h3>📊 Dashboards</h3>
        <div className="dm-create-row">
          <input
            className="dm-input"
            placeholder="New dashboard name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={creating}
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {error && <div className="dm-error">⚠️ {error}</div>}
      {loading && <div className="dm-loading">⏳ Loading dashboards...</div>}

      <div className="dm-list">
        {(!Array.isArray(dashboards) || dashboards.length === 0) && !loading && (
          <div className="dm-empty">No dashboards yet. Create one above.</div>
        )}
        {Array.isArray(dashboards) && dashboards.map((d) => (
          <div key={d.id} className="dm-card" onClick={() => handleOpen(d)}>
            <div className="dm-card-info">
              <span className="dm-card-name">{d.name}</span>
              <span className="dm-card-route">{d.route}</span>
              {d.components && <span className="dm-card-count">{Array.isArray(d.components) ? d.components.length : 0} widgets</span>}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {Array.isArray(navRoutes) && navRoutes.length > 0 && (
        <div className="dm-nav-section">
          <h4>Nav Routes</h4>
          <div className="dm-nav-list">
            {navRoutes.filter(r => r.visible).map((r) => (
              <div key={r.id} className="dm-nav-item">
                <span>{r.icon || "📎"} {r.label}</span>
                <span className="dm-nav-path">{r.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from "react";
import TemplatePicker from "./TemplatePicker";

const Sidebar = ({
  activeTab, setActiveTab, projects, selectedProjectId,
  onCreateProject, onSelectProject, onDeleteProject,
  ollamaConnected, onLogout, currentUser,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreateProject(newTitle.trim());
    setNewTitle("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCreate();
  };

  const navItems = [
    { key: "workspace", icon: "⚡", label: "Workspace" },
    { key: "agents", icon: "🤖", label: "Agents" },
    { key: "vibes", icon: "🪄", label: "Vibes" },
    { key: "monitoring", icon: "📊", label: "Monitoring" },
    { key: "evolution", icon: "🧬", label: "Evolution" },
    { key: "skills", icon: "🔧", label: "Skills" },
    { key: "trust", icon: "🛡️", label: "Trust" },
    { key: "architecture", icon: "🏗️", label: "Architecture" },
    { key: "activity", icon: "📋", label: "Activity Log" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">G</div>
        <div className="sidebar-brand-text">
          <h1>GladME Studio</h1>
          <span>V5 • Unified IDE</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activeTab === item.key ? "active" : ""}`}
            onClick={() => setActiveTab(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        <div className="section-label">Projects</div>
        <div className="project-create-row">
          <input
            className="project-input"
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="New project..."
          />
          <button className="btn-create" onClick={handleCreate} title="Create blank project">+</button>
          <button className="btn-create" onClick={() => setShowTemplates(true)} title="Create from template" style={{background: "var(--gradient-success)"}}>📋</button>
        </div>
        {showTemplates && (
          <TemplatePicker onClose={() => setShowTemplates(false)} />
        )}
        <div className="project-list">
          {!Array.isArray(projects) || projects.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px" }}>No projects yet</div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className={`project-item ${selectedProjectId === p.id ? "selected" : ""}`}
                onClick={() => onSelectProject(p.id)}
              >
                <div className="project-item-info">
                  <div className="project-item-title">{p.title}</div>
                  <div className="project-item-phase">{p.currentPhase || "Goal"}</div>
                </div>
                <button
                  className="project-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                  title="Delete"
                >✕</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-status">
        <div className="status-indicator">
          <div className={`status-dot ${ollamaConnected ? "" : "offline"}`} />
          <span>{ollamaConnected ? "Ollama Connected" : "Template Mode"}</span>
        </div>
        {currentUser && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: "8px", padding: "8px 0", borderTop: "1px solid var(--border-subtle)",
          }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {currentUser.name || currentUser.email}
            </span>
            <button
              onClick={onLogout}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: "12px", padding: "2px 6px",
              }}
            >Logout</button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

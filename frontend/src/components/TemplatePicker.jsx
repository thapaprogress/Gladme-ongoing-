import React, { useEffect, useState } from "react";
import useProjectStore from "../store/useProjectStore";
import { fetchTemplates, createProjectFromTemplate } from "../services/api";

function TemplatePicker({ onClose }) {
  const { setProjects, setSelectedProjectId, projects } = useProjectStore();
  const [templates, setTemplates] = useState([]);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !selected) return;
    setLoading(true);
    try {
      const project = await createProjectFromTemplate(title.trim(), selected);
      setProjects([project, ...projects]);
      setSelectedProjectId(project.id);
      onClose();
    } catch (e) {
      console.error("Template project creation failed:", e);
    }
    setLoading(false);
  };

  return (
    <div className="template-picker-overlay" onClick={onClose}>
      <div className="template-picker" onClick={(e) => e.stopPropagation()}>
        <div className="template-picker-header">
          <h3>Create from Template</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="template-picker-form">
          <input
            className="project-input"
            type="text"
            placeholder="Project name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="template-grid">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`template-card ${selected === t.id ? "template-card--selected" : ""}`}
              onClick={() => setSelected(t.id)}
            >
              <span className="template-icon">{t.icon}</span>
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.description}</span>
            </button>
          ))}
        </div>
        <div className="template-picker-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!title.trim() || !selected || loading}
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplatePicker;
import React, { useState } from "react";
import useProjectStore from "../store/useProjectStore";
import useVibeAgent from "../hooks/useVibeAgent";

const STATUS_LABELS = {
  idle: "Ready",
  planning: "Planning...",
  coding: "Writing code...",
  testing: "Running tests...",
  done: "Complete",
  error: "Error",
  cancelled: "Cancelled",
};

const STATUS_ICONS = {
  idle: "⏳",
  planning: "🧠",
  coding: "💻",
  testing: "🧪",
  done: "✅",
  error: "❌",
};

export default function VibeAgentPanel() {
  const { selectedProjectId } = useProjectStore();
  const { status, log, result, launch, cancel, AGENT_STATES } = useVibeAgent(selectedProjectId);
  const [task, setTask] = useState("");

  if (!selectedProjectId) {
    return (
      <div className="vibe-agent-panel">
        <div className="vibe-agent-empty">
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🤖</div>
            <h3>Vibe Agent</h3>
            <p style={{ fontSize: "13px", marginTop: "8px" }}>Select a project from the sidebar to launch an agent.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task.trim()) return;
    launch(task.trim());
    setTask("");
  };

  const canLaunch = status === AGENT_STATES.IDLE
    || status === AGENT_STATES.DONE
    || status === AGENT_STATES.ERROR
    || status === AGENT_STATES.CANCELLED;

  return (
    <div className="vibe-agent-panel">
      <div className="vibe-agent-header">
        <h3>🤖 Vibe Agent</h3>
        <span className={`vibe-status vibe-status--${status}`}>
          {STATUS_ICONS[status] || "!"} {STATUS_LABELS[status] || status}
        </span>
      </div>

      <form className="vibe-agent-form" onSubmit={handleSubmit}>
        <input
          className="vibe-agent-input"
          placeholder="Describe what you want to build..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={!canLaunch}
        />
        {canLaunch ? (
          <button className="btn btn-primary btn-sm" type="submit" disabled={!task.trim()}>
            Launch
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={cancel}>
            Cancel
          </button>
        )}
      </form>

      {log.length > 0 && (
        <div className="vibe-agent-log">
          {log.map((entry, i) => (
            <div key={i} className={`vibe-log-entry vibe-log-entry--${entry.type}`}>
              <span className="vibe-log-ts">{new Date(entry.ts).toLocaleTimeString()}</span>
              <span className="vibe-log-msg">{entry.msg}</span>
            </div>
          ))}
        </div>
      )}

      {result && status === AGENT_STATES.DONE && (
        <div className="vibe-agent-result">
          <h4>✅ Agent Complete</h4>
          {result.plan && (
            <div className="vibe-result-section">
              <label>Plan</label>
              <pre>{result.plan}</pre>
            </div>
          )}
          {result.code && (
            <div className="vibe-result-section">
              <label>Generated Code</label>
              <pre>{result.code}</pre>
            </div>
          )}
          {result.tests && (
            <div className="vibe-result-section">
              <label>Tests</label>
              <pre>{result.tests}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

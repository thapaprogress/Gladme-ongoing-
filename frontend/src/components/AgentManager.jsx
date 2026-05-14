import React, { useState, useEffect, useRef } from "react";
import useProjectStore from "../store/useProjectStore";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function apiFetch(url, options = {}) {
  const token = localStorage.getItem("gladme_token") || "";
  return fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

const PHASE_LABELS = {
  queued: { label: "Queued", color: "var(--text-muted)" },
  planning: { label: "Planning", color: "var(--accent-cyan)" },
  coding: { label: "Coding", color: "var(--accent-violet)" },
  testing: { label: "Testing", color: "var(--accent-amber)" },
  done: { label: "Done", color: "var(--accent-emerald)" },
  error: { label: "Error", color: "var(--accent-rose)" },
};

function AgentCard({ agent, onRemove, onOpenCode }) {
  const [expanded, setExpanded] = useState(false);
  const phase = PHASE_LABELS[agent.phase] || PHASE_LABELS.queued;
  const isRunning = agent.status === "running" || agent.status === "queued";

  return (
    <div className={`agent-card agent-card--${agent.status}`}>
      <div className="agent-card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="agent-card-left">
          <span className="agent-status-dot" style={{ background: phase.color }} />
          <span className="agent-task">{agent.task}</span>
        </div>
        <div className="agent-card-right">
          <span className="agent-phase-badge" style={{ color: phase.color }}>
            {isRunning && <span className="agent-spinner">⟳ </span>}
            {phase.label}
          </span>
          <span className="agent-id">#{agent.id}</span>
          <span className="agent-expand">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="agent-card-body">
          <div className="agent-logs">
            {Array.isArray(agent.logs) ? agent.logs.map((line, i) => (
              <div key={i} className="agent-log-line">{line}</div>
            )) : <div className="agent-log-line">No logs available</div>}
          </div>
          <div className="agent-card-actions">
            {agent.code && (
              <button className="btn btn-ghost btn-xs" onClick={() => onOpenCode(agent)}>
                💻 Open in Coder
              </button>
            )}
            {!isRunning && (
              <button className="btn btn-ghost btn-xs" onClick={() => onRemove(agent.id)}>
                🗑 Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentManager() {
  const {
    selectedProjectId,
    selectedModel, selectedProvider,
    setIdeTab, setCode,
  } = useProjectStore();

  const [agents, setAgents] = useState([]);
  const [task, setTask] = useState("");
  const [spawning, setSpawning] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchAgents();
    pollRef.current = setInterval(fetchAgents, 2000);
    return () => clearInterval(pollRef.current);
  }, [selectedProjectId]);

  const fetchAgents = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await apiFetch(`/agents?project_id=${selectedProjectId}`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data.reverse() : []);
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    }
  };

  const handleSpawn = async () => {
    if (!task.trim() || !selectedProjectId) return;
    setSpawning(true);
    try {
      await apiFetch("/agents", {
        method: "POST",
        body: JSON.stringify({
          project_id: selectedProjectId,
          task: task.trim(),
          model: selectedModel,
          provider: selectedProvider,
        }),
      });
      setTask("");
      await fetchAgents();
    } catch (e) {
      console.error("Failed to spawn agent:", e);
    }
    setSpawning(false);
  };

  const handleRemove = async (agentId) => {
    try {
      await apiFetch(`/agents/${agentId}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (e) {
      console.error("Failed to remove agent:", e);
    }
  };

  const handleOpenCode = (agent) => {
    if (agent.code) {
      setCode(agent.code);
      setIdeTab("coder");
    }
  };

  const runningCount = agents.filter((a) => a.status === "running" || a.status === "queued").length;

  if (!selectedProjectId) {
    return (
      <div className="agent-manager-empty">
        <p>Select a project to use Mission Control.</p>
      </div>
    );
  }

  return (
    <div className="agent-manager">
      <div className="agent-manager-header">
        <h3>Mission Control</h3>
        <div className="agent-stats">
          {runningCount > 0 && (
            <span className="agent-running-badge">{runningCount} running</span>
          )}
          <span className="agent-total">{agents.length} total</span>
        </div>
      </div>

      {/* Spawn form */}
      <div className="agent-spawn-form">
        <input
          className="agent-task-input"
          placeholder='Describe a task — e.g. "Add JWT auth to this Flask API"'
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSpawn()}
        />
        <button
          className={`btn btn-primary ${spawning ? "btn--loading" : ""}`}
          onClick={handleSpawn}
          disabled={!task.trim() || spawning}
        >
          {spawning ? "⏳ Spawning…" : "🤖 Spawn Agent"}
        </button>
      </div>

      {/* Agent list */}
      <div className="agent-list">
        {agents.length === 0 ? (
          <div className="agent-list-empty">
            <p>No agents yet. Describe a task above to spawn one.</p>
            <p className="agent-list-hint">
              Agents run the full Plan → Code → Test pipeline autonomously.
            </p>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRemove={handleRemove}
              onOpenCode={handleOpenCode}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default AgentManager;

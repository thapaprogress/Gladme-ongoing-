import React from "react";

const ARCHITECTURE = [
  { module: "Goal Manager", agent: "Input Agent", tech: "React + FastAPI", status: "active", desc: "Captures project intent and validates goal completeness" },
  { module: "Logic Processor", agent: "Reasoning Agent", tech: "React + FastAPI", status: "active", desc: "Parses data flow and decision logic into structured rules" },
  { module: "Planner Engine", agent: "Planner Agent", tech: "Ollama + Gemma3", status: "active", desc: "AI-powered development plan generation from goal and logic" },
  { module: "Code Generator", agent: "Coder Agent", tech: "Ollama + Gemma3", status: "active", desc: "Produces implementation code from the plan" },
  { module: "FSM Verifier", agent: "Verifier Agent", tech: "Python", status: "active", desc: "Validates workflow state transitions and dependencies" },
  { module: "Execution Sandbox", agent: "Runner Agent", tech: "Python subprocess", status: "active", desc: "Runs generated code in isolated sandbox with timeout" },
  { module: "Monitor Dashboard", agent: "Monitor Agent", tech: "React + WebSocket", status: "active", desc: "Real-time execution output, metrics, and activity feed" },
  { module: "Evolution Engine", agent: "Evolution Agent", tech: "Ollama + SQLite", status: "active", desc: "AI-driven improvement suggestions and version snapshot management" },
  { module: "Export Pipeline", agent: "Export Agent", tech: "Python zipfile", status: "active", desc: "Downloads project as a structured ZIP with all phase artifacts" },
  { module: "MCP Integration", agent: "Platform Agent", tech: "MCP Protocol", status: "planned", desc: "Connect to IDE extensions, CI/CD, and multi-platform workflows" },
  { module: "Multi-Model Router", agent: "Model Router", tech: "Ollama API", status: "planned", desc: "Switch between Gemma, Llama, Mistral, and other local models" },
  { module: "Collaborative Mode", agent: "Collab Agent", tech: "WebSocket + CRDT", status: "planned", desc: "Real-time multi-user editing with conflict resolution" },
];

const ArchitectureTable = () => {
  return (
    <div className="glass-card">
      <div className="card-header">
        <h3>System Architecture Registry</h3>
        <span className="card-badge badge-planner">Blueprint</span>
      </div>
      <div className="card-body" style={{ overflowX: "auto" }}>
        <table className="arch-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Agent</th>
              <th>Technology</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {ARCHITECTURE.map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.module}</td>
                <td>{row.agent}</td>
                <td><code style={{ fontSize: "12px", color: "var(--accent-indigo)" }}>{row.tech}</code></td>
                <td><span className={`arch-status ${row.status}`}>{row.status}</span></td>
                <td>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchitectureTable;

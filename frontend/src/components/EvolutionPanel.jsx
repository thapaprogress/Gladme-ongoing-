import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
const DiffEditor = lazy(() => import("@monaco-editor/react").then(m => ({ default: m.DiffEditor })));
import { motion } from "framer-motion";
import { fetchVersions, fetchVersionDetail, suggestEvolution, fetchVersionDiff } from "../services/api";
import useProjectStore from "../store/useProjectStore";

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const DIFF_THEME_DATA = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "64748b", fontStyle: "italic" },
    { token: "keyword", foreground: "a78bfa" },
    { token: "string", foreground: "34d399" },
  ],
  colors: {
    "editor.background": "#080c18",
    "editor.foreground": "#e2e8f0",
    "editor.lineHighlightBackground": "#ffffff08",
    "editorCursor.foreground": "#a5b4fc",
    "editor.selectionBackground": "#6366f133",
  },
};

const EvolutionPanel = ({ projectId, goal, logic, plan, code, onRestoreVersion, selectedModel, selectedProvider }) => {
  const { setCode } = useProjectStore();
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [suggestions, setSuggestions] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState(null);
  const [reEvolveCount, setReEvolveCount] = useState(0);
  const [applyBadge, setApplyBadge] = useState(false);

  useEffect(() => {
    if (projectId) loadVersions();
  }, [projectId]);

  const loadVersions = async () => {
    try {
      const data = await fetchVersions(projectId);
      setVersions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load versions:", e);
    }
  };

  const handleViewVersion = async (v) => {
    try {
      const detail = await fetchVersionDetail(projectId, v.id);
      setSelectedVersion(detail);
    } catch (e) {
      console.error("Failed to load version detail:", e);
    }
  };

  const handleViewDiff = async () => {
    if (!selectedVersion) return;
    setDiffContent("Loading...");
    try {
      const res = await fetchVersionDiff(projectId, selectedVersion.id, "latest");
      setDiffContent(res.diff || "No diff available.");
    } catch (e) {
      setDiffContent(`Error: ${e.message}`);
    }
  };

  const handleReEvolve = async () => {
    setLoading(true);
    setReEvolveCount(c => c + 1);
    try {
      const res = await suggestEvolution(goal, logic, plan, code, selectedModel, selectedProvider);
      setSuggestions(res.suggestions || "No suggestions.");
    } catch (e) {
      setSuggestions("Re-evolve failed.");
    }
    setLoading(false);
  };

  // Apply the re-evolved suggestion as new code (extracts code fences if present)
  const handleApplyDiff = () => {
    if (!suggestions) return;
    const fenceMatch = suggestions.match(/```(?:python)?\n([\s\S]*?)```/);
    const newCode = fenceMatch ? fenceMatch[1].trim() : suggestions.trim();
    setCode(newCode);
    setApplyBadge(true);
    setTimeout(() => setApplyBadge(false), 2500);
  };

  const handleSuggestEvolution = async () => {
    setLoading(true);
    setSuggestions("");
    try {
      const res = await suggestEvolution(goal, logic, plan, code, selectedModel, selectedProvider);
      setSuggestions(res.suggestions || "No suggestions available.");
    } catch (e) {
      setSuggestions("Failed to get suggestions. Is Ollama running?");
    }
    setLoading(false);
  };

  return (
    <div className="grid-2">
      {/* Left: Version Timeline */}
      <div className="stack">
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
          <div className="card-header">
            <h3>Version History</h3>
            <span className="card-badge badge-evolution">Timeline</span>
          </div>
          <div className="card-body">
            {versions.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "30px" }}>
                No versions saved yet. Use "Save Version" in the Workspace.
              </div>
            ) : (
              <div className="version-list">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`version-item ${selectedVersion?.id === v.id ? "version-item--active" : ""}`}
                    onClick={() => handleViewVersion(v)}
                  >
                    <div className="version-item-header">
                      <span className="version-number">v{v.version_number}</span>
                      <span className="version-date">{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {Object.keys(JSON.parse(v.diff_summary || "{}")).length} files changed
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Right: Version Detail + Evolution */}
      <div className="stack">
        {selectedVersion && (
          <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
            <div className="card-header">
              <h3>Version v{selectedVersion.version_number} Detail</h3>
              <span className="card-badge badge-evolution">Snapshot</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Goal</label>
                <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-glass)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {selectedVersion.goal || "—"}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Logic</label>
                <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-glass)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {selectedVersion.logic || "—"}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Evolution Note</label>
                <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-glass)", fontSize: "13px", color: "var(--accent-amber)" }}>
                  {selectedVersion.evolution || "—"}
                </div>
              </div>
              <div className="flex gap-sm" style={{ marginTop: "8px" }}>
                <button className="btn btn-sm btn-primary" onClick={handleViewDiff}>
                  📄 View Diff
                </button>
                <button className="btn btn-sm btn-warm" onClick={handleReEvolve} disabled={loading}>
                  🔄 Re-Evolve {reEvolveCount > 0 && `(${reEvolveCount})`}
                </button>
                {suggestions && (
                  <button className="btn btn-sm btn-success" onClick={handleApplyDiff}>
                    {applyBadge ? "✓ Applied!" : "⚡ Apply to Code"}
                  </button>
                )}
              </div>
              {diffContent && (
                <div className="diff-viewer" style={{ marginTop: "12px" }}>
                  <h4>Diff: v{selectedVersion.version_number} ↔ Current</h4>
                  <pre style={{ fontSize: "11px", background: "var(--bg-secondary)", padding: "8px", borderRadius: "6px", maxHeight: "300px", overflow: "auto" }}>
                    {diffContent}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <div className="card-header">
            <h3>AI Evolution Suggestions</h3>
            <span className="card-badge badge-evolution">Evolution Agent</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Let the Evolution Agent analyze your current project and suggest improvements for the next version.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                className="btn btn-warm"
                onClick={handleSuggestEvolution}
                disabled={loading || !goal}
              >
                {loading ? <span className="spinner" /> : "🧬"}
                {loading ? "Analyzing..." : "Get AI Suggestions"}
              </button>
              {suggestions && (
                <button className="btn btn-success btn-sm" onClick={handleApplyDiff}>
                  {applyBadge ? "✓ Applied to Code!" : "⚡ Apply to Code"}
                </button>
              )}
            </div>
            {suggestions && (
              <div className="code-output" style={{ marginTop: "16px", minHeight: "150px", whiteSpace: "pre-wrap" }}>
                {suggestions}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EvolutionPanel;

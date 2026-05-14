import React, { useState } from "react";
import { fetchVersions, fetchVersionDiff } from "../services/api";

function VersionDiffViewer({ projectId }) {
  const [versions, setVersions] = useState([]);
  const [versionA, setVersionA] = useState(null);
  const [versionB, setVersionB] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const loadVersions = async () => {
    if (!projectId) return;
    try {
      const data = await fetchVersions(projectId);
      setVersions(data);
      setShow(true);
    } catch (e) { console.error("Failed to load versions:", e); }
  };

  const handleDiff = async () => {
    if (!versionA || !versionB || !projectId) return;
    setLoading(true);
    try {
      const data = await fetchVersionDiff(projectId, versionA, versionB);
      setDiff(data);
    } catch (e) { console.error("Diff failed:", e); }
    setLoading(false);
  };

  if (!show) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={loadVersions}>
        📜 Compare Versions
      </button>
    );
  }

  return (
    <div className="glass-card" style={{ marginTop: 12 }}>
      <div className="diff-header">
        <h4>Version Diff</h4>
        {diff?.summary && (
          <span className="diff-summary">
            +{diff.summary.code_added} / -{diff.summary.code_removed} lines
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, padding: "12px 16px" }}>
        <select
          className="model-selector"
          value={versionA || ""}
          onChange={(e) => setVersionA(Number(e.target.value))}
        >
          <option value="">Version A</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>v{v.versionNumber}</option>
          ))}
        </select>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>→</span>
        <select
          className="model-selector"
          value={versionB || ""}
          onChange={(e) => setVersionB(Number(e.target.value))}
        >
          <option value="">Version B</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>v{v.versionNumber}</option>
          ))}
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleDiff}
          disabled={!versionA || !versionB || loading}
        >
          {loading ? "Comparing..." : "Compare"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShow(false); setDiff(null); }}>Close</button>
      </div>
      {diff?.diff_code && (
        <div className="diff-viewer">
          {diff.diff_code.map((line, i) => (
            <div key={i} className={`diff-line diff-line--${line.type}`}>
              <span className="diff-line-num">{line.num}</span>
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              {" "}{line.line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VersionDiffViewer;
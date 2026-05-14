import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchCompliance, fetchSBOM } from "../services/api";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const TrustPanel = ({ projectId }) => {
  const [compliance, setCompliance] = useState(null);
  const [sbom, setSbom] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadCompliance = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchCompliance(projectId);
      setCompliance(data);
    } catch {}
    try {
      const data = await fetchSBOM(projectId);
      setSbom(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) loadCompliance();
  }, [projectId]);

  const checks = compliance?.checks || {};
  const pct = compliance?.percentage || 0;
  const pctColor = pct >= 75 ? "var(--accent-emerald)" : pct >= 50 ? "var(--accent-amber)" : "var(--accent-rose)";

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
      <div className="card-header">
        <h3>Trust & Provenance</h3>
        <button className="btn btn-ghost btn-sm" onClick={loadCompliance} disabled={loading}>
          {loading ? <span className="spinner" /> : "🔄"} Refresh
        </button>
      </div>
      <div className="card-body">
        {!compliance ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", fontSize: "13px" }}>
            Select a project and click Refresh to see compliance report.
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "36px", fontWeight: 800, color: pctColor }}>{pct}%</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Trust Score — {compliance.score} — {compliance.status}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Object.entries(checks).map(([key, value]) => (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 12px", borderRadius: "var(--radius-sm)",
                  background: value ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.06)",
                  border: `1px solid ${value ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.15)"}`,
                  fontSize: "13px",
                }}>
                  <span style={{ color: value ? "var(--accent-emerald)" : "var(--accent-rose)", fontWeight: 700 }}>
                    {value ? "✓" : "✗"}
                  </span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>

            {sbom && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
                              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Software Bill of Materials
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  <div>Schema: {sbom.schema}</div>
                  <div>Version: {sbom.gladme_version}</div>
                  <div>LLM: {sbom.llm_provenance?.model} via {sbom.llm_provenance?.provider}</div>
                  <div>Phases tracked: {Object.keys(sbom.phases || {}).length}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default TrustPanel;

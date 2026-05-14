import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import { generateTests, executeTests } from "../services/api";

const MONACO_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: "on",
  wordWrap: "on",
  automaticLayout: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const TestPanel = ({ goal, logic, plan, code, tests, setTests,
                     selectedModel, selectedProvider, onLog }) => {
  const [testResults, setTestResults] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateTests = async () => {
    if (!goal || !code) return;
    setLoading("generate");
    try {
      const res = await generateTests(goal, logic, plan, code, selectedModel, selectedProvider);
      setTests(res.tests);
      if (onLog) onLog("Tests generated", "TestAgent", "Success");
    } catch (e) {
      if (onLog) onLog("Test generation failed", "TestAgent", "Error");
    }
    setLoading(false);
  };

  const handleRunTests = async () => {
    if (!code || !tests) return;
    setLoading("run");
    try {
      const res = await executeTests(code, tests);
      setTestResults(res.test_results);
      setCoverage(res.coverage);
      if (onLog) onLog(
        `Tests run: ${res.test_results?.passed || 0} passed, ${res.test_results?.failed || 0} failed`,
        "TestAgent", res.status === "success" ? "Success" : "Error"
      );
    } catch (e) {
      if (onLog) onLog("Test execution failed", "TestAgent", "Error");
    }
    setLoading(false);
  };

  const coveragePercent = coverage?.percent || 0;
  const coverageColor = coveragePercent >= 80 ? "var(--accent-emerald)"
    : coveragePercent >= 50 ? "var(--accent-amber)" : "var(--accent-rose)";

  return (
    <div className="stack">
      <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
        <div className="card-header">
          <h3>Test Suite</h3>
          <span className="card-badge badge-verifier">Test Agent</span>
        </div>
        <div className="card-body">
          <div className="btn-row" style={{ marginBottom: "12px" }}>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateTests} disabled={!!loading}>
              {loading === "generate" ? <span className="spinner" /> : "🧪"}
              Generate Tests
            </button>
            <button className="btn btn-success btn-sm" onClick={handleRunTests} disabled={!!loading || !tests}>
              {loading === "run" ? <span className="spinner" /> : "▶"}
              Run Tests
            </button>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
            <Editor
              height="220px" language="python" value={tests}
              onChange={(v) => setTests(v || "")}
              theme="vs-dark" options={{ ...MONACO_OPTIONS, readOnly: false }}
              loading={<div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", background: "#080c18", color: "#64748b", fontSize: "13px" }}>Loading editor…</div>}
            />
          </div>
        </div>
      </motion.div>

      {coverage && (
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
          <div className="card-header">
            <h3>Coverage</h3>
            <span style={{ fontWeight: 700, color: coverageColor, fontSize: "14px" }}>{coveragePercent}%</span>
          </div>
          <div className="card-body">
            <div style={{
              height: "8px", borderRadius: "4px",
              background: "rgba(255,255,255,0.06)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${coveragePercent}%`,
                background: coverageColor, borderRadius: "4px",
                transition: "width 0.5s ease",
              }} />
            </div>
            {coverage.files?.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "12px" }}>
                <span style={{ flex: 1, color: "var(--text-secondary)" }}>{f.name}</span>
                <span style={{ fontWeight: 600, color: f.coverage >= 80 ? "var(--accent-emerald)" : "var(--accent-amber)" }}>{f.coverage}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {testResults && (
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <div className="card-header">
            <h3>Test Results</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "rgba(16,185,129,0.2)", color: "var(--accent-emerald)", fontWeight: 700 }}>
                {testResults.passed} passed
              </span>
              {testResults.failed > 0 && (
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "rgba(244,63,94,0.2)", color: "var(--accent-rose)", fontWeight: 700 }}>
                  {testResults.failed} failed
                </span>
              )}
            </div>
          </div>
          <div className="card-body">
            {testResults.tests?.map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "8px",
                padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                fontSize: "13px",
              }}>
                <span style={{ color: t.status === "passed" ? "var(--accent-emerald)" : "var(--accent-rose)", fontWeight: 700 }}>
                  {t.status === "passed" ? "✓" : "✗"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--text-primary)" }}>{t.name}</div>
                  {t.message && (
                    <div style={{ color: "var(--accent-rose)", fontSize: "12px", marginTop: "2px" }}>{t.message}</div>
                  )}
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {typeof t.duration === "number" ? `${t.duration.toFixed(2)}s` : ""}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TestPanel;

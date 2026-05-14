import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { suggestEvolution } from "../services/api";

// ─── Monaco Theme ────────────────────────────────────────────────────────────
const MONACO_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: "on",
  roundedSelection: true,
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: "gutter",
  wordWrap: "on",
  automaticLayout: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

const THEME_DATA = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "64748b", fontStyle: "italic" },
    { token: "keyword", foreground: "a78bfa" },
    { token: "string", foreground: "34d399" },
    { token: "number", foreground: "f59e0b" },
    { token: "type", foreground: "38bdf8" },
  ],
  colors: {
    "editor.background": "#080c18",
    "editor.foreground": "#e2e8f0",
    "editor.lineHighlightBackground": "#ffffff08",
    "editorCursor.foreground": "#a5b4fc",
    "editor.selectionBackground": "#6366f133",
    "editorGutter.background": "#0a0e1a",
    "editorLineNumber.foreground": "#334155",
    "editorLineNumber.activeForeground": "#94a3b8",
  },
};

function handleEditorWillMount(monaco) {
  monaco.editor.defineTheme("gladme-dark", THEME_DATA);
}

const MonacoBlock = ({ value, onChange, language, height, placeholder, readOnly }) => (
  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
    <Editor
      height={height || "260px"}
      language={language}
      value={value}
      onChange={readOnly ? undefined : (v) => onChange(v || "")}
      theme="gladme-dark"
      beforeMount={handleEditorWillMount}
      options={{ ...MONACO_OPTIONS, readOnly: !!readOnly, placeholder }}
      loading={
        <div style={{
          height: height || "260px", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#080c18",
          color: "#64748b", fontSize: "13px",
        }}>
          Loading editor…
        </div>
      }
    />
  </div>
);

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// ─── Verify Panel ────────────────────────────────────────────────────────────
const VerifyPanel = ({ verifyResult, onVerify, loading }) => {
  const phases = verifyResult?.phases || {};
  const issues = verifyResult?.issues || [];
  const status = verifyResult?.status;

  const statusColor =
    status === "PASS" ? "#10b981"
    : status === "FAIL" ? "#f43f5e"
    : status === "WARNING" ? "#f59e0b"
    : "#64748b";

  const statusIcon =
    status === "PASS" ? "✅" : status === "FAIL" ? "❌" : status === "WARNING" ? "⚠" : "◯";

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
      <div className="card-header">
        <h3>FSM Verification</h3>
        <span className="card-badge badge-verifier">Verifier</span>
      </div>
      <div className="card-body">
        {/* Run button */}
        <button
          className="btn btn-success"
          onClick={onVerify}
          disabled={loading === "verify"}
          style={{ width: "100%", marginBottom: "16px" }}
        >
          {loading === "verify" ? <span className="spinner" /> : "✅"}
          Run Workflow Verification
        </button>

        {/* Phase checklist */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[
            { key: "goal",  label: "Goal",  icon: "🎯" },
            { key: "logic", label: "Logic", icon: "🧠" },
            { key: "plan",  label: "Plan",  icon: "📋" },
            { key: "code",  label: "Code",  icon: "💻" },
          ].map(({ key, label, icon }) => (
            <div key={key} style={{
              flex: "1 1 40%",
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: phases[key]
                ? "rgba(16,185,129,0.12)"
                : "rgba(244,63,94,0.10)",
              border: `1px solid ${phases[key] ? "#10b98144" : "#f43f5e33"}`,
              fontSize: "12px",
              fontWeight: 600,
              color: phases[key] ? "#10b981" : "#f43f5e",
            }}>
              <span>{icon}</span>
              <span>{label}</span>
              <span style={{ marginLeft: "auto" }}>{phases[key] ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>

        {/* Overall status */}
        {verifyResult && (
          <div style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}44`,
            marginBottom: "12px",
            fontSize: "13px",
          }}>
            <div style={{ fontWeight: 700, color: statusColor, marginBottom: "4px", fontSize: "14px" }}>
              {statusIcon} {status} — {verifyResult.recommendation}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>
              Model: {verifyResult.model_type} &nbsp;|&nbsp; Checks run: {verifyResult.checks_run ?? issues.length}
            </div>
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {issues.map((issue, i) => {
              const levelColor =
                issue.level === "ERROR" ? "#f43f5e"
                : issue.level === "WARNING" ? "#f59e0b"
                : "#64748b";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "8px",
                  padding: "8px 12px", borderRadius: "8px",
                  background: `${levelColor}12`,
                  border: `1px solid ${levelColor}30`,
                  fontSize: "12px",
                }}>
                  <span style={{
                    background: levelColor, color: "#fff",
                    padding: "1px 7px", borderRadius: "5px",
                    fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap", marginTop: "1px",
                  }}>
                    {issue.level}
                  </span>
                  <span style={{ color: "#cbd5e1", lineHeight: "1.5" }}>{issue.msg}</span>
                </div>
              );
            })}
          </div>
        )}

        {!verifyResult && (
          <div style={{ textAlign: "center", color: "#475569", fontSize: "13px", padding: "20px 0" }}>
            Click "Run Workflow Verification" to analyse your project state.
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Evolve Panel (inline, inside Workspace) ─────────────────────────────────
const EvolvePanel = ({
  evolution, setEvolution,
  goal, logic, plan, code,
  onSaveVersion, onExport,
  selectedModel,
}) => {
  const [suggestions, setSuggestions] = useState("");
  const [loadingSug, setLoadingSug] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSuggest = async () => {
    setLoadingSug(true);
    try {
      const res = await suggestEvolution(goal, logic, plan, code, selectedModel);
      setSuggestions(res.suggestions || "");
    } catch {
      setSuggestions("Could not fetch suggestions — check Ollama connection.");
    }
    setLoadingSug(false);
  };

  const handleSave = async () => {
    await onSaveVersion();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
      <div className="card-header">
        <h3>Evolution Engine</h3>
        <span className="card-badge badge-evolution">Evolve</span>
      </div>
      <div className="card-body">
        {/* Evolution Note editor */}
        <div className="form-group" style={{ marginBottom: "12px" }}>
          <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>
            📝 Evolution Note
            <span style={{ color: "#475569", fontWeight: 400, marginLeft: "8px", fontSize: "11px" }}>
              What changed / why?
            </span>
          </label>
          <textarea
            className="form-textarea"
            value={evolution}
            onChange={(e) => setEvolution(e.target.value)}
            rows={3}
            placeholder="Describe what you're improving in this iteration — e.g. 'Added retry logic to the API layer and improved error messages.'"
          />
        </div>

        {/* Actions */}
        <div className="btn-row" style={{ marginBottom: "16px" }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSuggest}
            disabled={loadingSug}
          >
            {loadingSug ? <span className="spinner" /> : "🧬"}
            AI Suggestions
          </button>
          <button
            className="btn btn-warm btn-sm"
            onClick={handleSave}
          >
            {saved ? "✓ Saved!" : "💾 Save Version"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onExport}>
            📦 Export ZIP
          </button>
        </div>

        {/* AI suggestions output */}
        <AnimatePresence>
          {suggestions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                borderRadius: "10px",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.25)",
                padding: "14px 16px",
              }}>
                <div style={{
                  fontSize: "11px", fontWeight: 700, color: "#f59e0b",
                  marginBottom: "10px", letterSpacing: "0.06em",
                }}>
                  🧬 EVOLUTION SUGGESTIONS
                </div>
                <MonacoBlock
                  value={suggestions}
                  onChange={setSuggestions}
                  language="markdown"
                  height="240px"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─── Execution Result ────────────────────────────────────────────────────────
const ExecOutput = ({ execResult, onExecute, loading, hasCode }) => (
  <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
    <div className="card-header">
      <h3>Execution Output</h3>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {execResult && (
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
            background: execResult.status === "success" ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)",
            color: execResult.status === "success" ? "#10b981" : "#f43f5e",
            fontWeight: 700,
          }}>
            {execResult.status === "success" ? "✓ OK" : "✗ ERROR"}
          </span>
        )}
        <span className="card-badge badge-monitor">Sandbox</span>
      </div>
    </div>
    <div className="card-body">
      <button
        className="btn btn-ghost btn-sm"
        onClick={onExecute}
        disabled={!hasCode || !!loading}
        style={{ width: "100%", marginBottom: "12px" }}
      >
        {loading === "execute" ? <span className="spinner" /> : "▶"}
        Run Code
      </button>

      <div className="console-output" style={{ minHeight: "120px" }}>
        {execResult ? (
          <>
            {execResult.stdout && (
              <div className="console-line" style={{ whiteSpace: "pre-wrap" }}>
                {execResult.stdout}
              </div>
            )}
            {execResult.stderr && (
              <div className="console-line stderr" style={{ whiteSpace: "pre-wrap" }}>
                {execResult.stderr}
              </div>
            )}
            <div className="console-line system">
              — Exit code: {execResult.exit_code} ({execResult.status})
            </div>
          </>
        ) : (
          <div className="console-line system">
            No output yet. Click "Run Code" above to execute your code.
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

// ─── Main Workspace ───────────────────────────────────────────────────────────
const Workspace = ({
  goal, setGoal,
  logic, setLogic,
  plan, setPlan,
  code, setCode,
  evolution, setEvolution,
  onGeneratePlan, onGenerateCode, onVerify,
  onSaveVersion, onExport, onExecute,
  verifyResult, execResult,
  loading,
  selectedModel,
}) => {
  return (
    <div className="grid-2">
      {/* ── LEFT COLUMN ── */}
      <div className="stack">
        {/* Project Definition */}
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
          <div className="card-header">
            <h3>Project Definition</h3>
            <span className="card-badge badge-input">Input</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">🎯 Goal</label>
              <textarea
                className="form-textarea"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                placeholder="What should this system accomplish? Be specific about the problem, domain, and desired outcome…"
              />
            </div>
            <div className="form-group">
              <label className="form-label">🧠 Logic</label>
              <textarea
                className="form-textarea"
                value={logic}
                onChange={(e) => setLogic(e.target.value)}
                rows={4}
                placeholder="How should it work? Describe the data flow, processing steps, and decision rules…"
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={onGeneratePlan} disabled={loading}>
                {loading === "plan" ? <span className="spinner" /> : "⚡"}
                Generate Plan
              </button>
              <button
                className="btn btn-primary"
                onClick={onGenerateCode}
                disabled={loading}
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
              >
                {loading === "code" ? <span className="spinner" /> : "💻"}
                Generate Code
              </button>
            </div>
          </div>
        </motion.div>

        {/* Verify Panel */}
        <VerifyPanel
          verifyResult={verifyResult}
          onVerify={onVerify}
          loading={loading}
        />

        {/* Evolve Panel */}
        <EvolvePanel
          evolution={evolution}
          setEvolution={setEvolution}
          goal={goal}
          logic={logic}
          plan={plan}
          code={code}
          onSaveVersion={onSaveVersion}
          onExport={onExport}
          selectedModel={selectedModel}
        />
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="stack">
        {/* Agentic Plan */}
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
          <div className="card-header">
            <h3>Agentic Plan</h3>
            <span className="card-badge badge-planner">Planner Agent</span>
          </div>
          <div className="card-body">
            <MonacoBlock
              value={plan}
              onChange={setPlan}
              language="markdown"
              height="280px"
              placeholder="Click 'Generate Plan' to create an AI-powered development plan…"
            />
          </div>
        </motion.div>

        {/* Generated Code */}
        <motion.div
          className="glass-card"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.08 }}
        >
          <div className="card-header">
            <h3>Generated Code</h3>
            <span className="card-badge badge-coder">Coder Agent</span>
          </div>
          <div className="card-body">
            <MonacoBlock
              value={code}
              onChange={setCode}
              language="python"
              height="280px"
              placeholder="Click 'Generate Code' to produce AI-powered implementation…"
            />
          </div>
        </motion.div>

        {/* Execution Output */}
        <ExecOutput
          execResult={execResult}
          onExecute={onExecute}
          loading={loading}
          hasCode={!!code}
        />
      </div>
    </div>
  );
};

export default Workspace;

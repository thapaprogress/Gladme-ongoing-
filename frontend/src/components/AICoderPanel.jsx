import React, { useState, useRef } from "react";
import useProjectStore from "../store/useProjectStore";
import { aiCoderGenerate } from "../services/api";

const QUICK_PROMPTS = [
  { label: "Flask API", prompt: "Create a Flask REST API with CRUD endpoints for a 'tasks' resource using SQLite." },
  { label: "React Hook", prompt: "Write a custom React hook called useFetch that fetches data from a URL with loading/error state." },
  { label: "Async scraper", prompt: "Write an async Python web scraper using httpx and BeautifulSoup that accepts a URL and returns all links." },
  { label: "CLI tool", prompt: "Create a Python CLI tool with argparse that reads a CSV and prints summary statistics." },
  { label: "FastAPI CRUD", prompt: "Write a FastAPI app with Pydantic models and SQLAlchemy for a 'notes' API with full CRUD." },
  { label: "Docker Compose", prompt: "Generate a docker-compose.yml for a Python FastAPI backend + React frontend + PostgreSQL database." },
];

export default function AICoderPanel({ onApplyCode, existingCode }) {
  const { selectedProjectId, selectedModel, selectedProvider } = useProjectStore();
  const [prompt, setPrompt] = useState("");
  const [filename, setFilename] = useState("main.py");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await aiCoderGenerate({
        prompt: prompt.trim(),
        filename,
        context: existingCode || "",
        model: selectedModel || "gemma4:latest",
        provider: selectedProvider || null,
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleApply = () => {
    if (!result?.code || !onApplyCode) return;
    onApplyCode(result.code, result.filename || filename);
  };

  const handleCopy = async () => {
    if (!result?.code) return;
    await navigator.clipboard.writeText(result.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuick = (q) => {
    setPrompt(q.prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="ai-coder-panel">
      <div className="ai-coder-header">
        <h3>🪄 AI Coder</h3>
        <span className="ai-coder-badge">Antigravity Agent</span>
      </div>

      <div className="ai-coder-quick">
        {QUICK_PROMPTS.map((q) => (
          <button key={q.label} className="quick-chip" onClick={() => handleQuick(q)}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="ai-coder-form">
        <div className="ai-coder-row">
          <input
            className="ai-coder-filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="filename.py"
            title="Target filename"
          />
        </div>
        <textarea
          ref={textareaRef}
          className="ai-coder-prompt"
          rows={4}
          placeholder="Describe what you want to build or modify... (e.g. 'Add a /health endpoint to my FastAPI app')"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />
        <div className="ai-coder-actions">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? <><span className="spinner" /> Generating...</> : "⚡ Generate"}
          </button>
          <span className="ai-coder-hint">Ctrl+Enter to generate</span>
        </div>
      </div>

      {error && (
        <div className="ai-coder-error">✗ {error}</div>
      )}

      {result && (
        <div className="ai-coder-result">
          <div className="ai-coder-result-header">
            <span className="ai-coder-result-file">📄 {result.filename}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
              {onApplyCode && (
                <button className="btn btn-success btn-sm" onClick={handleApply}>
                  ⚡ Apply to Editor
                </button>
              )}
            </div>
          </div>
          <pre className="ai-coder-code">{result.code}</pre>
        </div>
      )}
    </div>
  );
}

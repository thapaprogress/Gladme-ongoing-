import React, { useState, useRef, useEffect } from "react";
import useProjectStore from "../store/useProjectStore";

const PROVIDER_META = {
  ollama:    { icon: "🦙", label: "Ollama",    color: "#34d399", hint: "Local (free)" },
  openai:    { icon: "🟢", label: "OpenAI",    color: "#60a5fa", hint: "GPT-4o / GPT-4" },
  anthropic: { icon: "🟣", label: "Anthropic", color: "#a78bfa", hint: "Claude 3.5+" },
  gemini:    { icon: "💎", label: "Gemini",    color: "#fbbf24", hint: "Google AI" },
  grok:      { icon: "✦",  label: "Grok",      color: "#f87171", hint: "xAI" },
  deepseek:  { icon: "🔵", label: "DeepSeek",  color: "#67e8f9", hint: "DeepSeek AI" },
};

function LLMProviderPanel() {
  const {
    providers,
    selectedModel, setSelectedModel,
    selectedProvider, setSelectedProvider,
  } = useProjectStore();

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Build flat list of available provider+model combos
  const providerEntries = Object.entries(providers || {})
    .filter(([, info]) => info.available && info.models?.length > 0);

  const currentMeta = PROVIDER_META[selectedProvider] || PROVIDER_META.ollama;

  return (
    <div className="llm-selector" ref={panelRef}>
      {/* Trigger button */}
      <button
        className={`llm-trigger ${open ? "llm-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Switch LLM provider"
      >
        <span className="llm-trigger-icon">{currentMeta.icon}</span>
        <span className="llm-trigger-label">{currentMeta.label}</span>
        <span className="llm-trigger-model">/ {selectedModel?.split(":")[0] || "—"}</span>
        <span className="llm-trigger-caret">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="llm-panel">
          <div className="llm-panel-header">LLM Providers</div>

          {providerEntries.length === 0 ? (
            <div className="llm-panel-empty">
              No providers available.<br />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Start Ollama or set API keys in .env
              </span>
            </div>
          ) : (
            providerEntries.map(([name, info]) => {
              const meta = PROVIDER_META[name] || { icon: "🤖", label: name, color: "#94a3b8", hint: "" };
              return (
                <div key={name} className="llm-provider-group">
                  <div className="llm-provider-label">
                    <span className="llm-provider-icon">{meta.icon}</span>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    <span className="llm-provider-hint">{meta.hint}</span>
                    <span
                      className="llm-status-dot"
                      style={{ background: meta.color }}
                      title="Available"
                    />
                  </div>
                  <div className="llm-model-list">
                    {Array.isArray(info.models) && info.models.map((m) => {
                      const isActive = selectedModel === m && selectedProvider === name;
                      return (
                        <button
                          key={`${name}:${m}`}
                          className={`llm-model-btn ${isActive ? "llm-model-btn--active" : ""}`}
                          onClick={() => {
                            setSelectedModel(m);
                            setSelectedProvider(name);
                            setOpen(false);
                          }}
                        >
                          {isActive && <span className="llm-active-dot">●</span>}
                          <span className="llm-model-name">{m}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div className="llm-panel-footer">
            <span>Add API keys in <code>V5/backend/.env</code></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LLMProviderPanel;

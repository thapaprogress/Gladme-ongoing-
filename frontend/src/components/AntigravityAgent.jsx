import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useProjectStore from "../store/useProjectStore";
import {
  aiCoderGenerate,
  executeCoderActions,
  createProjectFile,
  deleteProjectFile,
  fetchProjectFiles,
  fetchFileContent,
  saveFileContent,
} from "../services/api";
import { emit, EVENTS } from "../services/eventBus";

// ── Action parser: reads ACTION: TYPE | path | content blocks from LLM ──────
function parseActions(text) {
  const actions = [];
  
  // Match: ACTION: WRITE_FILE | path/to/file.ext
  // ```lang
  // <content>
  // ```
  const writeRx = /ACTION:\s*WRITE_FILE\s*\|\s*([^\|\n]+)\n*```(?:\w+)?\n([\s\S]*?)```/g;
  const deleteRx = /ACTION:\s*DELETE_FILE\s*\|\s*([^\|\n]+)/g;

  let m;
  while ((m = writeRx.exec(text)) !== null) {
    actions.push({ type: "WRITE_FILE", path: m[1].trim(), content: m[2].trim() });
  }
  while ((m = deleteRx.exec(text)) !== null) {
    actions.push({ type: "DELETE_FILE", path: m[1].trim() });
  }

  // Also detect raw markdown code blocks if no explicit ACTION:
  if (actions.length === 0) {
    const codeRx = /```(?:\w+)?\n([\s\S]*?)```/g;
    while ((m = codeRx.exec(text)) !== null) {
      // We'll treat these as pending WRITE candidates shown inline
      actions.push({ type: "CODE_BLOCK", content: m[1].trim() });
    }
  }
  return actions;
}

// ── Task step renderer ───────────────────────────────────────────────────────
function TaskStep({ step }) {
  const icons = {
    thinking: "🤔",
    searching: "🔍",
    writing: "✏️",
    deleting: "🗑️",
    done: "✅",
    error: "❌",
  };
  return (
    <div className="ag-step">
      <span className="ag-step-icon">{icons[step.type] || "•"}</span>
      <span className="ag-step-text">{step.text}</span>
      {step.type === "thinking" && (
        <span className="ag-step-spinner">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </span>
      )}
    </div>
  );
}

// ── Code block with apply button ─────────────────────────────────────────────
function CodeBlock({ code, path, onApply, applied }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="ag-code-block">
      {path && <div className="ag-code-path">📄 {path}</div>}
      <pre className="ag-code-pre">{code}</pre>
      <div className="ag-code-actions">
        <button className="ag-code-btn" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
        {path && (
          <button
            className={`ag-code-btn ag-code-btn--apply ${applied ? "ag-code-btn--applied" : ""}`}
            onClick={onApply}
            disabled={applied}
          >
            {applied ? "✓ Applied" : "Apply to Workspace"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main message bubble ──────────────────────────────────────────────────────
function AgMessage({ msg, onApplyAction }) {
  const isUser = msg.role === "user";

  // Render markdown-ish content with code blocks
  const parts = [];
  const codeRx = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = codeRx.exec(msg.content)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: msg.content.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1], content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < msg.content.length) parts.push({ type: "text", content: msg.content.slice(last) });

  return (
    <motion.div
      className={`ag-msg ${isUser ? "ag-msg--user" : "ag-msg--assistant"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!isUser && <div className="ag-msg-avatar">✨</div>}
      <div className="ag-msg-body">
        {parts.map((p, i) =>
          p.type === "code" ? (
            <CodeBlock
              key={i}
              code={p.content}
              path={msg.actions?.find(a => a.type === "WRITE_FILE")?.path}
              applied={msg.applied}
              onApply={() => onApplyAction(msg, p.content)}
            />
          ) : (
            <div key={i} className="ag-msg-text">{p.content}</div>
          )
        )}
        {/* Explicit proposed action cards */}
        {msg.actions?.filter(a => a.type !== "CODE_BLOCK").map((action, i) => (
          <div key={i} className="ag-action-card">
            <div className="ag-action-header">
              <span className="ag-action-type">{action.type === "WRITE_FILE" ? "✏️ Write File" : "🗑️ Delete File"}</span>
              <code className="ag-action-path">{action.path}</code>
            </div>
            {action.content && (
              <pre className="ag-action-preview">{action.content.slice(0, 200)}{action.content.length > 200 ? "\n..." : ""}</pre>
            )}
            <div className="ag-action-btns">
              <button
                className="ag-btn ag-btn--approve"
                onClick={() => onApplyAction(msg, null, action)}
                disabled={msg.applied}
              >
                {msg.applied ? "✓ Applied" : "Approve & Run"}
              </button>
            </div>
          </div>
        ))}
        {msg.steps && msg.steps.map((s, i) => <TaskStep key={i} step={s} />)}
      </div>
    </motion.div>
  );
}

// ── File Tree mini panel ─────────────────────────────────────────────────────
function FilesPanel({ files, selectedFile, onSelect }) {
  const flat = (nodes, depth = 0) => {
    const items = [];
    for (const n of nodes || []) {
      items.push({ ...n, depth });
      if (n.children) items.push(...flat(n.children, depth + 1));
    }
    return items;
  };
  const flatFiles = flat(files);

  return (
    <div className="ag-files-panel">
      <div className="ag-files-header">FILES</div>
      {flatFiles.length === 0 ? (
        <div className="ag-files-empty">Empty directory</div>
      ) : (
        flatFiles.map(f => (
          <button
            key={f.path}
            className={`ag-file-item ${selectedFile === f.path ? "ag-file-item--active" : ""}`}
            style={{ paddingLeft: `${12 + f.depth * 12}px` }}
            onClick={() => onSelect(f)}
          >
            <span>{f.type === "dir" ? "📁" : "📄"} {f.name}</span>
          </button>
        ))
      )}
    </div>
  );
}

// ── Main AntigravityAgent Component ──────────────────────────────────────────
export default function AntigravityAgent({ onOpenFile, isSidebarMode, onClose }) {
  const {
    selectedProjectId, selectedModel, selectedProvider,
    goal, logic, plan, code: studioCode,
    activeFile, activeFileContent,
    agentActions, addAgentAction, clearAgentActions,
  } = useProjectStore();

  const [tasks, setTasks] = useState([]);          // task history (sidebar)
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [messages, setMessages] = useState([]);     // current task messages
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFiles, setShowFiles] = useState(true);
  const [taskName, setTaskName] = useState("New Task");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Load files and reset state on mount / project change
  useEffect(() => {
    if (selectedProjectId) {
      refreshFiles();
      setTasks([]);
      setMessages([]);
      startNewTask();
    }
  }, [selectedProjectId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const refreshFiles = async () => {
    try {
      const data = await fetchProjectFiles(selectedProjectId);
      setFiles(data.tree || []);
    } catch {}
  };

  // ── New Task ────────────────────────────────────────────────────────────
  const startNewTask = () => {
    const id = Date.now().toString();
    const task = { id, name: "New Task", messages: [], ts: new Date().toLocaleTimeString() };
    setTasks(prev => [task, ...prev]);
    setActiveTaskId(id);
    setMessages([]);
    setTaskName("New Task");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Build context for agent (token-budget aware) ───────────────────────
  const buildContext = () => {
    const fileList = [];
    const flat = (nodes) => {
      for (const n of nodes || []) {
        if (n.type === "file") fileList.push(n.path);
        if (n.children) flat(n.children);
      }
    };
    flat(files);

    // Hard caps to stay well within the 64k token limit
    const MAX_FILES    = 50;
    const MAX_CONTENT  = 600;   // chars of active file shown to LLM
    const MAX_GOAL     = 200;
    const MAX_PLAN     = 300;

    const shownFiles = fileList.slice(0, MAX_FILES);
    const moreFiles  = fileList.length > MAX_FILES ? ` (+${fileList.length - MAX_FILES} more)` : "";

    const contentSnippet = activeFileContent
      ? activeFileContent.slice(0, MAX_CONTENT) + (activeFileContent.length > MAX_CONTENT ? "\n...(truncated)" : "")
      : "(empty)";

    return [
      `Workspace files (${shownFiles.length}${moreFiles}): ${shownFiles.join(", ") || "none"}`,
      `Active file: ${activeFile || "none"}`,
      activeFileContent ? `Active file content:\n\`\`\`\n${contentSnippet}\n\`\`\`` : "",
      goal   ? `Project goal: ${goal.slice(0, MAX_GOAL)}` : "",
      plan   ? `Project plan: ${plan.slice(0, MAX_PLAN)}` : "",
    ].filter(Boolean).join("\n");
  };


  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading || !selectedProjectId) return;

    const userText = input.trim();
    setInput("");

    // Auto-create a task if none active
    if (!activeTaskId) {
      const id = Date.now().toString();
      const name = userText.slice(0, 40);
      setTasks(prev => [{ id, name, messages: [], ts: new Date().toLocaleTimeString() }, ...prev]);
      setActiveTaskId(id);
      setTaskName(name);
    }

    const userMsg = { role: "user", content: userText, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add thinking step
    const thinkingMsg = {
      role: "assistant",
      content: "",
      id: Date.now() + 1,
      steps: [{ type: "thinking", text: "Analyzing your request and workspace context..." }],
    };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const context = buildContext();

      // Keep last 3 assistant turns for history (caps token usage)
      const historyLines = messages
        .filter(m => m.role === "assistant" && m.content)
        .slice(-3)
        .map(m => `Assistant: ${m.content.slice(0, 300)}`)
        .join("\n");

      // Build ONE consolidated prompt — no duplicate context in `context` field
      const fullPrompt = [
        `You are Antigravity, an elite AI coding agent embedded in GladMe Studio V5.`,
        `You have access to the user's workspace. Keep responses concise.`,
        ``,
        `## Workspace Context`,
        context,
        historyLines ? `\n## Recent conversation\n${historyLines}` : "",
        ``,
        `## Instructions`,
        `To write a file use EXACTLY this format:`,
        `ACTION: WRITE_FILE | path/to/file.ext`,
        `\`\`\``,
        `<complete file content>`,
        `\`\`\``,
        `To delete a file: ACTION: DELETE_FILE | path/to/file.ext`,
        `Explain briefly BEFORE each action. Show complete working code.`,
        `NOTE: Any ACTION blocks you output will be executed AUTOMATICALLY in the user's workspace. You do not need to ask for permission.`,
        ``,
        `## User Request`,
        userText,
      ].filter(s => s !== undefined).join("\n");

      const data = await aiCoderGenerate({
        prompt: fullPrompt,
        filename: activeFile || "main.py",
        context: "",   // context is already embedded in prompt above
        model: selectedModel || "gemma4:latest",
        provider: selectedProvider || null,
      });


      const responseText = data.code || data.response || "No response from agent.";
      const actions = parseActions(responseText);

      let applied = false;
      let errorMsg = null;

      // Auto-execute WRITE/DELETE actions
      const executableActions = actions.filter(a => a.type === "WRITE_FILE" || a.type === "DELETE_FILE");
      if (executableActions.length > 0 && selectedProjectId) {
        try {
          await executeCoderActions(selectedProjectId, executableActions);
          applied = true;
          executableActions.forEach(a => {
            if (a.type === "WRITE_FILE") {
              addAgentAction({ type: "success", msg: `Wrote ${a.path}`, ts: Date.now() });
              emit(EVENTS.AGENT_ACTION, { type: "WRITE_FILE", path: a.path, projectId: selectedProjectId });
            } else if (a.type === "DELETE_FILE") {
              addAgentAction({ type: "warn", msg: `Deleted ${a.path}`, ts: Date.now() });
              emit(EVENTS.AGENT_ACTION, { type: "DELETE_FILE", path: a.path, projectId: selectedProjectId });
            }
          });
          await refreshFiles();
        } catch (e) {
          errorMsg = `Failed to auto-apply actions: ${e.message}`;
        }
      }

      // Replace thinking step with real response
      setMessages(prev => prev.map(m =>
        m.id === thinkingMsg.id
          ? { ...m, content: responseText, steps: null, actions, applied }
          : m
      ));

      if (errorMsg) {
        setMessages(prev => [...prev, {
          role: "assistant", id: Date.now(),
          content: `❌ ${errorMsg}`,
        }]);
      } else if (applied) {
        setMessages(prev => [...prev, {
          role: "assistant", id: Date.now(),
          content: `✅ Done! I have directly applied these changes to your workspace.`,
        }]);
      }

      // Auto-execute LIST_FILES actions
      if (responseText.includes("ACTION: LIST_FILES")) {
        await refreshFiles();
      }

    } catch (e) {
      const friendly = e.message?.includes("max tokens")
        ? "⚠️ The prompt was too long for the model. Try opening a smaller file or reducing the active file size before asking again."
        : `Error: ${e.message}`;
      setMessages(prev => prev.map(m =>
        m.id === thinkingMsg.id
          ? { ...m, content: friendly, steps: null }
          : m
      ));
    }
    setLoading(false);
  };

  // ── Execute a file action ───────────────────────────────────────────────
  const handleApplyAction = useCallback(async (msg, codeContent, action) => {
    if (!selectedProjectId) return;

    // Determine what to execute
    const targetAction = action || (msg.actions?.find(a => a.type === "WRITE_FILE") || msg.actions?.[0]);
    const targetPath = targetAction?.path || activeFile || "generated.py";
    const targetContent = action?.content || codeContent || "";

    try {
      if (!action || action.type === "WRITE_FILE") {
        await createProjectFile(selectedProjectId, targetPath, targetContent);
        addAgentAction({ type: "success", msg: `Wrote ${targetPath}`, ts: Date.now() });
        emit(EVENTS.AGENT_ACTION, { type: "WRITE_FILE", path: targetPath, projectId: selectedProjectId });
        // Open file if callback provided
        if (onOpenFile) onOpenFile({ path: targetPath, name: targetPath.split("/").pop() });
      } else if (action?.type === "DELETE_FILE") {
        await deleteProjectFile(selectedProjectId, action.path);
        addAgentAction({ type: "warn", msg: `Deleted ${action.path}`, ts: Date.now() });
        emit(EVENTS.AGENT_ACTION, { type: "DELETE_FILE", path: action.path, projectId: selectedProjectId });
      }

      // Mark message as applied
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, applied: true } : m));

      // Add confirmation message
      setMessages(prev => [...prev, {
        role: "assistant",
        id: Date.now(),
        content: `✅ Done! \`${targetPath}\` has been ${action?.type === "DELETE_FILE" ? "deleted" : "written"} to your workspace.`,
      }]);

      await refreshFiles();
    } catch (e) {
      addAgentAction({ type: "error", msg: `Failed: ${e.message}`, ts: Date.now() });
      setMessages(prev => [...prev, {
        role: "assistant", id: Date.now(),
        content: `❌ Failed to apply: ${e.message}`,
      }]);
    }
  }, [selectedProjectId, activeFile, onOpenFile, addAgentAction]);

  // ── File selection ──────────────────────────────────────────────────────
  const handleFileSelect = async (f) => {
    setSelectedFile(f.path);
    if (onOpenFile) onOpenFile(f);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state — no task selected
  const showWelcome = messages.length === 0;

  return (
    <div className={`ag-workspace ${isSidebarMode ? 'ag-workspace--sidebar' : ''}`}>
      {/* ── Left Sidebar: Task history ── */}
      {!isSidebarMode && (
        <aside className="ag-sidebar">
          <div className="ag-sidebar-header">
            <span className="ag-sidebar-logo">✨ GladMe</span>
          </div>
          <div className="ag-sidebar-search">
            <input className="ag-search-input" placeholder="Search tasks..." readOnly />
          </div>
          <div className="ag-task-section">
            <span className="ag-task-section-label">main</span>
            <button className="ag-new-task-btn" onClick={startNewTask}>+ New Task</button>
            {tasks.length > 0 && (
              <div className="ag-task-count">{tasks.length} tasks</div>
            )}
            <button className="ag-clear-btn" onClick={() => { clearAgentActions(); setTasks([]); setMessages([]); setActiveTaskId(null); }}>
              ⊘ Clear all
            </button>
          </div>
          <div className="ag-task-list">
            {tasks.length === 0 ? (
              <div className="ag-task-empty">No tasks yet</div>
            ) : (
              tasks.map(t => (
                <button
                  key={t.id}
                  className={`ag-task-item ${activeTaskId === t.id ? "ag-task-item--active" : ""}`}
                  onClick={() => { setActiveTaskId(t.id); setMessages(t.messages || []); setTaskName(t.name); }}
                >
                  <span className="ag-task-name">{t.name}</span>
                  <span className="ag-task-ts">{t.ts}</span>
                </button>
              ))
            )}
          </div>
          {agentActions.length > 0 && (
            <div className="ag-activity-log">
              {agentActions.slice(0, 4).map((a, i) => (
                <div key={i} className={`ag-activity-item ag-activity-item--${a.type}`}>{a.msg}</div>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* ── Main Chat Area ── */}
      <main className="ag-main">
        {/* Header with Close Button in Sidebar Mode */}
        {isSidebarMode && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(10,11,20,0.8)" }}>
            <span className="ag-sidebar-logo" style={{ fontSize: "14px", fontWeight: "bold", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ AI Coder</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-ghost btn-xs" onClick={startNewTask} style={{ color: "#94a3b8" }}>+ New</button>
              <button className="btn btn-ghost btn-xs" onClick={onClose} style={{ color: "#94a3b8" }}>✕</button>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {showWelcome ? (
            <motion.div
              key="welcome"
              className="ag-welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="ag-welcome-icon">✨</div>
              <h2 className="ag-welcome-title">What do you want to <em>build</em> today?</h2>
              <p className="ag-welcome-sub">
                Antigravity can read, write, and manage every file in your workspace.
              </p>
              <div className="ag-quick-actions">
                {[
                  "Create a FastAPI server with CRUD endpoints",
                  "Refactor main.py with error handling",
                  "Write unit tests for my code",
                  "Add a README.md to the project",
                ].map(q => (
                  <button key={q} className="ag-quick-btn" onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}>
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="chat" className="ag-chat" ref={scrollRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {messages.map(m => (
                <AgMessage key={m.id} msg={m} onApplyAction={handleApplyAction} />
              ))}
              {loading && (
                <div className="ag-msg ag-msg--assistant">
                  <div className="ag-msg-avatar">✨</div>
                  <div className="ag-msg-body">
                    <div className="ag-typing">
                      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input Bar ── */}
        <div className="ag-input-bar">
          <div className="ag-input-wrap">
            <textarea
              ref={inputRef}
              className="ag-textarea"
              placeholder="Describe your task... (type @ to mention a file)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="ag-input-footer">
              <div className="ag-input-meta">
                <button className="ag-meta-btn">🤖 {selectedModel || "gemma4:latest"}</button>
                <button className="ag-meta-btn" onClick={refreshFiles}>⊕ Ask Permission</button>
              </div>
              <button
                className="ag-send-btn"
                onClick={handleSend}
                disabled={loading || !input.trim() || !selectedProjectId}
              >
                Send ↑
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Right Panel: Files ── */}
      <aside className={`ag-files-sidebar ${showFiles ? "" : "ag-files-sidebar--hidden"}`}>
        <div className="ag-files-toggle-bar">
          <div className="ag-files-icons">
            <button className="ag-files-icon-btn" title="Files" onClick={() => setShowFiles(v => !v)}>📁</button>
            <button className="ag-files-icon-btn" title="Refresh files" onClick={refreshFiles}>↻</button>
          </div>
        </div>
        {showFiles && (
          <FilesPanel files={files} selectedFile={selectedFile} onSelect={handleFileSelect} />
        )}
      </aside>
    </div>
  );
}

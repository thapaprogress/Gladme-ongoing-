import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
const Editor = lazy(() => import("@monaco-editor/react"));
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import useProjectStore from "../store/useProjectStore";
import AntigravityAgent from "../components/AntigravityAgent";
import { on, EVENTS } from "../services/eventBus";
import {
  fetchProjectFiles, fetchFileContent, saveFileContent,
  createProjectFile, deleteProjectFile, createLog, getToken,
} from "../services/api";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const BASE_WS = typeof window !== "undefined"
  ? BASE_URL.replace(/^http/, "ws")
  : "ws://localhost:8000";

// ── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(name) {
  if (!name) return "📄";
  if (name.endsWith(".py")) return "🐍";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "📜";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "📘";
  if (name.endsWith(".json")) return "📋";
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".sh") || name.endsWith(".bat")) return "⚙️";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "🔧";
  if (name.endsWith(".txt")) return "📃";
  return "📄";
}

function getLanguage(name) {
  if (!name) return "plaintext";
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    py: "python", js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", json: "json",
    md: "markdown", html: "html", css: "css", scss: "scss",
    sh: "shell", bash: "shell", bat: "bat", yaml: "yaml", yml: "yaml",
    txt: "plaintext", toml: "ini", env: "ini", dockerfile: "dockerfile",
    go: "go", rs: "rust", java: "java", cpp: "cpp", c: "c",
  };
  return map[ext] || "plaintext";
}

// ── xterm.js Terminal Hook ─────────────────────────────────────────────────

function useXterm(containerRef, projectId, isVisible) {
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  // Auto-fit when visible
  useEffect(() => {
    if (isVisible && fitRef.current) {
      setTimeout(() => fitRef.current.fit(), 100);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0d0d0f",
        foreground: "#e2e8f0",
        cursor: "#7c3aed",
        cursorAccent: "#0d0d0f",
        selectionBackground: "rgba(124,58,237,0.3)",
        black: "#1e1e2e",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#a78bfa",
        cyan: "#67e8f9",
        white: "#e2e8f0",
        brightBlack: "#4b5563",
        brightRed: "#fca5a5",
        brightGreen: "#6ee7b7",
        brightYellow: "#fcd34d",
        brightBlue: "#93c5fd",
        brightMagenta: "#c4b5fd",
        brightCyan: "#a5f3fc",
        brightWhite: "#f8fafc",
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      convertEol: true,
      allowTransparency: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    
    // Immediate fit try
    setTimeout(() => fit.fit(), 50);

    termRef.current = term;
    fitRef.current = fit;

    const observer = new ResizeObserver(() => {
      fit.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          resize: { cols: term.cols, rows: term.rows }
        }));
      }
    });
    observer.observe(containerRef.current);

    term.writeln("\x1b[35m╔══════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[35m║  \x1b[36mGladME Studio V5  \x1b[33m● Terminal\x1b[35m      ║\x1b[0m");
    term.writeln("\x1b[35m╚══════════════════════════════════════╝\x1b[0m");
    term.writeln("\x1b[90mPress \x1b[33m▶ Run\x1b[90m to execute the active file or type commands directly.\x1b[0m");
    term.writeln("");

    if (projectId) {
      const token = getToken();
      const wsUrl = `${BASE_WS}/ws/terminal?token=${token}&project_id=${projectId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln("\x1b[32m[Terminal Connected]\x1b[0m");
        ws.send(JSON.stringify({
          resize: { cols: term.cols, rows: term.rows }
        }));
      };

      ws.onmessage = (evt) => {
        term.write(evt.data);
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.onerror = () => {
        term.writeln("\x1b[31m[WebSocket Error]\x1b[0m");
      };
      
      ws.onclose = () => {
        term.writeln("\x1b[31m[Terminal Disconnected]\x1b[0m");
      };
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [projectId]);

  const write = useCallback((text) => {
    termRef.current?.write(text);
  }, []);

  const writeln = useCallback((text) => {
    termRef.current?.writeln(text);
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
    termRef.current?.writeln("\x1b[90m── cleared ──\x1b[0m");
  }, []);

  return { write, writeln, clear, wsRef };
}

// ── File Tree Node ─────────────────────────────────────────────────────────

function FileNode({ node, depth = 0, onSelect, openPaths, onDelete }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === "directory";
  const isOpen = openPaths.has(node.path);

  return (
    <div>
      <div
        className={`filetree-node ${isOpen ? "filetree-node--active" : ""}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => {
          if (isDir) setOpen((o) => !o);
          else onSelect(node);
        }}
      >
        <span className="filetree-icon">
          {isDir ? (open ? "📂" : "📁") : getFileIcon(node.name)}
        </span>
        <span className="filetree-name">{node.name}</span>
        {!isDir && (
          <button
            className="filetree-del"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
          >✕</button>
        )}
      </div>
      {isDir && open && node.children?.map((child) => (
        <FileNode
          key={child.path}
          node={child}
          depth={depth + 1}
          onSelect={onSelect}
          openPaths={openPaths}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ── Command Palette ────────────────────────────────────────────────────────

function CommandPalette({ files, onOpen, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const flatFiles = [];
  const flatten = (nodes, prefix = "") => {
    for (const n of nodes) {
      if (n.type === "directory") flatten(n.children || [], `${prefix}${n.name}/`);
      else flatFiles.push({ ...n, displayPath: `${prefix}${n.name}` });
    }
  };
  flatten(files);

  const matches = query
    ? flatFiles.filter((f) => f.displayPath.toLowerCase().includes(query.toLowerCase()))
    : flatFiles.slice(0, 20);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && matches.length > 0) {
      onOpen(matches[0]);
      onClose();
    }
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <span className="cp-icon">🔍</span>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Go to file…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cp-esc" onClick={onClose}>Esc</kbd>
        </div>
        <div className="cp-list">
          {matches.length === 0 ? (
            <div className="cp-empty">No files match</div>
          ) : (
            matches.map((f) => (
              <div
                key={f.path}
                className="cp-item"
                onClick={() => { onOpen(f); onClose(); }}
              >
                <span className="cp-item-icon">{getFileIcon(f.name)}</span>
                <span className="cp-item-path">{f.displayPath}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Actions Palette (Ctrl+Shift+P) ─────────────────────────────────────────

function ActionsPalette({ onClose, onAction }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const ACTIONS = [
    { id: "save", label: "File: Save", icon: "💾", shortcut: "Ctrl+S" },
    { id: "close-tab", label: "View: Close Tab", icon: "✕", shortcut: "Ctrl+W" },
    { id: "new-file", label: "File: New File", icon: "📄", shortcut: "" },
    { id: "run", label: "Run: Execute File", icon: "▶", shortcut: "" },
    { id: "clear-terminal", label: "Terminal: Clear", icon: "🗑", shortcut: "" },
    { id: "import-studio", label: "Studio: Sync Code Here", icon: "📥", shortcut: "" },
    { id: "ai-coder", label: "AI Coder: Generate with Prompt", icon: "🪄", shortcut: "" },
  ];

  const matches = query
    ? ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS;

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && matches.length > 0) {
      onAction(matches[0].id);
      onClose();
    }
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <span className="cp-icon">⚡</span>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Command palette…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cp-esc" onClick={onClose}>Esc</kbd>
        </div>
        <div className="cp-list">
          {matches.map((a) => (
            <div
              key={a.id}
              className="cp-item"
              onClick={() => { onAction(a.id); onClose(); }}
            >
              <span className="cp-item-icon">{a.icon}</span>
              <span className="cp-item-path">{a.label}</span>
              {a.shortcut && <kbd className="cp-shortcut">{a.shortcut}</kbd>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CoderTab ──────────────────────────────────────────────────────────

function CoderTab({ isVisible }) {
  const {
    selectedProjectId,
    projects,
    goal, logic, plan, code: studioCode, evolution, tests: studioTests,
    ideTab, setIdeTab,
    verifyResult,
    activeFile, setActiveFile,
    setActiveFileContent,
  } = useProjectStore();

  // Monaco editor instance ref for squiggles
  const monacoRef = useRef(null);
  const editorRef = useRef(null);

  // File tree
  const [files, setFiles] = useState([]);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);

  // Multi-file tabs
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabPath, setActiveTabPath] = useState(null);

  // Palettes
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showActionPalette, setShowActionPalette] = useState(false);

  // AI Coder panel
  const [showAICoder, setShowAICoder] = useState(false);
  const [studioBannerDismissed, setStudioBannerDismissed] = useState(false);

  // Terminal
  const termContainerRef = useRef(null);
  const { write, writeln, clear: clearTerm, wsRef: terminalWsRef } = useXterm(termContainerRef, selectedProjectId, isVisible);
  const [isRunning, setIsRunning] = useState(false);
  const wsRef = useRef(null);
  const [terminalHeight, setTerminalHeight] = useState(180);
  const isDraggingRef = useRef(false);
  const [showPreview, setShowPreview] = useState(false);

  const currentProject = Array.isArray(projects) ? projects.find((p) => p.id === selectedProjectId) : null;
  const activeTab = openTabs.find((t) => t.path === activeTabPath) || null;

  // Studio sync files (computed) — all 6 fields
  const studioFiles = [
    { name: "_studio/goal.md", label: "🎯 Goal", content: goal },
    { name: "_studio/logic.md", label: "🧠 Logic", content: logic },
    { name: "_studio/plan.md", label: "📋 Plan", content: plan },
    { name: "_studio/code.py", label: "📝 Code", content: studioCode },
    { name: "_studio/evolution.md", label: "🔄 Evolution", content: evolution },
    { name: "_studio/tests.py", label: "🧪 Tests", content: studioTests },
  ].filter(f => !!f.content);

  const loadFiles = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const data = await fetchProjectFiles(selectedProjectId);
      setFiles(data.tree || []);
    } catch (e) { console.error("Failed to load files:", e); }
  }, [selectedProjectId]);

  const openFile = useCallback(async (node) => {
    try {
      const data = await fetchFileContent(selectedProjectId, node.path);
      const content = data.content || "";
      const tab = { path: node.path, name: node.name, content, savedContent: content, dirty: false };
      setOpenTabs((prev) => {
        if (prev.find((t) => t.path === node.path)) return prev;
        return [...prev, tab];
      });
      setActiveTabPath(node.path);
      setActiveFile(node.path);
      setActiveFileContent(content);
    } catch (e) { console.error("Failed to open file:", e); }
  }, [selectedProjectId, setActiveFile, setActiveFileContent]);

  const handleCloseTab = useCallback((path) => {
    if (!path) return;
    const tab = openTabs.find((t) => t.path === path);
    if (tab?.dirty && !window.confirm(`${tab.name} has unsaved changes. Close anyway?`)) return;
    const remaining = openTabs.filter((t) => t.path !== path);
    setOpenTabs(remaining);
    if (activeTabPath === path) {
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  }, [openTabs, activeTabPath]);

  const handleEditorChange = useCallback((value) => {
    const val = value || "";
    setOpenTabs((prev) => prev.map((t) =>
      t.path === activeTabPath
        ? { ...t, content: val, dirty: val !== t.savedContent }
        : t
    ));
    if (activeTabPath === activeFile) {
      setActiveFileContent(val);
    }
  }, [activeTabPath, activeFile, setActiveFileContent]);

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.dirty) return;
    try {
      await saveFileContent(selectedProjectId, activeTab.path, activeTab.content);
      setOpenTabs((prev) => prev.map((t) =>
        t.path === activeTab.path ? { ...t, savedContent: t.content, dirty: false } : t
      ));
      writeln(`\x1b[32m✓ Saved ${activeTab.name}\x1b[0m`);
    } catch (e) { console.error("Save failed:", e); }
  }, [activeTab, selectedProjectId, writeln]);

  // Terminal resizing handlers
  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const newHeight = window.innerHeight - e.clientY - 40;
    if (newHeight > 60 && newHeight < window.innerHeight - 200) {
      setTerminalHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // ── Effects ──

  useEffect(() => {
    if (!selectedProjectId) return;
    loadFiles();
  }, [selectedProjectId, loadFiles]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const unsub = on(EVENTS.AGENT_ACTION, (payload) => {
      if (payload?.projectId === selectedProjectId) {
        loadFiles();
      }
    });
    return unsub;
  }, [selectedProjectId, loadFiles]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const toSync = [
      { name: "_studio/goal.md", content: goal },
      { name: "_studio/logic.md", content: logic },
      { name: "_studio/plan.md", content: plan },
      { name: "_studio/code.py", content: studioCode },
      { name: "_studio/evolution.md", content: evolution },
      { name: "_studio/tests.py", content: studioTests },
    ];
    const syncStudioFiles = async () => {
      for (const { name, content } of toSync) {
        if (!content || !content.trim()) continue;
        try {
          await createProjectFile(selectedProjectId, name, content);
        } catch (e) {
          console.warn(`Studio sync skipped ${name}:`, e.message);
        }
      }
      loadFiles();
    };
    const timer = setTimeout(syncStudioFiles, 1200);
    return () => clearTimeout(timer);
  }, [selectedProjectId, goal, logic, plan, studioCode, evolution, studioTests, loadFiles]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowActionPalette(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setShowFilePicker(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        handleCloseTab(activeTabPath);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTabPath, openTabs, handleSave, handleCloseTab]);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    if (!verifyResult?.issues?.length) {
      monaco.editor.setModelMarkers(model, "gladme-verify", []);
      return;
    }

    const markers = verifyResult.issues.map((issue, idx) => ({
      severity: issue.level === "ERROR"
        ? monaco.MarkerSeverity.Error
        : issue.level === "WARNING"
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
      message: issue.msg,
      startLineNumber: issue.line || (idx + 1),
      startColumn: 1,
      endLineNumber: issue.line || (idx + 1),
      endColumn: model.getLineMaxColumn(Math.min(issue.line || (idx + 1), model.getLineCount())),
    }));
    monaco.editor.setModelMarkers(model, "gladme-verify", markers);
  }, [verifyResult, activeTabPath]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleRun = async () => {
    if (!activeTab?.content || isRunning) return;
    if (activeTab.name.endsWith(".html") || activeTab.name.endsWith(".css")) {
      setShowPreview(true);
      return;
    }
    
    // Instead of using /ws/execute which relies on docker sandbox, 
    // we directly send the command to the interactive terminal.
    if (terminalWsRef.current && terminalWsRef.current.readyState === WebSocket.OPEN) {
      const ext = activeTab.name.split(".").pop();
      let cmd = "";
      if (ext === "py") cmd = `python "${activeTab.path}"\n`;
      else if (ext === "js") cmd = `node "${activeTab.path}"\n`;
      else if (ext === "sh") cmd = `bash "${activeTab.path}"\n`;
      else cmd = `./"${activeTab.path}"\n`;
      
      terminalWsRef.current.send(cmd);
      return;
    }
    
    // Fallback to sandbox
    setIsRunning(true);
    writeln(`\x1b[33m▶ Running \x1b[1m${activeTab.name}\x1b[0m\x1b[33m in sandbox…\x1b[0m`);

    const token = getToken();
    const ws = new WebSocket(`${BASE_WS}/ws/execute?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ code: activeTab.content, timeout: 30 }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "stdout") {
          msg.data.split("\n").forEach((line) => {
            if (line) writeln(`\x1b[37m${line}\x1b[0m`);
          });
        } else if (msg.type === "stderr") {
          msg.data.split("\n").forEach((line) => {
            if (line) writeln(`\x1b[31m${line}\x1b[0m`);
          });
        } else if (msg.type === "result") {
          const color = msg.exit_code === 0 ? "\x1b[32m" : "\x1b[31m";
          const icon = msg.exit_code === 0 ? "✓" : "✗";
          writeln(`${color}${icon} Exit ${msg.exit_code}\x1b[0m`);
          writeln("");
          setIsRunning(false);
          ws.close();
          if (selectedProjectId) {
            createLog({
              project_id: selectedProjectId,
              action: `Ran ${activeTab.name} in Sandbox`,
              module: "Sandbox",
              result: msg.exit_code === 0 ? "Success" : "Error",
            });
          }
        } else if (msg.type === "error") {
          writeln(`\x1b[31m✗ ${msg.message}\x1b[0m`);
          setIsRunning(false);
          ws.close();
        }
      } catch {
        writeln(evt.data);
      }
    };

    ws.onerror = () => {
      writeln("\x1b[31m✗ WebSocket error — is the backend running?\x1b[0m");
      setIsRunning(false);
    };

    ws.onclose = () => setIsRunning(false);
  };

  const handleStopRun = () => {
    wsRef.current?.close();
    writeln("\x1b[33m⏹ Stopped.\x1b[0m");
    setIsRunning(false);
  };

  // ── File operations ──

  const handleNewFile = async () => {
    if (!newFileName.trim() || !selectedProjectId) return;
    try {
      await createProjectFile(selectedProjectId, newFileName.trim(), "");
      setNewFileName("");
      setShowNewFile(false);
      await loadFiles();
    } catch (e) { console.error("Create file failed:", e); }
  };

  const handleDeleteFile = async (path) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    handleCloseTab(path);
    try {
      await deleteProjectFile(selectedProjectId, path);
      await loadFiles();
    } catch (e) { console.error("Delete failed:", e); }
  };

  const handleImportFromStudio = async () => {
    if (!studioCode || !selectedProjectId) return;
    try {
      await createProjectFile(selectedProjectId, "main.py", studioCode);
      await loadFiles();
      writeln("\x1b[32m✓ Imported main.py from Studio tab\x1b[0m");
      await openFile({ path: "main.py", name: "main.py" });
      setStudioBannerDismissed(true);
    } catch (e) { console.error("Import failed:", e); }
  };

  // Apply AI-generated code: create/overwrite the file then open it
  const handleApplyAICode = async (code, fname) => {
    if (!selectedProjectId) return;
    const targetName = fname || "ai_generated.py";
    try {
      await createProjectFile(selectedProjectId, targetName, code);
      await loadFiles();
      await openFile({ path: targetName, name: targetName });
      writeln(`\x1b[32m✓ AI code applied → ${targetName}\x1b[0m`);
      setShowAICoder(false);
    } catch (e) {
      console.error("Apply AI code failed:", e);
    }
  };

  // ── Palette action dispatcher ──

  const handlePaletteAction = (actionId) => {
    switch (actionId) {
      case "save": handleSave(); break;
      case "close-tab": handleCloseTab(activeTabPath); break;
      case "new-file": setShowNewFile(true); break;
      case "run": handleRun(); break;
      case "clear-terminal": clearTerm(); break;
      case "import-studio": handleImportFromStudio(); break;
      case "ai-coder": setShowAICoder(v => !v); break;
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="coder-empty">
        <div className="empty-state">
          <div className="empty-icon">💻</div>
          <h3>No Project Selected</h3>
          <p>Switch to the Studio tab to create or select a project first.</p>
          <button className="btn btn-primary" onClick={() => setIdeTab("studio")}>
            ← Go to Studio
          </button>
        </div>
      </div>
    );
  }

  const openPaths = new Set(openTabs.map((t) => t.path));

  // Studio context banner: show when Studio has code/plan but it's not yet imported
  const studioHasContent = !!(studioCode || plan);
  const showStudioBanner = studioHasContent && !studioBannerDismissed && files.length === 0;



  return (
    <div className="coder-shell">
      {/* Palettes */}
      {showFilePicker && (
        <CommandPalette
          files={files}
          onOpen={openFile}
          onClose={() => setShowFilePicker(false)}
        />
      )}
      {showActionPalette && (
        <ActionsPalette
          onClose={() => setShowActionPalette(false)}
          onAction={handlePaletteAction}
        />
      )}

      {/* Studio → Coder context banner */}
      {showStudioBanner && (
        <div className="studio-banner">
          <div className="studio-banner-content">
            <span className="studio-banner-icon">🧠</span>
            <div className="studio-banner-text">
              <strong>Studio context ready</strong>
              {goal && <span className="studio-banner-goal"> — {goal.slice(0, 80)}{goal.length > 80 ? "…" : ""}</span>}
            </div>
          </div>
          <div className="studio-banner-actions">
            {studioCode && (
              <button className="btn btn-primary btn-sm" onClick={handleImportFromStudio}>
                📥 Import Code
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAICoder(true)}>
              🪄 Use as AI Context
            </button>
            <button className="studio-banner-dismiss" onClick={() => setStudioBannerDismissed(true)}>✕</button>
          </div>
        </div>
      )}

      {/* ── File Tree Sidebar ── */}
      <aside className="coder-sidebar">
        <div className="coder-sidebar-header">
          <span className="coder-project-name">📁 {currentProject?.title || "Project"}</span>
          <div className="coder-sidebar-actions">
            <button className="icon-btn" title="New file" onClick={() => setShowNewFile((v) => !v)}>➕</button>
            <button className="icon-btn" title="Refresh files" onClick={loadFiles}>🔄</button>
          </div>
        </div>

        {showNewFile && (
          <div className="new-file-form">
            <input
              className="new-file-input"
              placeholder="filename.py"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
              autoFocus
            />
            <button className="btn btn-primary btn-xs" onClick={handleNewFile}>Create</button>
          </div>
        )}

        <div className="filetree">
          {files.length === 0 ? (
            <div className="filetree-empty">
              <p>No files yet.</p>
              {studioCode && (
                <button className="btn btn-ghost btn-xs" onClick={handleImportFromStudio}>
                  📥 Import from Studio
                </button>
              )}
            </div>
          ) : (
            <>
              {files.map((node) => (
                <FileNode
                  key={node.path}
                  node={node}
                  onSelect={openFile}
                  openPaths={openPaths}
                  onDelete={handleDeleteFile}
                />
              ))}
              {studioCode && (
                <button className="btn btn-ghost btn-xs import-btn" onClick={handleImportFromStudio}>
                  📥 Sync from Studio
                </button>
              )}
            </>
          )}
        </div>

        {studioFiles.length > 0 && (
          <div className="studio-files-section">
            <div className="studio-files-header">📡 Studio Sync</div>
            {studioFiles.map((sf) => (
              <button
                key={sf.name}
                className="studio-file-item"
                title={`Open ${sf.label}`}
                onClick={() => openFile({ path: sf.name, name: sf.name, type: "file" })}
              >
                <span className="studio-file-label">{sf.label}</span>
                <span className="studio-file-sync">🔄</span>
              </button>
            ))}
          </div>
        )}

        <div className="coder-sidebar-footer">
          <kbd className="kb-hint">Ctrl+P</kbd> <span>Go to file</span>
          <br />
          <kbd className="kb-hint">Ctrl+⇧P</kbd> <span>Commands</span>
        </div>
      </aside>

      {/* ── Editor + Terminal ── */}
      <div className="coder-main">
        {/* Multi-file tab bar */}
        <div className="editor-tabbar">
          {openTabs.map((tab) => (
            <div
              key={tab.path}
              className={`editor-tab ${tab.path === activeTabPath ? "editor-tab--active" : ""}`}
              onClick={() => setActiveTabPath(tab.path)}
            >
              <span className="editor-tab-icon">{getFileIcon(tab.name)}</span>
              <span className="editor-tab-name">{tab.name}</span>
              {tab.dirty && <span className="editor-tab-dirty">●</span>}
              <button
                className="editor-tab-close"
                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.path); }}
              >✕</button>
            </div>
          ))}
          {openTabs.length === 0 && (
            <span className="editor-tabbar-hint">Open a file to start editing</span>
          )}
        </div>

        {/* Toolbar */}
        <div className="editor-toolbar">
          <div className="editor-toolbar-left">
            {activeTab ? (
              <>
                <span className="editor-tab-icon">{getFileIcon(activeTab.name)}</span>
                <span className="editor-filename">{activeTab.path}</span>
                {activeTab.dirty && <span className="dirty-dot">●</span>}
              </>
            ) : (
              <span className="editor-placeholder">📂 Select a file from the tree to begin editing</span>
            )}
          </div>
          <div className="editor-toolbar-right">
            {/* Verify result badge — shows issue count from Studio verify */}
            {verifyResult && (
              <span
                className={`verify-badge verify-badge--${
                  verifyResult.status === "PASS" ? "pass"
                  : verifyResult.issues?.some(i => i.level === "ERROR") ? "error"
                  : "warning"
                }`}
                title={`Verify: ${verifyResult.status} — ${verifyResult.issues?.length || 0} issue(s)`}
              >
                {verifyResult.status === "PASS" ? "✓" : "⚠"} {verifyResult.status}
                {verifyResult.issues?.length > 0 && ` (${verifyResult.issues.length})`}
              </span>
            )}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                className={`btn btn-sm ${showPreview ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setShowPreview(v => !v)}
                title="Toggle Live Preview (🌐)"
              >
                🌐 Preview
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowFilePicker(true)}
                title="Go to file (Ctrl+P)"
              >
                🔍 Files
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSave}
                disabled={!activeTab?.dirty}
                title="Save file (Ctrl+S)"
              >
                💾 Save
              </button>
              {!isRunning ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleRun}
                  disabled={!activeTab?.content}
                  title="Run active file"
                >
                  ▶ Run
                </button>
              ) : (
                <button className="btn btn-danger btn-sm" onClick={handleStopRun} title="Stop execution">
                  ⏹ Stop
                </button>
              )}
              <button
                className={`btn btn-sm ${showAICoder ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setShowAICoder(v => !v)}
                title="AI Coder — generate files with a prompt"
              >
                🪄 AI
              </button>
            </div>
          </div>
        </div>

        {/* Editor Area: Monaco editor + side-by-side Antigravity Agent */}
        <div className={`editor-area${showAICoder ? " editor-area--agent-mode" : ""}`} style={{ display: "flex", flexDirection: "row", width: "100%", flex: 1, minHeight: 0 }}>

          {/* Main Editor Pane */}
          <div className="monaco-container" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "row" }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "rgba(10, 14, 26, 0.5)" }}>
              {activeTab ? (
                <Suspense fallback={<div className="monaco-placeholder">⏳ Loading editor...</div>}>
                  <Editor
                    key={activeTab.path}
                    height="100%"
                    language={getLanguage(activeTab.name)}
                    value={activeTab.content}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    onMount={(editor, monaco) => {
                      editorRef.current = editor;
                      monacoRef.current = monaco;
                    }}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      tabSize: 2,
                      renderLineHighlight: "gutter",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                      padding: { top: 12, bottom: 12 },
                      lineNumbersMinChars: 3,
                      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
                    }}
                  />
                </Suspense>
              ) : (
                <div className="monaco-placeholder">
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
                  <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px", color: "var(--text-primary)" }}>
                    No File Open
                  </p>
                  <p style={{ marginBottom: "20px" }}>Select a file from the tree or create a new one to start editing</p>
                  <p className="monaco-hint">
                    <kbd style={{ padding: "2px 6px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "4px", marginRight: "8px" }}>Ctrl+P</kbd>
                    Go to file &nbsp;·&nbsp;
                    <kbd style={{ padding: "2px 6px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "4px", marginLeft: "8px" }}>Ctrl+Shift+P</kbd>
                    Commands
                  </p>
                  {studioCode && (
                    <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={handleImportFromStudio}>
                      📥 Import code from Studio
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Live Preview Pane */}
            {showPreview && activeTab && (
              <div className="preview-pane" style={{ flex: 1, minWidth: "300px", borderLeft: "1px solid rgba(99, 102, 241, 0.15)", background: "#ffffff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "rgba(10, 14, 26, 0.9)", borderBottom: "1px solid rgba(99, 102, 241, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: "11px", fontWeight: "600" }}>
                  <span>🌐 Live Preview: {activeTab.name}</span>
                  <button className="btn-icon" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", fontSize: "16px" }} onClick={() => setShowPreview(false)}>✕</button>
                </div>
                <iframe
                  src={`${BASE_URL}/api/projects/${selectedProjectId}/preview/${activeTab.path}`}
                  style={{ width: "100%", height: "100%", border: "none", background: "white" }}
                  title="Preview"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                />
              </div>
            )}
          </div>

          {/* Antigravity Sidebar — AI Coder */}
          {showAICoder && (
            <div className="ag-sidebar-overlay" style={{ width: "380px", borderLeft: "1px solid rgba(99, 102, 241, 0.15)", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #0a0b10 0%, #0f1428 100%)", boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.3)" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(99, 102, 241, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent-indigo)" }}>🪄 AI Coder</span>
                <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }} onClick={() => setShowAICoder(false)}>✕</button>
              </div>
              <AntigravityAgent onOpenFile={openFile} isSidebarMode={true} onClose={() => setShowAICoder(false)} />
            </div>
          )}
        </div>

        {/* Resizer Handle */}
        {/* Resizer Handle */}
        <div 
          className="terminal-resizer" 
          onMouseDown={handleMouseDown}
          title="Drag to resize terminal"
        >
          <div className="resizer-handle-line" />
        </div>

        {/* xterm.js Terminal — Enhanced Professional Terminal */}
        <div className="terminal-pane" style={{ height: `${terminalHeight}px` }}>
          <div className="terminal-header">
            <div className="terminal-header-left">
              <span className="terminal-icon">⌨️</span>
              <span style={{ fontWeight: "600" }}>Interactive Terminal</span>
              {isRunning && <span className="terminal-running">● running</span>}
            </div>
            <div className="terminal-header-right">
              <span style={{ fontSize: "10px", color: "var(--text-muted)", marginRight: "8px" }}>
                {terminalHeight}px
              </span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setTerminalHeight(terminalHeight < 300 ? 500 : 180)}
                title={terminalHeight < 300 ? "Expand terminal" : "Collapse terminal"}
              >
                {terminalHeight < 300 ? "📈" : "📉"}
              </button>
              <button className="btn btn-ghost btn-xs" onClick={clearTerm} title="Clear terminal (Ctrl+L)">
                🗑️ Clear
              </button>
            </div>
          </div>
          <div className="xterm-container" ref={termContainerRef} style={{ background: "linear-gradient(135deg, #0d0d0f 0%, #0a0e1a 100%)" }} />
        </div>
      </div>
    </div>
  );
}

export default CoderTab;

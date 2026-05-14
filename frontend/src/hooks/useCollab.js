import { useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { getToken } from "../services/api";

export default function useCollab(projectId, monacoEditor) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;

    const ydoc = new Y.YDoc();
    ydocRef.current = ydoc;

    const token = getToken();
    const wsBase = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${wsBase}//${host}`;

    try {
      const provider = new WebsocketProvider(
        wsUrl,
        `gladme-project-${projectId}`,
        ydoc,
        { params: { token } }
      );
      providerRef.current = provider;
      awarenessRef.current = provider.awareness;

      const userName = localStorage.getItem("gladme_user_name") || "Anonymous";
      const userColor = USER_COLORS[Math.abs(hashStr(userName)) % USER_COLORS.length];

      provider.awareness.setLocalStateField("user", {
        name: userName,
        color: userColor.color,
        colorLight: userColor.colorLight,
      });

      if (monacoEditor) {
        bindMonacoEditor(ydoc, monacoEditor, provider.awareness);
      }
    } catch (e) {
      console.warn("Y.js collab connect failed:", e);
    }

    return () => {
      try { bindingRef.current?.dispose(); } catch {}
      try { providerRef.current?.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      bindingRef.current = null;
      providerRef.current = null;
      awarenessRef.current = null;
      ydocRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    if (!monacoEditor || !ydocRef.current || !providerRef.current) return;
    const dispose = bindMonacoEditor(ydocRef.current, monacoEditor, providerRef.current.awareness);
    return () => { try { dispose?.(); } catch {} };
  }, [monacoEditor]);

  const getLocalState = useCallback(() => {
    return ydocRef.current?.getText("monaco")?.toString() || "";
  }, []);

  return { ydoc: ydocRef, provider: providerRef, awareness: awarenessRef, getLocalState };
}

function bindMonacoEditor(ydoc, editor, awareness) {
  const ytext = ydoc.getText("monaco");
  if (!editor || !awareness) return;
  try {
    const model = editor.getModel();
    if (!model) return;

    const MonadBinding = getMonacoBinding();
    if (!MonadBinding) return;

    const binding = new MonadBinding(ytext, editor, new Y.UndoManager(ytext), {
      awareness,
    });
    return () => binding.dispose();
  } catch (e) {
    console.warn("Monaco-Y.js binding failed:", e);
  }
}

function getMonacoBinding() {
  try {
    const mod = require("y-monaco");
    return mod?.MonacoBinding || mod?.default?.MonacoBinding;
  } catch {
    return null;
  }
}

const USER_COLORS = [
  { color: "#6366f1", colorLight: "rgba(99,102,241,0.3)" },
  { color: "#f43f5e", colorLight: "rgba(244,63,94,0.3)" },
  { color: "#10b981", colorLight: "rgba(16,185,129,0.3)" },
  { color: "#f59e0b", colorLight: "rgba(245,158,11,0.3)" },
  { color: "#8b5cf6", colorLight: "rgba(139,92,246,0.3)" },
  { color: "#06b6d4", colorLight: "rgba(6,182,212,0.3)" },
  { color: "#ec4899", colorLight: "rgba(236,72,153,0.3)" },
  { color: "#14b8a6", colorLight: "rgba(20,184,166,0.3)" },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
import { useState, useCallback, useRef, useEffect } from "react";
import useProjectStore from "../store/useProjectStore";
import useDashboardStore from "../store/useDashboardStore";
import { emit, EVENTS } from "../services/eventBus";

const AGENT_STATES = {
  IDLE: "idle",
  PLANNING: "planning",
  CODING: "coding",
  TESTING: "testing",
  DONE: "done",
  ERROR: "error",
  CANCELLED: "cancelled",
};

export default function useVibeAgent(projectId) {
  const [agentId, setAgentId] = useState(null);
  const [status, setStatus] = useState(AGENT_STATES.IDLE);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);

  const { selectedModel, selectedProvider } = useProjectStore();

  const addLog = useCallback((msg, type = "info") => {
    setLog(prev => [...prev, { ts: Date.now(), msg, type }]);
  }, []);

  const launch = useCallback(async (task) => {
    if (!projectId) return;
    if (![AGENT_STATES.IDLE, AGENT_STATES.DONE, AGENT_STATES.ERROR, AGENT_STATES.CANCELLED].includes(status)) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus(AGENT_STATES.PLANNING);
    setLog([]);
    setResult(null);
    addLog(`Agent launched: "${task}"`, "info");

    try {
      const res = await fetch(`/api/agents/vibe?project_id=${projectId}&task=${encodeURIComponent(task)}&model=${selectedModel || "gemma4:latest"}&provider=${selectedProvider || ""}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("gladme_token") || ""}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const agent = await res.json();
      if (!agent?.id) throw new Error("No agent ID in response");
      setAgentId(agent.id);
      addLog(`Agent ${agent.id} created`, "info");
      emit(EVENTS.AGENT_ACTION, { type: "created", agentId: agent.id, task });
      startPolling(agent.id);
    } catch (e) {
      setStatus(AGENT_STATES.ERROR);
      addLog(`Failed: ${e.message}`, "error");
    }
  }, [projectId, selectedModel, selectedProvider, status, addLog]);

  // Auto-refresh dashboards when agent done + mentions dashboard
  useEffect(() => {
    if (status === AGENT_STATES.DONE && projectId) {
      const dashStore = useDashboardStore.getState();
      dashStore.load(projectId);
    }
  }, [status, projectId]);

  const startPolling = useCallback((id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/vibe/${id}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("gladme_token") || ""}` },
        });
        const data = await res.json();
        setStatus(data.status || AGENT_STATES.IDLE);
        if (data.log && Array.isArray(data.log)) {
          setLog(data.log.map(e => ({
            ts: new Date(e.ts).getTime(),
            msg: e.msg,
            type: e.level || "info",
          })));
        }
        if (data.status === "done" || data.status === "error" || data.status === "cancelled") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setResult(data);
          emit(EVENTS.AGENT_ACTION, { type: data.status, agentId: id, result: data });
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setStatus(AGENT_STATES.ERROR);
        addLog(`Poll error: ${e.message}`, "error");
      }
    }, 2000);
  }, [addLog]);

  const cancel = useCallback(async () => {
    if (!agentId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await fetch(`/api/agents/vibe/${agentId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("gladme_token") || ""}` } });
    } catch {}
    setStatus(AGENT_STATES.IDLE);
    setAgentId(null);
    addLog("Agent cancelled", "warn");
    emit(EVENTS.AGENT_ACTION, { type: "cancelled", agentId });
  }, [agentId, addLog]);

  return { status, log, result, agentId, launch, cancel, AGENT_STATES };
}

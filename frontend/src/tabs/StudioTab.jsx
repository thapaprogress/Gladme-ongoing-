import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Sidebar from "../components/Sidebar";
import PhaseStepper from "../components/PhaseStepper";
import VisualWorkflow from "../components/VisualWorkflow";
import Workspace from "../components/Workspace";
import MonitoringPanel from "../components/MonitoringPanel";
import EvolutionPanel from "../components/EvolutionPanel";
import ArchitectureTable from "../components/ArchitectureTable";
import ActivityLog from "../components/ActivityLog";
import TestPanel from "../components/TestPanel";
import VibeChat from "../components/VibeChat";
import SkillMarketplace from "../components/SkillMarketplace";
import TrustPanel from "../components/TrustPanel";
import AgentManager from "../components/AgentManager";
import LLMProviderPanel from "../components/LLMProviderPanel";
import VibeAgentPanel from "../components/VibeAgentPanel";

import useProjectStore from "../store/useProjectStore";
import {
  fetchProjects, createProject, deleteProject,
  fetchProjectState, updateProjectState,
  generatePlan, generateCode, verifyProject, executeCode,
  createVersion, exportProject, createLog,
  createProjectFile, streamGenerate,
} from "../services/api";

function StudioTab({ onLogout }) {
  const {
    currentUser,
    providers,
    selectedModel, setSelectedModel,
    selectedProvider, setSelectedProvider,
    studioTab: activeTab, setStudioTab: setActiveTab,
    projects, setProjects,
    selectedProjectId, setSelectedProjectId,
    goal, setGoal,
    logic, setLogic,
    plan, setPlan,
    code, setCode,
    evolution, setEvolution,
    tests, setTests,
    currentPhase, setCurrentPhase,
    verifyResult, setVerifyResult,
    execResult, setExecResult,
    resetProjectState,
    setIdeTab,
    isStreaming, streamingText, streamingPhase,
    setStreaming, appendStreamingText, clearStreaming,
  } = useProjectStore();

  const [loading, setLoading] = React.useState(false);

  // Auto-save project state (debounced)
  useEffect(() => {
    if (!selectedProjectId) return;
    const timer = setTimeout(() => {
      updateProjectState(selectedProjectId, {
        goal, logic, plan, code, evolution, tests, current_phase: currentPhase,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [goal, logic, plan, code, evolution, tests, currentPhase, selectedProjectId]);

  // Derive phase from content
  useEffect(() => {
    if (code) setCurrentPhase("Code");
    else if (plan) setCurrentPhase("Plan");
    else if (logic) setCurrentPhase("Logic");
    else setCurrentPhase("Goal");
  }, [goal, logic, plan, code]);

  const handleCreateProject = async (title) => {
    try {
      const p = await createProject(title);
      const existingProjects = Array.isArray(projects) ? projects : [];
      setProjects([{ ...p, currentPhase: p.currentPhase || "Goal" }, ...existingProjects]);
      handleSelectProject(p.id);
    } catch (e) { console.error("Create project failed:", e); }
  };

  const handleSelectProject = async (id) => {
    setSelectedProjectId(id);
    setVerifyResult(null);
    setExecResult(null);
    try {
      const state = await fetchProjectState(id);
      setGoal(state.goal || "");
      setLogic(state.logic || "");
      setPlan(state.plan || "");
      setCode(state.code || "");
      setEvolution(state.evolution || "");
      setTests(state.tests || "");
      setCurrentPhase(state.currentPhase || "Goal");
    } catch (e) { console.error("Load project state failed:", e); }
  };

  const handleDeleteProject = async (id) => {
    try {
      await deleteProject(id);
      const existingProjects = Array.isArray(projects) ? projects : [];
      setProjects(existingProjects.filter((p) => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
        resetProjectState();
      }
    } catch (e) { console.error("Delete project failed:", e); }
  };

  const handleGeneratePlan = async () => {
    if (!goal || !logic) return;
    setLoading("plan");
    setStreaming("plan");
    try {
      const result = await streamGenerate(
        "/generate/plan/stream",
        { goal, logic, model: selectedModel, provider: selectedProvider },
        (token, full) => { appendStreamingText(token); },
        (full) => { setPlan(full); },
      );
      setPlan(result);
      await createLog({ project_id: selectedProjectId, action: "Plan generated (stream)", module: "PlannerAgent", result: "Success" });
    } catch (e) {
      console.error("Generate plan stream failed:", e);
      try {
        const res = await generatePlan(goal, logic, selectedModel, selectedProvider);
        setPlan(res.plan);
      } catch (e2) { console.error("Fallback generate plan failed:", e2); }
    }
    clearStreaming();
    setLoading(false);
  };

  const handleGenerateCode = async () => {
    if (!goal || !logic || !plan) return;
    setLoading("code");
    setStreaming("code");
    try {
      const result = await streamGenerate(
        "/generate/code/stream",
        { goal, logic, plan, model: selectedModel, provider: selectedProvider },
        (token, full) => { appendStreamingText(token); },
        (full) => { setCode(full); },
      );
      setCode(result);
      if (selectedProjectId && result) {
        try { await createProjectFile(selectedProjectId, "main.py", result); } catch {}
      }
      await createLog({ project_id: selectedProjectId, action: "Code generated (stream)", module: "CoderAgent", result: "Success" });
    } catch (e) {
      console.error("Generate code stream failed:", e);
      try {
        const res = await generateCode(goal, logic, plan, selectedModel, selectedProvider);
        setCode(res.code);
        if (selectedProjectId && res.code) {
          try { await createProjectFile(selectedProjectId, "main.py", res.code); } catch {}
        }
      } catch (e2) { console.error("Fallback generate code failed:", e2); }
    }
    clearStreaming();
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading("verify");
    try {
      const result = await verifyProject(goal, logic, plan, code, tests);
      setVerifyResult(result);
      if (result.status === "PASS") setCurrentPhase("Verify");
      await createLog({ project_id: selectedProjectId, action: `Verification: ${result.status}`, module: "Verifier", result: result.status });
    } catch (e) { console.error("Verification failed:", e); }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!code) return;
    setLoading("execute");
    try {
      const result = await executeCode(code);
      setExecResult(result);
      await createLog({ project_id: selectedProjectId, action: `Code executed (exit: ${result.exit_code})`, module: "Sandbox", result: result.status === "success" ? "Success" : "Error" });
    } catch (e) {
      setExecResult({ stdout: "", stderr: "Execution failed", exit_code: -1, status: "error" });
    }
    setLoading(false);
  };

  const handleSaveVersion = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await createVersion(selectedProjectId, {
        goal, logic, plan, code, evolution, tests, current_phase: currentPhase,
      });
      await createLog({ project_id: selectedProjectId, action: `Version v${res.versionNumber} saved`, module: "EvolutionEngine", result: "Success" });
    } catch (e) { console.error("Save version failed:", e); }
  };

  const handleRestoreVersion = (v) => {
    setGoal(v.goal || "");
    setLogic(v.logic || "");
    setPlan(v.plan || "");
    setCode(v.code || "");
    setEvolution(v.evolution || "");
    setTests(v.tests || "");
    setCurrentPhase(v.currentPhase || "Goal");
    setActiveTab("workspace");
  };

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const blob = await exportProject(selectedProjectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gladme_export.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Export failed:", e); }
  };

  // Send generated code to Coder tab
  const handleOpenInCoder = () => {
    if (code) setIdeTab("coder");
  };

  const currentProject = Array.isArray(projects) ? projects.find((p) => p.id === selectedProjectId) : null;

  const renderContent = () => {
    if (!selectedProjectId) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h3>Welcome to GladME Studio V5</h3>
          <p>Create a new project or select one from the sidebar to begin planning.</p>
        </div>
      );
    }

    switch (activeTab) {
      case "workspace":
        return (
          <>
            <VisualWorkflow currentPhase={currentPhase} goal={goal} logic={logic} plan={plan} code={code} />
            <div className="grid-2">
              <Workspace
                goal={goal} setGoal={setGoal}
                logic={logic} setLogic={setLogic}
                plan={plan} setPlan={setPlan}
                code={code} setCode={setCode}
                evolution={evolution} setEvolution={setEvolution}
                onGeneratePlan={handleGeneratePlan}
                onGenerateCode={handleGenerateCode}
                onVerify={handleVerify}
                onSaveVersion={handleSaveVersion}
                onExport={handleExport}
                onExecute={handleExecute}
                verifyResult={verifyResult}
                execResult={execResult}
                loading={loading}
                selectedModel={selectedModel}
              />
              <div className="stack">
                <TestPanel
                  goal={goal} logic={logic} plan={plan} code={code}
                  tests={tests} setTests={setTests}
                  selectedModel={selectedModel} selectedProvider={selectedProvider}
                />
                <VibeChat
                  projectId={selectedProjectId}
                  goal={goal} logic={logic} plan={plan} code={code}
                  selectedModel={selectedModel} selectedProvider={selectedProvider}
                />
                {code && (
                  <button className="btn btn-primary" onClick={handleOpenInCoder}>
                    💻 Open Code in Coder Tab →
                  </button>
                )}
              </div>
            </div>
          </>
        );
      case "monitoring":
        return <MonitoringPanel projectId={selectedProjectId} execResult={execResult} />;
      case "evolution":
        return <EvolutionPanel projectId={selectedProjectId} goal={goal} logic={logic} plan={plan} code={code} onRestoreVersion={handleRestoreVersion} selectedModel={selectedModel} selectedProvider={selectedProvider} />;
      case "architecture":
        return <ArchitectureTable />;
      case "activity":
        return <ActivityLog projectId={selectedProjectId} />;
      case "skills":
        return <SkillMarketplace goal={goal} logic={logic} plan={plan} code={code} tests={tests} selectedModel={selectedModel} selectedProvider={selectedProvider} />;
      case "trust":
        return <TrustPanel projectId={selectedProjectId} />;
      case "agents":
        return <AgentManager />;
      case "vibes":
        return <VibeAgentPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="shell">
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        projects={projects} selectedProjectId={selectedProjectId}
        onCreateProject={handleCreateProject} onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        ollamaConnected={providers?.ollama?.available || false}
        onLogout={onLogout}
        currentUser={currentUser}
      />
      <main className="main-area">
        <div className="top-bar">
          <div className="top-bar-left">
            <h2>{currentProject ? currentProject.title : "Studio"}</h2>
            <span className="phase-badge">{currentPhase}</span>
          </div>
          <div className="top-bar-actions">
            <LLMProviderPanel />
            {selectedProjectId && (
              <button className="btn btn-ghost btn-sm" onClick={handleExport}>📦 Export</button>
            )}
          </div>
        </div>

        {selectedProjectId && <PhaseStepper currentPhase={currentPhase} />}

        <div className="content-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedProjectId || "")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default StudioTab;

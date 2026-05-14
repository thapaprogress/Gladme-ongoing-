/**
 * V5 useArtifactSync — keeps Studio output ↔ Coder editor in sync.
 * When Studio generates code, it registers an artifact and emits ARTIFACT_SAVED.
 * CoderTab listens and auto-loads content. CoderTab edits emit ARTIFACT_UPDATED.
 */

import { useEffect, useCallback, useRef } from "react";
import useProjectStore from "../store/useProjectStore";
import useArtifactRegistry from "../store/useArtifactRegistry";
import { saveFileContent } from "../services/api";
import { on, emit, EVENTS } from "../services/eventBus";

export default function useArtifactSync(projectId) {
  const { code, setCode, activeFile, activeFileContent, setActiveFile, setActiveFileContent, ideTab, setIdeTab } = useProjectStore();
  const { register, getByKind, openInEditor } = useArtifactRegistry();
  const dirtyRef = useRef(false);
  const lastSavedRef = useRef("");

  // Dirty tracking — compare current code vs last saved
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const isDirty = useCallback(() => dirtyRef.current, []);

  // Studio → Editor sync: listen for ARTIFACT_SAVED, auto-open file in CoderTab
  useEffect(() => {
    const unsub = on(EVENTS.ARTIFACT_SAVED, (artifact) => {
      if (artifact.file_name) {
        setActiveFile(artifact.file_name);
        // Load content from artifact or from project state code field
        if (artifact.kind === "code" || artifact.kind === "plan") {
          setActiveFileContent(code);
        }
        setIdeTab("coder");
        dirtyRef.current = false;
        lastSavedRef.current = code || "";
      }
    });
    return unsub;
  }, [code, setActiveFile, setActiveFileContent, setIdeTab]);

  // Editor → Studio sync: when coder saves, emit ARTIFACT_UPDATED
  const saveArtifact = useCallback(async (filePath, content) => {
    if (!projectId) return;
    try {
      await saveFileContent(projectId, filePath, content);
      lastSavedRef.current = content;
      dirtyRef.current = false;
      emit(EVENTS.ARTIFACT_UPDATED, { file_name: filePath, content });
    } catch (e) {
      console.error("[useArtifactSync] save failed:", e);
      throw e;
    }
  }, [projectId]);

  // Register a Studio-generated artifact (called from StudioTab after generation)
  const registerStudioArtifact = useCallback(async (kind, name, fileName, tab) => {
    if (!projectId) return;
    try {
      const artifact = await register(projectId, {
        kind,
        name,
        file_name: fileName,
        studio_tab: tab,
        generated_by: "studio",
      });
      emit(EVENTS.ARTIFACT_SAVED, { ...artifact, content: code });
      return artifact;
    } catch (e) {
      console.error("[useArtifactSync] register failed:", e);
    }
  }, [projectId, register, code]);

  return {
    markDirty,
    isDirty,
    saveArtifact,
    registerStudioArtifact,
    openInEditor,
  };
}
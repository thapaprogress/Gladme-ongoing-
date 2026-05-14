/**
 * V5 Artifact Registry — Zustand store + API sync.
 * Single source of truth for all project artifacts.
 */

import { create } from "zustand";
import { fetchArtifacts, createArtifact as apiCreate, deleteArtifact as apiDelete } from "../services/api";
import { emit, EVENTS } from "../services/eventBus";

const useArtifactRegistry = create((set, get) => ({
  artifacts: [],
  loading: false,
  error: null,

  load: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const artifacts = await fetchArtifacts(projectId);
      set({ artifacts, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  register: async (projectId, artifactData) => {
    try {
      const created = await apiCreate(projectId, artifactData);
      set(state => ({ artifacts: [...state.artifacts, created] }));
      emit(EVENTS.ARTIFACT_CREATED, created);
      return created;
    } catch (e) {
      set({ error: e.message });
      throw e;
    }
  },

  remove: async (projectId, artifactId) => {
    try {
      await apiDelete(projectId, artifactId);
      set(state => ({ artifacts: state.artifacts.filter(a => a.id !== artifactId) }));
      emit(EVENTS.ARTIFACT_DELETED, { id: artifactId });
    } catch (e) {
      set({ error: e.message });
      throw e;
    }
  },

  getByKind: (kind) => get().artifacts.filter(a => a.kind === kind),

  getByTab: (tab) => get().artifacts.filter(a => a.studio_tab === tab),

  getById: (id) => get().artifacts.find(a => a.id === id),

  openInEditor: (artifact) => {
    emit(EVENTS.ARTIFACT_OPENED, artifact);
    emit(EVENTS.TAB_SWITCH, { tab: artifact.studio_tab || "coder", artifact });
  },
}));

export default useArtifactRegistry;
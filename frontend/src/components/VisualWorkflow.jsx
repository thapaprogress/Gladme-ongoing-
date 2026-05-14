import React, { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import { motion } from "framer-motion";
import "@xyflow/react/dist/style.css";

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const PHASE_CONFIG = [
  { id: "goal",      label: "🎯 Goal",      x: 0,   y: 120, color: "#6366f1" },
  { id: "logic",     label: "🧠 Logic",     x: 250, y: 120, color: "#8b5cf6" },
  { id: "plan",      label: "📋 Plan",      x: 500, y: 120, color: "#a855f7" },
  { id: "code",      label: "💻 Code",      x: 750, y: 120, color: "#3b82f6" },
  { id: "verify",    label: "✅ Verify",    x: 1000,y: 120, color: "#10b981" },
  { id: "evolve",    label: "🧬 Evolve",    x: 1250,y: 120, color: "#f59e0b" },
];

const PHASE_ORDER = ["Goal", "Logic", "Plan", "Code", "Verify", "Evolve"];

function getPhaseIndex(phase) {
  const idx = PHASE_ORDER.findIndex(
    (p) => p.toLowerCase() === (phase || "goal").toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

const VisualWorkflow = ({ currentPhase, goal, logic, plan, code }) => {
  const activeIdx = getPhaseIndex(currentPhase);

  const initialNodes = useMemo(
    () =>
      PHASE_CONFIG.map((p, i) => {
        const isActive = i === activeIdx;
        const isCompleted = i < activeIdx;
        const hasContent =
          (p.id === "goal" && !!goal) ||
          (p.id === "logic" && !!logic) ||
          (p.id === "plan" && !!plan) ||
          (p.id === "code" && !!code);

        return {
          id: p.id,
          position: { x: p.x, y: p.y },
          data: { label: p.label },
          style: {
            background: isActive
              ? p.color
              : isCompleted || hasContent
              ? `${p.color}33`
              : "rgba(20, 28, 58, 0.8)",
            color: isActive ? "#ffffff" : isCompleted || hasContent ? p.color : "#64748b",
            border: isActive
              ? `2px solid ${p.color}`
              : isCompleted || hasContent
              ? `1px solid ${p.color}66`
              : "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            padding: "14px 22px",
            fontSize: "14px",
            fontWeight: isActive ? 700 : 500,
            boxShadow: isActive ? `0 0 24px ${p.color}44` : "none",
            transition: "all 0.3s ease",
            fontFamily: "'Inter', sans-serif",
            minWidth: "120px",
            textAlign: "center",
          },
        };
      }),
    [activeIdx, goal, logic, plan, code]
  );

  const initialEdges = useMemo(
    () =>
      PHASE_CONFIG.slice(0, -1).map((p, i) => {
        const next = PHASE_CONFIG[i + 1];
        const isTraversed = i < activeIdx;
        return {
          id: `${p.id}-${next.id}`,
          source: p.id,
          target: next.id,
          type: "smoothstep",
          animated: i === activeIdx - 1,
          style: {
            stroke: isTraversed ? "#10b981" : "rgba(255,255,255,0.12)",
            strokeWidth: isTraversed ? 2.5 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isTraversed ? "#10b981" : "rgba(255,255,255,0.15)",
          },
        };
      }),
    [activeIdx]
  );

  // Add the evolution feedback loop edge
  const feedbackEdge = useMemo(
    () => ({
      id: "evolve-goal",
      source: "evolve",
      target: "goal",
      type: "smoothstep",
      animated: activeIdx === 5,
      style: {
        stroke: "#f59e0b44",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#f59e0b66",
      },
    }),
    [activeIdx]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([...initialEdges, feedbackEdge]);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges([...initialEdges, feedbackEdge]);
  }, [initialEdges, feedbackEdge, setEdges]);

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" style={{ marginBottom: "16px" }}>
      <div className="card-header">
        <h3>Visual Workflow</h3>
        <span className="card-badge badge-planner">Architecture Map</span>
      </div>
      <div style={{ height: "280px", background: "rgba(5,10,20,0.5)", borderRadius: "0 0 16px 16px" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={true}
          zoomOnScroll={false}
        >
          <Background color="rgba(255,255,255,0.03)" gap={20} />
          <Controls
            showInteractive={false}
            style={{ background: "rgba(20,28,58,0.8)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}
          />
          <MiniMap
            nodeColor={(n) => {
              const cfg = PHASE_CONFIG.find((p) => p.id === n.id);
              return cfg ? cfg.color : "#333";
            }}
            style={{ background: "rgba(10,14,26,0.8)", borderRadius: "8px" }}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>
    </motion.div>
  );
};

export default VisualWorkflow;

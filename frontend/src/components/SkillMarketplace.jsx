import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchSkills, executeSkill } from "../services/api";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const CATEGORY_COLORS = {
  testing: "var(--accent-emerald)",
  documentation: "var(--accent-blue)",
  security: "var(--accent-rose)",
  devops: "var(--accent-cyan)",
  custom: "var(--accent-amber)",
};

const SkillMarketplace = ({ goal, logic, plan, code, tests, selectedModel, selectedProvider, onLog }) => {
  const [skills, setSkills] = useState([]);
  const [execResult, setExecResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningSkill, setRunningSkill] = useState(null);

  useEffect(() => { loadSkills(); }, []);

  const loadSkills = async () => {
    try {
      const data = await fetchSkills();
      setSkills(data);
    } catch {}
  };

  const handleRun = async (skill) => {
    setRunningSkill(skill.name);
    setLoading(true);
    setExecResult(null);
    try {
      const projectState = { goal, logic, plan, code, tests };
      const res = await executeSkill(skill.name, projectState, selectedModel, selectedProvider);
      setExecResult(res);
      if (onLog) onLog(`Skill '${skill.name}' executed`, "SkillRunner", "Success");
    } catch {
      setExecResult({ error: "Skill execution failed" });
      if (onLog) onLog(`Skill '${skill.name}' failed`, "SkillRunner", "Error");
    }
    setLoading(false);
    setRunningSkill(null);
  };

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
      <div className="card-header">
        <h3>Skill Marketplace</h3>
        <span className="card-badge badge-evolution">Skills</span>
      </div>
      <div className="card-body">
        <div className="grid-3" style={{ marginBottom: "16px" }}>
          {skills.map((skill) => (
            <div key={skill.name} style={{
              padding: "14px 16px", borderRadius: "var(--radius-md)",
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
              cursor: "pointer", transition: "var(--transition)",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                {skill.name}
              </div>
              <div style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "var(--radius-full)",
                background: `${CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.custom}22`,
                color: CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.custom,
                display: "inline-block", fontWeight: 600, marginBottom: "6px",
              }}>
                {skill.category}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                {skill.description}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: "100%" }}
                onClick={() => handleRun(skill)}
                disabled={loading}
              >
                {runningSkill === skill.name ? <span className="spinner" /> : "▶"}
                Run
              </button>
            </div>
          ))}
        </div>

        {execResult && (
          <div style={{
            padding: "14px 16px", borderRadius: "var(--radius-md)",
            background: execResult.error ? "rgba(244,63,94,0.08)" : "rgba(16,185,129,0.08)",
            border: `1px solid ${execResult.error ? "rgba(244,63,94,0.25)" : "rgba(16,185,129,0.25)"}`,
            fontSize: "13px", whiteSpace: "pre-wrap", color: "var(--text-secondary)",
          }}>
            {execResult.error || execResult.output}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SkillMarketplace;

import React from "react";
import { motion } from "framer-motion";

const PHASES = [
  { key: "Goal", label: "Goal", num: "1" },
  { key: "Logic", label: "Logic", num: "2" },
  { key: "Plan", label: "Plan", num: "3" },
  { key: "Code", label: "Code", num: "4" },
  { key: "Verify", label: "Verify", num: "5" },
  { key: "Evolution", label: "Evolve", num: "6" },
];

const PHASE_ORDER = PHASES.map((p) => p.key);

const PhaseStepper = ({ currentPhase }) => {
  const activeIdx = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="phase-stepper">
      {PHASES.map((phase, idx) => {
        let cls = "phase-step";
        if (idx === activeIdx) cls += " active";
        else if (idx < activeIdx) cls += " completed";

        return (
          <motion.div
            key={phase.key}
            className={cls}
            initial={false}
            animate={{
              scale: idx === activeIdx ? 1.04 : 1,
              opacity: idx <= activeIdx ? 1 : 0.55,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span className="step-num">
              {idx < activeIdx ? "✓" : phase.num}
            </span>
            {phase.label}
          </motion.div>
        );
      })}
    </div>
  );
};

export default PhaseStepper;

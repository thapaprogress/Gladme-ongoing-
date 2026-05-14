"""
GladME Studio V4 — FSM Verification Engine (upgraded from V3)
"""

def verify_project_state(goal: str, logic: str, plan: str, code: str, tests: str = "") -> dict:
    issues = []
    severity = "PASS"

    phases_present = {
        "goal": bool(goal and goal.strip()),
        "logic": bool(logic and logic.strip()),
        "plan": bool(plan and plan.strip()),
        "code": bool(code and code.strip()),
        "tests": bool(tests and tests.strip()),
    }

    if not phases_present["goal"]:
        issues.append({"level": "ERROR", "msg": "Goal is missing"})
    if not phases_present["logic"]:
        issues.append({"level": "ERROR", "msg": "Logic is missing"})
    if not phases_present["plan"]:
        issues.append({"level": "WARNING", "msg": "Plan is missing"})
    if not phases_present["code"]:
        issues.append({"level": "INFO", "msg": "Code is not yet generated"})
    if not phases_present["tests"]:
        issues.append({"level": "INFO", "msg": "Tests are not yet generated"})

    if phases_present["code"] and not phases_present["plan"]:
        issues.append({"level": "ERROR", "msg": "Invalid: Code exists without Plan"})
    if phases_present["plan"] and not phases_present["logic"]:
        issues.append({"level": "ERROR", "msg": "Invalid: Plan exists without Logic"})
    if phases_present["logic"] and not phases_present["goal"]:
        issues.append({"level": "ERROR", "msg": "Invalid: Logic exists without Goal"})
    if phases_present["tests"] and not phases_present["code"]:
        issues.append({"level": "WARNING", "msg": "Tests exist but Code is missing"})

    if phases_present["goal"] and len(goal.strip()) < 10:
        issues.append({"level": "WARNING", "msg": "Goal is too short"})
    if phases_present["logic"] and len(logic.strip()) < 10:
        issues.append({"level": "WARNING", "msg": "Logic is too short"})
    if phases_present["plan"] and len(plan.strip()) < 50:
        issues.append({"level": "WARNING", "msg": "Plan seems insufficient"})

    if phases_present["goal"] and phases_present["logic"]:
        goal_words = set(goal.lower().split())
        logic_words = set(logic.lower().split())
        overlap = goal_words & logic_words
        meaningful = overlap - {"the", "a", "an", "is", "to", "and", "or", "in", "for", "of", "with"}
        if len(meaningful) < 1 and len(goal_words) > 3 and len(logic_words) > 3:
            issues.append({"level": "WARNING", "msg": "Low semantic overlap between Goal and Logic"})

    error_count = sum(1 for i in issues if i["level"] == "ERROR")
    warning_count = sum(1 for i in issues if i["level"] == "WARNING")

    if error_count > 0:
        severity = "FAIL"
    elif warning_count > 0:
        severity = "WARNING"

    return {
        "status": severity,
        "issues": issues,
        "phases": phases_present,
        "model_type": "GladME Workflow FSM v4",
        "checks_run": len(issues),
        "recommendation": (
            "Fix critical errors before proceeding."
            if severity == "FAIL"
            else "Address warnings to improve project quality."
            if severity == "WARNING"
            else "All checks passed. Workflow is valid and consistent."
        ),
    }

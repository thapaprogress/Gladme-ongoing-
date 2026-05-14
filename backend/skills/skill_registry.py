"""
GladME Studio V4 — Skills System
"""

import json
from pathlib import Path
from database import SessionLocal, InstalledSkill
from llm_router import llm_router

SKILLS_DIR = Path(__file__).parent / "builtin"


class SkillManifest:
    def __init__(self, data: dict):
        self.name = data.get("name", "unknown")
        self.version = data.get("version", "1.0.0")
        self.description = data.get("description", "")
        self.category = data.get("category", "custom")
        self.author = data.get("author", "")
        self.inputs = data.get("inputs", [])
        self.outputs = data.get("outputs", [])
        self.model_required = data.get("model_required", False)
        self.timeout = data.get("timeout", 30)
        self.permissions = data.get("permissions", [])
        self.prompt_template = data.get("prompt_template", "")
        self.post_processing = data.get("post_processing", "")

    def to_dict(self):
        return {
            "name": self.name, "version": self.version,
            "description": self.description, "category": self.category,
            "author": self.author, "inputs": self.inputs,
            "outputs": self.outputs, "model_required": self.model_required,
            "timeout": self.timeout, "permissions": self.permissions,
            "prompt_template": self.prompt_template,
            "post_processing": self.post_processing,
        }


BUILTIN_SKILLS = {
    "generate-tests": SkillManifest({
        "name": "generate-tests", "version": "1.0.0",
        "description": "Generate pytest test cases for the current code",
        "category": "testing", "author": "GladME Team",
        "inputs": ["goal", "logic", "plan", "code"],
        "outputs": ["tests"], "model_required": True,
        "timeout": 30, "permissions": ["read_project"],
        "prompt_template": "You are the Test Agent in the GladME framework.\nGenerate comprehensive pytest tests for the code below.\n\n## Goal\n{{goal}}\n\n## Logic\n{{logic}}\n\n## Plan\n{{plan}}\n\n## Code\n{{code}}\n\nOutput ONLY Python pytest code.",
        "post_processing": "validate_python_syntax",
    }),
    "generate-docs": SkillManifest({
        "name": "generate-docs", "version": "1.0.0",
        "description": "Generate README + API documentation from code",
        "category": "documentation", "author": "GladME Team",
        "inputs": ["goal", "logic", "plan", "code"],
        "outputs": ["documentation"], "model_required": True,
        "timeout": 30, "permissions": ["read_project"],
        "prompt_template": "Generate comprehensive documentation for this project.\n\n## Goal\n{{goal}}\n\n## Code\n{{code}}\n\nOutput a README.md with: Overview, Installation, Usage, API Reference, Configuration.",
        "post_processing": "",
    }),
    "security-scan": SkillManifest({
        "name": "security-scan", "version": "1.0.0",
        "description": "Scan code for security vulnerabilities",
        "category": "security", "author": "GladME Team",
        "inputs": ["code"],
        "outputs": ["report"], "model_required": True,
        "timeout": 20, "permissions": ["read_project"],
        "prompt_template": "You are a Security Agent. Analyze this Python code for vulnerabilities:\n\n```python\n{{code}}\n```\n\nCheck for: SQL injection, hardcoded secrets, weak crypto, command injection, insecure deserialization, path traversal.\n\nOutput a report with: finding, severity (HIGH/MEDIUM/LOW), line, recommendation.",
        "post_processing": "",
    }),
    "generate-dockerfile": SkillManifest({
        "name": "generate-dockerfile", "version": "1.0.0",
        "description": "Create Dockerfile and docker-compose.yml for the project",
        "category": "devops", "author": "GladME Team",
        "inputs": ["goal", "code"],
        "outputs": ["dockerfile", "compose"], "model_required": True,
        "timeout": 20, "permissions": ["read_project"],
        "prompt_template": "Generate a Dockerfile and docker-compose.yml for this project.\n\n## Goal\n{{goal}}\n\n## Code\n{{code}}\n\nOutput the Dockerfile first, then ---COMPOSE---, then the docker-compose.yml.",
        "post_processing": "",
    }),
}


def get_all_skills() -> list[dict]:
    skills = [s.to_dict() for s in BUILTIN_SKILLS.values()]
    db = SessionLocal()
    try:
        custom = db.query(InstalledSkill).all()
        for s in custom:
            manifest = json.loads(s.manifest_json)
            manifest["installed"] = True
            skills.append(manifest)
    finally:
        db.close()
    return skills


def get_skill(name: str) -> SkillManifest | None:
    if name in BUILTIN_SKILLS:
        return BUILTIN_SKILLS[name]
    db = SessionLocal()
    try:
        skill = db.query(InstalledSkill).filter(InstalledSkill.name == name).first()
        if skill:
            return SkillManifest(json.loads(skill.manifest_json))
    finally:
        db.close()
    return None


async def execute_skill(name: str, project_state: dict,
                        model: str = "gemma4:latest", provider: str = None) -> dict:
    manifest = get_skill(name)
    if not manifest:
        return {"error": f"Skill '{name}' not found"}

    inputs = {}
    for key in manifest.inputs:
        inputs[key] = project_state.get(key, "")

    prompt = manifest.prompt_template
    for key, value in inputs.items():
        prompt = prompt.replace("{{" + key + "}}", value)

    if manifest.model_required:
        result, used_provider = await llm_router.generate(prompt, model, provider)
    else:
        result = prompt
        used_provider = "local"

    if manifest.post_processing == "validate_python_syntax":
        try:
            compile(result, "<skill_output>", "exec")
        except SyntaxError as e:
            result = f"# Syntax warning: {e}\n\n{result}"

    return {
        "skill": name,
        "output": result,
        "provider": used_provider,
        "category": manifest.category,
    }


def install_skill(manifest_json: str) -> dict:
    data = json.loads(manifest_json)
    name = data.get("name", "")
    if not name:
        return {"error": "Skill name is required"}
    if name in BUILTIN_SKILLS:
        return {"error": "Cannot overwrite built-in skill"}

    db = SessionLocal()
    try:
        existing = db.query(InstalledSkill).filter(InstalledSkill.name == name).first()
        if existing:
            existing.manifest_json = manifest_json
            existing.version = data.get("version", "1.0.0")
            existing.category = data.get("category", "custom")
        else:
            skill = InstalledSkill(
                name=name,
                version=data.get("version", "1.0.0"),
                category=data.get("category", "custom"),
                manifest_json=manifest_json,
            )
            db.add(skill)
        db.commit()
        return {"status": "installed", "name": name}
    finally:
        db.close()


def uninstall_skill(name: str) -> dict:
    if name in BUILTIN_SKILLS:
        return {"error": "Cannot uninstall built-in skill"}
    db = SessionLocal()
    try:
        skill = db.query(InstalledSkill).filter(InstalledSkill.name == name).first()
        if not skill:
            return {"error": "Skill not found"}
        db.delete(skill)
        db.commit()
        return {"status": "uninstalled", "name": name}
    finally:
        db.close()

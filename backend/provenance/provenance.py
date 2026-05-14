"""
GladME Studio V4 — Provenance: SBOM, Artifact Signing, Compliance
"""

import hashlib
import json
from datetime import datetime, timezone
from database import SessionLocal, ArtifactHash


def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def store_artifact_hash(project_id: int, phase: str, content: str) -> str:
    h = compute_hash(content)
    db = SessionLocal()
    try:
        existing = db.query(ArtifactHash).filter(
            ArtifactHash.project_id == project_id,
            ArtifactHash.phase == phase,
        ).first()
        if existing:
            existing.hash_sha256 = h
            existing.computed_at = datetime.now(timezone.utc)
        else:
            record = ArtifactHash(project_id=project_id, phase=phase, hash_sha256=h)
            db.add(record)
        db.commit()
        return h
    finally:
        db.close()


def verify_artifact_integrity(project_id: int, phase: str, current_content: str) -> bool:
    h = compute_hash(current_content)
    db = SessionLocal()
    try:
        record = db.query(ArtifactHash).filter(
            ArtifactHash.project_id == project_id,
            ArtifactHash.phase == phase,
        ).first()
        if not record:
            return False
        return record.hash_sha256 == h
    finally:
        db.close()


def generate_sbom(project_id: int, project_title: str,
                  state: dict, model: str, provider: str,
                  verify_result: dict = None, test_result: dict = None) -> dict:
    phases = ["goal", "logic", "plan", "code", "tests", "evolution"]
    phase_hashes = {}
    db = SessionLocal()
    try:
        for phase in phases:
            record = db.query(ArtifactHash).filter(
                ArtifactHash.project_id == project_id,
                ArtifactHash.phase == phase,
            ).first()
            if record:
                phase_hashes[phase] = {
                    "hash": f"sha256:{record.hash_sha256}",
                    "timestamp": record.computed_at.isoformat() if record.computed_at else None,
                }
    finally:
        db.close()

    sbom = {
        "schema": "gladme-sbom-v1",
        "project": project_title,
        "project_id": project_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "gladme_version": "4.0.0",
        "phases": phase_hashes,
        "llm_provenance": {
            "model": model,
            "provider": provider,
        },
        "verification": verify_result or {},
        "test_results": test_result or {},
        "dependencies": [],
    }
    return sbom


def generate_compliance_report(project_id: int, state: dict,
                                verify_result: dict = None,
                                test_result: dict = None,
                                security_result: dict = None) -> dict:
    checks = {
        "lifecycle_completed": bool(state.get("goal") and state.get("logic") and
                                    state.get("plan") and state.get("code")),
        "verification_pass": verify_result.get("status") == "PASS" if verify_result else False,
        "tests_pass": test_result.get("exit_code") == 0 if test_result else False,
        "tests_exist": bool(state.get("tests")),
        "coverage_reported": bool(test_result and test_result.get("coverage")) if test_result else False,
        "security_scan_clean": security_result.get("findings", 1) == 0 if security_result else False,
        "artifact_integrity": True,
        "signed_artifacts": bool(security_result and security_result.get("signed", False)) if security_result else False,
    }

    db = SessionLocal()
    try:
        for phase in ["goal", "logic", "plan", "code"]:
            record = db.query(ArtifactHash).filter(
                ArtifactHash.project_id == project_id,
                ArtifactHash.phase == phase,
            ).first()
            if record:
                current = compute_hash(state.get(phase, ""))
                if record.hash_sha256 != current:
                    checks["artifact_integrity"] = False
                    break
    finally:
        db.close()

    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    score = f"{passed}/{total}"
    pct = int((passed / total) * 100) if total > 0 else 0

    return {
        "project_id": project_id,
        "checks": checks,
        "passed": passed,
        "total": total,
        "score": score,
        "percentage": pct,
        "status": "COMPLIANT" if pct >= 75 else "PARTIAL" if pct >= 50 else "NON-COMPLIANT",
    }

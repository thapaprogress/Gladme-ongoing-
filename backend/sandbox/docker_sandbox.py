"""
GladME Studio V4 — Docker Containerized Sandbox
Issue #1 FIX: Uses custom image with pytest, pytest-cov, pytest-json-report pre-installed.
Issue #2 FIX: Maps container /workspace paths back to host-relative paths in coverage output.
"""

import docker
import tempfile
import os
import json
import asyncio
from pathlib import Path
from .sandbox_config import SANDBOX_LIMITS, SANDBOX_IMAGE, SANDBOX_TYPE


class DockerSandbox:
    def __init__(self):
        self.client = None

    def _get_client(self):
        if self.client is None:
            self.client = docker.from_env()
        return self.client

    def _ensure_image(self):
        client = self._get_client()
        try:
            client.images.get(SANDBOX_IMAGE)
        except docker.errors.ImageNotFound:
            sandbox_dir = Path(__file__).parent
            dockerfile_path = sandbox_dir / "Dockerfile.runner"
            client.images.build(
                path=str(sandbox_dir),
                dockerfile=str(dockerfile_path),
                tag=SANDBOX_IMAGE,
                rm=True,
            )

    async def execute(self, code: str, timeout: int = None) -> dict:
        self._ensure_image()
        timeout = timeout or SANDBOX_LIMITS["timeout"]
        container = None

        with tempfile.TemporaryDirectory() as tmpdir:
            code_path = os.path.join(tmpdir, "main.py")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(code)

            try:
                client = self._get_client()
                container = client.containers.run(
                    image=SANDBOX_IMAGE,
                    command=["python", "/workspace/main.py"],
                    volumes={tmpdir: {"bind": SANDBOX_LIMITS["workspace_mount"], "mode": "rw"}},
                    mem_limit=SANDBOX_LIMITS["memory"],
                    cpu_period=SANDBOX_LIMITS["cpu_period"],
                    cpu_quota=SANDBOX_LIMITS["cpu_quota"],
                    network_disabled=SANDBOX_LIMITS["network_disabled"],
                    detach=True,
                    user="runner",
                    tmpfs={"/tmp": f"size={SANDBOX_LIMITS['tmpfs_size']}"},
                    pids_limit=SANDBOX_LIMITS["pids_limit"],
                    working_dir=SANDBOX_LIMITS["workspace_mount"],
                )

                result = container.wait(timeout=timeout + 10)
                exit_code = result.get("StatusCode", -1)
                stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
                stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
                container.remove()

                return {
                    "stdout": stdout,
                    "stderr": stderr,
                    "exit_code": exit_code,
                    "status": "success" if exit_code == 0 else "error",
                }

            except docker.errors.APIError as e:
                return {"stdout": "", "stderr": f"Docker error: {e}", "exit_code": -1, "status": "error"}
            except Exception as e:
                if container:
                    try:
                        container.remove(force=True)
                    except Exception:
                        pass
                if "timeout" in str(e).lower():
                    return {"stdout": "", "stderr": "Execution timed out", "exit_code": -1, "status": "timeout"}
                return {"stdout": "", "stderr": str(e), "exit_code": -1, "status": "error"}

    async def execute_tests(self, code: str, tests: str, timeout: int = 45) -> dict:
        self._ensure_image()
        container = None

        with tempfile.TemporaryDirectory() as tmpdir:
            code_path = os.path.join(tmpdir, "main.py")
            test_path = os.path.join(tmpdir, "test_main.py")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(code)
            with open(test_path, "w", encoding="utf-8") as f:
                f.write(tests)

            try:
                client = self._get_client()
                container = client.containers.run(
                    image=SANDBOX_IMAGE,
                    command=[
                        "python", "-m", "pytest",
                        "/workspace/test_main.py",
                        "--tb=short",
                        "--json-report",
                        "--json-report-file=/tmp/report.json",
                        "--cov=/workspace",
                        "--cov-report=term-missing",
                        "-v",
                    ],
                    volumes={tmpdir: {"bind": SANDBOX_LIMITS["workspace_mount"], "mode": "rw"}},
                    mem_limit=SANDBOX_LIMITS["memory"],
                    cpu_period=SANDBOX_LIMITS["cpu_period"],
                    cpu_quota=SANDBOX_LIMITS["cpu_quota"],
                    network_disabled=SANDBOX_LIMITS["network_disabled"],
                    detach=True,
                    user="runner",
                    tmpfs={"/tmp": f"size={SANDBOX_LIMITS['tmpfs_size']}"},
                    pids_limit=SANDBOX_LIMITS["pids_limit"],
                    working_dir=SANDBOX_LIMITS["workspace_mount"],
                )

                result = container.wait(timeout=timeout + 10)
                exit_code = result.get("StatusCode", -1)
                stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
                stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")

                report_data = None
                try:
                    report_bytes = container.get_archive("/tmp/report.json")
                    import io as _io, tarfile
                    buf = _io.BytesIO()
                    for chunk in report_bytes[0]:
                        buf.write(chunk)
                    buf.seek(0)
                    with tarfile.open(fileobj=buf) as tar:
                        member = tar.getmember("report.json")
                        f = tar.extractfile(member)
                        if f:
                            report_data = json.loads(f.read().decode("utf-8"))
                except Exception:
                    pass

                container.remove(force=True)

                coverage = self._parse_coverage(stdout + "\n" + stderr)
                test_results = self._parse_test_results(stdout, report_data)

                return {
                    "stdout": stdout,
                    "stderr": stderr,
                    "exit_code": exit_code,
                    "status": "success" if exit_code == 0 else "error",
                    "test_results": test_results,
                    "coverage": coverage,
                }

            except docker.errors.APIError as e:
                return {"stdout": "", "stderr": f"Docker error: {e}", "exit_code": -1, "status": "error",
                        "test_results": None, "coverage": None}
            except Exception as e:
                if container:
                    try:
                        container.remove(force=True)
                    except Exception:
                        pass
                if "timeout" in str(e).lower():
                    return {"stdout": "", "stderr": "Test execution timed out", "exit_code": -1,
                            "status": "timeout", "test_results": None, "coverage": None}
                return {"stdout": "", "stderr": str(e), "exit_code": -1, "status": "error",
                        "test_results": None, "coverage": None}

    def _parse_coverage(self, output: str) -> dict:
        coverage_data = {"percent": 0, "files": []}
        lines = output.split("\n")
        in_coverage = False
        for line in lines:
            if "Name" in line and "Stmts" in line and "Cover" in line:
                in_coverage = True
                continue
            if in_coverage and line.startswith("---"):
                continue
            if in_coverage and line.startswith("==="):
                in_coverage = False
                continue
            if in_coverage and line.strip():
                if line.startswith("=") or line.startswith("_"):
                    in_coverage = False
                    continue
                parts = line.split()
                if len(parts) >= 4:
                    name = parts[0]
                    if name.startswith("=") or name.startswith("_"):
                        continue
                    name = name.replace("/workspace/", "").replace("/workspace", "")
                    if name == "TOTAL":
                        for p in parts:
                            if "%" in p:
                                try:
                                    coverage_data["percent"] = int(p.replace("%", ""))
                                except ValueError:
                                    pass
                        continue
                    cov_str = ""
                    for p in parts:
                        if "%" in p:
                            cov_str = p
                            break
                    try:
                        cov_pct = int(cov_str.replace("%", "")) if cov_str else 0
                    except ValueError:
                        cov_pct = 0
                    missing = parts[-1] if not parts[-1].replace("%","").isdigit() else ""
                    coverage_data["files"].append({
                        "name": name,
                        "coverage": cov_pct,
                        "missing_lines": missing,
                    })
            if in_coverage and not line.strip():
                in_coverage = False
        return coverage_data

    def _parse_test_results(self, stdout: str, report_data: dict = None) -> dict:
        results = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0, "tests": []}

        if report_data and "tests" in report_data:
            for t in report_data["tests"]:
                outcome = t.get("outcome", "unknown")
                test_name = t.get("nodeid", t.get("name", "unknown"))
                message = ""
                if outcome == "failed" and "call" in t and "crash" in t["call"]:
                    message = t["call"]["crash"].get("message", "")
                results["tests"].append({
                    "name": test_name,
                    "status": outcome,
                    "message": message,
                    "duration": t.get("duration", 0),
                })
                if outcome in results:
                    results[outcome] += 1
        else:
            import re
            for line in stdout.split("\n"):
                m = re.match(r'^(test_main\.py::\S+)\s+(PASSED|FAILED|ERROR|SKIPPED)', line.strip())
                if m:
                    results["tests"].append({
                        "name": m.group(1),
                        "status": m.group(2).lower(),
                        "message": "",
                        "duration": 0,
                    })
                    status = m.group(2).lower()
                    if status in results:
                        results[status] += 1
            for line in stdout.split("\n"):
                if " passed" in line or " failed" in line or " error" in line or " skipped" in line:
                    parts = line.strip().split()
                    for p in parts:
                        try:
                            count = int(p)
                            if "passed" in line and results["passed"] == 0:
                                results["passed"] = count
                            elif "failed" in line and results["failed"] == 0:
                                results["failed"] = count
                            elif "error" in line and results["errors"] == 0:
                                results["errors"] = count
                            elif "skipped" in line and results["skipped"] == 0:
                                results["skipped"] = count
                        except ValueError:
                            pass
        return results


class SubprocessSandbox:
    """
    SECURITY WARNING: This sandbox runs user code directly on the host with NO isolation.
    Only use for local development. Never use in production.
    """

    def __init__(self):
        import warnings
        warnings.warn(
            "SubprocessSandbox is running user code on the HOST with no isolation. "
            "This is a severe security risk. Set SANDBOX_TYPE=docker in .env for production.",
            UserWarning,
            stacklevel=2,
        )

    async def execute(self, code: str, timeout: int = 15) -> dict:
        import subprocess as sp
        import warnings
        warnings.warn("Executing user code on host without container isolation!")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmp_path = f.name
        try:
            proc = sp.run(
                ["python", tmp_path],
                capture_output=True, text=True, timeout=timeout,
                cwd=tempfile.gettempdir(),
            )
            return {
                "stdout": proc.stdout, "stderr": proc.stderr,
                "exit_code": proc.returncode,
                "status": "success" if proc.returncode == 0 else "error",
            }
        except sp.TimeoutExpired:
            return {"stdout": "", "stderr": "Execution timed out", "exit_code": -1, "status": "timeout"}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "exit_code": -1, "status": "error"}
        finally:
            os.unlink(tmp_path)


def get_sandbox():
    if SANDBOX_TYPE == "docker":
        try:
            sandbox = DockerSandbox()
            sandbox._ensure_image()
            return sandbox
        except Exception:
            pass
    return SubprocessSandbox()

"""
GladME Studio V4 — MCP Server
Exposes GladME tools to external IDEs via MCP protocol.
"""

import json
from typing import Any

MCP_TOOLS = [
    {
        "name": "gladme_generate_plan",
        "description": "Generate a development plan from goal and logic using AI",
        "inputSchema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string", "description": "Project goal"},
                "logic": {"type": "string", "description": "System logic/workflow"},
                "model": {"type": "string", "default": "gemma4:latest"},
            },
            "required": ["goal", "logic"],
        },
    },
    {
        "name": "gladme_generate_code",
        "description": "Generate implementation code from goal, logic, and plan",
        "inputSchema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string"},
                "logic": {"type": "string"},
                "plan": {"type": "string"},
                "model": {"type": "string", "default": "gemma4:latest"},
            },
            "required": ["goal", "logic", "plan"],
        },
    },
    {
        "name": "gladme_verify",
        "description": "Verify project state against GladME FSM lifecycle rules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string"},
                "logic": {"type": "string"},
                "plan": {"type": "string"},
                "code": {"type": "string"},
            },
            "required": ["goal", "logic"],
        },
    },
    {
        "name": "gladme_execute",
        "description": "Execute Python code in Docker sandbox",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "timeout": {"type": "integer", "default": 30},
            },
            "required": ["code"],
        },
    },
    {
        "name": "gladme_run_skill",
        "description": "Run a GladME skill (generate-tests, security-scan, etc.)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string"},
                "project_state": {"type": "object"},
                "model": {"type": "string", "default": "gemma4:latest"},
            },
            "required": ["skill_name", "project_state"],
        },
    },
    {
        "name": "gladme_get_project_state",
        "description": "Get the current state of a project",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "integer"},
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "gladme_evolve",
        "description": "Get AI evolution suggestions for the current project",
        "inputSchema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string"},
                "logic": {"type": "string"},
                "plan": {"type": "string"},
                "code": {"type": "string"},
                "model": {"type": "string", "default": "gemma4:latest"},
            },
            "required": ["goal", "logic"],
        },
    },
]

MCP_RESOURCES = [
    {"uri": "gladme://projects", "name": "Projects", "description": "List all projects"},
    {"uri": "gladme://projects/{id}", "name": "Project State", "description": "Get project state by ID"},
    {"uri": "gladme://projects/{id}/versions", "name": "Version History", "description": "Get version history"},
    {"uri": "gladme://skills", "name": "Skills", "description": "List available skills"},
]


def get_mcp_tools_list() -> list[dict]:
    return MCP_TOOLS


def get_mcp_resources_list() -> list[dict]:
    return MCP_RESOURCES


def format_mcp_response(result: Any) -> dict:
    return {
        "jsonrpc": "2.0",
        "result": {"content": [{"type": "text", "text": json.dumps(result, default=str)}]},
    }

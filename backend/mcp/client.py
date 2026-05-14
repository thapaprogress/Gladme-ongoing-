"""
GladME Studio V4 — MCP Client
Connects to external MCP servers (filesystem, github, postgres, etc.)
"""

import httpx
import json
from typing import Optional
from config import settings


class MCPConnection:
    def __init__(self, name: str, url: str):
        self.name = name
        self.url = url

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    async def list_tools(self) -> list:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.url}",
                    json={"jsonrpc": "2.0", "method": "tools/list", "id": 1},
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("result", {}).get("tools", [])
        except Exception:
            pass
        return []

    async def call_tool(self, tool_name: str, arguments: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.url}",
                    json={
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {"name": tool_name, "arguments": arguments},
                        "id": 2,
                    },
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    return resp.json().get("result", {})
        except Exception:
            pass
        return {"error": f"Failed to call tool '{tool_name}' on server '{self.name}'"}


class MCPClient:
    def __init__(self):
        self.servers = {}
        for name, url in settings.mcp_server_dict.items():
            self.servers[name] = MCPConnection(name, url)

    async def list_servers(self) -> dict:
        result = {}
        for name, conn in self.servers.items():
            result[name] = {
                "url": conn.url,
                "available": await conn.is_available(),
            }
        return result

    async def list_server_tools(self, server_name: str) -> list:
        conn = self.servers.get(server_name)
        if not conn:
            return []
        return await conn.list_tools()

    async def call_tool(self, server_name: str, tool_name: str, arguments: dict) -> dict:
        conn = self.servers.get(server_name)
        if not conn:
            return {"error": f"Server '{server_name}' not configured"}
        if not await conn.is_available():
            return {"error": f"Server '{server_name}' is not available"}
        return await conn.call_tool(tool_name, arguments)


mcp_client = MCPClient()

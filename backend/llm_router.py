"""
GladME Studio V4 — LLM Router
Issue #5 FIX: Full fallback chain — Ollama → OpenAI → Anthropic → template.
Issue #6 FIX: API keys never exposed to frontend. Provider availability returned without keys.
FIX: Added logging instead of silent Exception:pass.
"""

import httpx
import json
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

OLLAMA_BASE = settings.ollama_base_url
DEFAULT_MODEL = settings.default_model


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str = OLLAMA_BASE):
        self.base_url = base_url

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception as e:
            logger.debug(f"Ollama availability check failed: {e}")
            return False

    async def list_models(self) -> list:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.debug(f"Ollama list_models failed: {e}")
        return []

    async def generate(self, prompt: str, model: str = DEFAULT_MODEL) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("response", "").strip()
                logger.warning(f"Ollama generate returned status {resp.status_code}")
        except Exception as e:
            logger.warning(f"Ollama generate failed: {e}")
        return ""

    async def chat(self, messages: list, model: str = DEFAULT_MODEL) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/chat",
                    json={"model": model, "messages": messages, "stream": False},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("message", {}).get("content", "").strip()
                logger.warning(f"Ollama chat returned status {resp.status_code}")
        except Exception as e:
            logger.warning(f"Ollama chat failed: {e}")
        return ""

    async def generate_stream(self, prompt: str, model: str = DEFAULT_MODEL):
        """Yield tokens from Ollama streaming API."""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        return
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                yield token
                            if chunk.get("done", False):
                                return
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.warning(f"Ollama generate_stream failed: {e}")
            return

    async def pull_model(self, model_name: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": model_name, "stream": False},
                )
                return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama pull_model failed: {e}")
            return False


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.openai_api_key
        self.base_url = "https://api.openai.com/v1"

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list:
        if not self.api_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["id"] for m in data.get("data", []) if "gpt" in m.get("id", "").lower()]
        except Exception as e:
            logger.debug(f"OpenAI list_models failed: {e}")
        return []

    async def generate(self, prompt: str, model: str = "gpt-4o-mini") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"].strip()
                logger.warning(f"OpenAI generate returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"OpenAI generate failed: {e}")
        return ""

    async def chat(self, messages: list, model: str = "gpt-4o-mini") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": messages, "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                logger.warning(f"OpenAI chat returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"OpenAI chat failed: {e}")
        return ""

    async def generate_stream(self, prompt: str, model: str = "gpt-4o-mini"):
        if not self.api_key:
            return
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 4096, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        return
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.warning(f"OpenAI generate_stream failed: {e}")
            return


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.anthropic_api_key
        self.base_url = "https://api.anthropic.com/v1"

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list:
        return ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"] if self.api_key else []

    async def generate(self, prompt: str, model: str = "claude-3-5-sonnet-20241022") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 4096,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["content"][0]["text"].strip()
                logger.warning(f"Anthropic generate returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Anthropic generate failed: {e}")
        return ""

    async def chat(self, messages: list, model: str = "claude-3-5-sonnet-20241022") -> str:
        if not self.api_key:
            return ""
        system_msg = ""
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_messages.append(m)
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 4096,
                        "system": system_msg if system_msg else None,
                        "messages": user_messages,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["content"][0]["text"].strip()
                logger.warning(f"Anthropic chat returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Anthropic chat failed: {e}")
        return ""


class GeminiProvider:
    """Google Gemini via REST API (no SDK dep)."""
    name = "gemini"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.gemini_api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list:
        return ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] if self.api_key else []

    async def _call(self, prompt: str, model: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/models/{model}:generateContent?key={self.api_key}",
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                logger.warning(f"Gemini returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Gemini call failed: {e}")
        return ""

    async def generate(self, prompt: str, model: str = "gemini-2.0-flash") -> str:
        return await self._call(prompt, model)

    async def chat(self, messages: list, model: str = "gemini-2.0-flash") -> str:
        combined = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        )
        return await self._call(combined, model)


class GrokProvider:
    """xAI Grok — OpenAI-compatible endpoint."""
    name = "grok"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.grok_api_key
        self.base_url = "https://api.x.ai/v1"

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list:
        return ["grok-3", "grok-3-fast", "grok-2"] if self.api_key else []

    async def generate(self, prompt: str, model: str = "grok-3") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                logger.warning(f"Grok returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Grok generate failed: {e}")
        return ""

    async def chat(self, messages: list, model: str = "grok-3") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": messages, "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                logger.warning(f"Grok chat returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Grok chat failed: {e}")
        return ""


class DeepseekProvider:
    """DeepSeek — OpenAI-compatible endpoint."""
    name = "deepseek"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.deepseek_api_key
        self.base_url = "https://api.deepseek.com/v1"

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list:
        return ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"] if self.api_key else []

    async def generate(self, prompt: str, model: str = "deepseek-chat") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                logger.warning(f"Deepseek returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Deepseek generate failed: {e}")
        return ""

    async def chat(self, messages: list, model: str = "deepseek-chat") -> str:
        if not self.api_key:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"model": model, "messages": messages, "max_tokens": 4096},
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                logger.warning(f"Deepseek chat returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Deepseek chat failed: {e}")
        return ""


class LLMRouter:
    """
    Issue #5 FIX: Full fallback chain.
    Tries providers in order: ollama → openai → anthropic → template fallback.
    Issue #6 FIX: get_provider_status() returns availability only, never keys.
    FIX: Provider availability is cached for 30 seconds to reduce latency.
    V5: Added generate_stream for SSE support.
    """

    def __init__(self):
        self.providers = {
            "ollama": OllamaProvider(),
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
            "gemini": GeminiProvider(),
            "grok": GrokProvider(),
            "deepseek": DeepseekProvider(),
        }
        self.fallback_order = ["ollama", "openai", "anthropic", "gemini", "grok", "deepseek"]
        self._availability_cache = {}
        self._cache_ttl = 30

    def _is_cache_valid(self, key):
        if key not in self._availability_cache:
            return False
        cached_time, _ = self._availability_cache[key]
        import time
        return (time.time() - cached_time) < self._cache_ttl

    async def _check_available(self, p_name):
        if self._is_cache_valid(p_name):
            return self._availability_cache[p_name][1]
        p = self.providers.get(p_name)
        if not p:
            return False
        available = await p.is_available()
        import time
        self._availability_cache[p_name] = (time.time(), available)
        return available

    async def generate(self, prompt: str, model: str = DEFAULT_MODEL,
                       provider: Optional[str] = None) -> tuple[str, str]:
        """
        Returns (response_text, provider_name_used).
        Falls through providers until one returns content.
        """
        if provider:
            order = [provider] + [p for p in self.fallback_order if p != provider]
        else:
            order = self.fallback_order

        for p_name in order:
            p = self.providers.get(p_name)
            if not p:
                continue
            if not await self._check_available(p_name):
                continue
            result = await p.generate(prompt, model)
            if result:
                return result, p_name

        return self._template_fallback(prompt), "template"

    async def generate_stream(self, prompt: str, model: str = DEFAULT_MODEL,
                              provider: Optional[str] = None):
        """
        SSE streaming generator. Yields dicts: {"token": str} or {"done": True, "provider": str}.
        Falls through providers like generate().
        """
        if provider:
            order = [provider] + [p for p in self.fallback_order if p != provider]
        else:
            order = self.fallback_order

        for p_name in order:
            p = self.providers.get(p_name)
            if not p:
                continue
            if not await self._check_available(p_name):
                continue
            if hasattr(p, "generate_stream"):
                try:
                    async for chunk in p.generate_stream(prompt, model):
                        yield {"token": chunk, "provider": p_name}
                    yield {"done": True, "provider": p_name}
                    return
                except Exception as e:
                    logger.warning(f"Stream failed for {p_name}: {e}, trying next")
                    continue
            else:
                result = await p.generate(prompt, model)
                if result:
                    yield {"token": result, "provider": p_name}
                    yield {"done": True, "provider": p_name}
                    return

        fallback_text = self._template_fallback(prompt)
        yield {"token": fallback_text, "provider": "template"}
        yield {"done": True, "provider": "template"}

    async def chat(self, messages: list, model: str = DEFAULT_MODEL,
                   provider: Optional[str] = None) -> tuple[str, str]:
        if provider:
            order = [provider] + [p for p in self.fallback_order if p != provider]
        else:
            order = self.fallback_order

        for p_name in order:
            p = self.providers.get(p_name)
            if not p:
                continue
            if not await self._check_available(p_name):
                continue
            result = await p.chat(messages, model)
            if result:
                return result, p_name

        return self._template_fallback(messages[-1]["content"] if messages else ""), "template"

    async def get_provider_status(self) -> dict:
        """
        Issue #6 FIX: Returns only availability flags and model names.
        NEVER includes API keys.
        """
        status = {}
        for name, provider in self.providers.items():
            available = await provider.is_available()
            models = await provider.list_models() if available else []
            status[name] = {
                "available": available,
                "models": models,
            }
        return status

    def _template_fallback(self, prompt: str) -> str:
        if "development plan" in prompt.lower() or "architecture" in prompt.lower():
            return """## GladME Auto-Generated Plan (Template Mode)\n> NOTE: All LLM providers are offline.\n\n### 1. Architecture Overview\n- Frontend: React + Vite\n- Backend: FastAPI + SQLAlchemy\n- Database: SQLite (dev) / PostgreSQL (prod)\n\n### 2. Module Breakdown\n- Goal Manager, Logic Processor, Planner Agent, Coder Agent, Verifier, Monitor, Evolution Engine\n\n### 3. Implementation Steps\n1. Set up project skeleton\n2. Implement Goal & Logic capture\n3. Build planning engine\n4. Implement code generation\n5. Add verification pipeline\n6. Deploy monitoring hooks\n7. Enable evolution tracking"""
        elif "python code" in prompt.lower() or "implement" in prompt.lower():
            return '# Auto-Generated Code (Template Mode)\n# NOTE: All LLM providers are offline.\n\nclass GladMEProject:\n    def __init__(self, goal: str, logic: str):\n        self.goal = goal\n        self.logic = logic\n        self.phase = "Goal"\n\n    def run(self):\n        print(f"Goal: {self.goal}")\n        print(f"Logic: {self.logic}")\n\nif __name__ == "__main__":\n    GladMEProject("Example", "Input -> Output").run()'
        else:
            return "## Suggestions (Template Mode)\n\n1. Connect Ollama for AI-powered suggestions\n2. Add test coverage\n3. Implement structured logging\n4. Set up CI/CD pipeline"


llm_router = LLMRouter()

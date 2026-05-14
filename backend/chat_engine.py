"""
GladME Studio V4 — Chat Engine
Issue #4 FIX: Chat messages persisted in ChatMessage DB table.
Multi-turn context management with project state awareness.
"""

from llm_router import llm_router
from database import SessionLocal, ChatMessage
from typing import Optional
from string import Template

SYSTEM_PROMPT = Template("""You are GladME Studio's AI coding assistant — the Vibe Agent.
Current project state:
- Goal: $goal
- Logic: $logic
- Plan: $plan
- Current Code: $code

Help the developer refine, debug, or extend the code.
When generating code, wrap it in ```python ... ``` code blocks.
When explaining, be concise and actionable.
When the user says "apply this", indicate which code block to apply.""")


class ChatEngine:
    def __init__(self, project_id: int):
        self.project_id = project_id

    def _build_system_prompt(self, goal: str = "", logic: str = "",
                             plan: str = "", code: str = "") -> str:
        return SYSTEM_PROMPT.safe_substitute(
            goal=goal or "Not set",
            logic=logic or "Not set",
            plan=(plan or "Not generated")[:500],
            code=(code or "Not generated")[:1000],
        )

    async def chat(self, user_message: str, goal: str, logic: str,
                   plan: str, code: str, model: str = "gemma4:latest",
                   provider: Optional[str] = None) -> tuple[str, str]:
        """
        Issue #4 FIX: Loads last 20 messages from DB, adds new user message,
        calls LLM, saves both user + assistant messages to DB.
        Returns (assistant_response, provider_used).
        """
        db = SessionLocal()
        try:
            history = db.query(ChatMessage).filter(
                ChatMessage.project_id == self.project_id
            ).order_by(ChatMessage.timestamp.desc()).limit(20).all()
            history.reverse()

            messages = [{"role": "system", "content": self._build_system_prompt(goal, logic, plan, code)}]
            for h in history:
                messages.append({"role": h.role, "content": h.content})

            messages.append({"role": "user", "content": user_message})

            db_user_msg = ChatMessage(
                project_id=self.project_id,
                role="user",
                content=user_message,
            )
            db.add(db_user_msg)
            db.commit()

            response, used_provider = await llm_router.chat(messages, model, provider)

            db_assistant_msg = ChatMessage(
                project_id=self.project_id,
                role="assistant",
                content=response,
            )
            db.add(db_assistant_msg)
            db.commit()

            return response, used_provider
        finally:
            db.close()

    def get_history(self, limit: int = 50) -> list:
        db = SessionLocal()
        try:
            msgs = db.query(ChatMessage).filter(
                ChatMessage.project_id == self.project_id
            ).order_by(ChatMessage.timestamp.asc()).limit(limit).all()
            return [{"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat() if m.timestamp else None} for m in msgs]
        finally:
            db.close()

    def clear_history(self):
        db = SessionLocal()
        try:
            db.query(ChatMessage).filter(ChatMessage.project_id == self.project_id).delete()
            db.commit()
        finally:
            db.close()

"""
GladME Studio V4 — Test Generation Engine
Uses LLM Router (Issue #5 fix) for fallback chain.
"""

from llm_router import llm_router

TEST_PROMPT = """You are the Test Agent in the GladME framework.
Given the Goal, Logic, Plan, and Code below, generate comprehensive Python tests.

## Goal
{goal}

## Logic
{logic}

## Plan Summary
{plan}

## Code
{code}

## Instructions
Generate pytest test cases that cover:
1. **Happy Path Tests** — Expected inputs produce expected outputs
2. **Edge Cases** — Empty inputs, boundary values, type mismatches
3. **Error Handling** — Exceptions are raised correctly
4. **Integration Tests** — Module interactions work correctly
5. **Security Tests** — Input validation, injection prevention

Output ONLY Python pytest code. Use `from main import *` or import the main module as needed.
No explanations, no markdown fences."""


async def generate_tests(goal: str, logic: str, plan: str, code: str,
                        model: str = "gemma4:latest", provider: str = None) -> tuple[str, str]:
    prompt = TEST_PROMPT.format(
        goal=goal, logic=logic,
        plan=plan[:2000], code=code[:4000],
    )
    result, used_provider = await llm_router.generate(prompt, model, provider)
    if "```python" in result:
        result = result.split("```python")[1].split("```")[0].strip()
    elif "```" in result:
        result = result.split("```")[1].split("```")[0].strip()
    return result, used_provider

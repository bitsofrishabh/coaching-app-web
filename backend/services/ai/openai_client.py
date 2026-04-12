import json
import os
from typing import Any, Dict, Optional

import requests


OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_OPENAI_MODEL = "gpt-4o"


class OpenAIAPIError(RuntimeError):
    pass


def generate_structured_output(
    *,
    system_prompt: str,
    user_prompt: str,
    schema: Dict[str, Any],
    schema_name: str = "structured_output",
    model: Optional[str] = None,
    max_tokens: int = 1800,
    temperature: float = 0,
) -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIAPIError("OPENAI_API_KEY is not configured")

    response = requests.post(
        OPENAI_CHAT_COMPLETIONS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model or os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        },
        timeout=90,
    )

    if not response.ok:
        detail: Any = response.text
        try:
            detail = response.json()
        except Exception:
            pass
        raise OpenAIAPIError(f"OpenAI API request failed: {detail}")

    payload = response.json()
    choice = (payload.get("choices") or [{}])[0]
    message = choice.get("message") or {}

    refusal = message.get("refusal")
    if refusal:
        raise OpenAIAPIError(f"GPT-4o refused the analysis request: {refusal}")

    content = message.get("content") or ""
    if not content:
        raise OpenAIAPIError("OpenAI API returned an empty structured response")

    try:
        parsed = json.loads(content)
    except Exception as exc:
        raise OpenAIAPIError(f"Failed to parse OpenAI structured output: {exc}") from exc

    if not isinstance(parsed, dict):
        raise OpenAIAPIError("OpenAI structured output must be a JSON object")

    return parsed

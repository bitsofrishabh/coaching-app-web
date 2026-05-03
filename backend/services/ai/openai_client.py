import json
import os
from typing import Any, Dict, Optional

import requests


OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_OPENAI_MODEL = "gpt-4o"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


class OpenAIAPIError(RuntimeError):
    pass


def get_llm_provider() -> str:
    provider = str(os.environ.get("AI_PROVIDER") or "").strip().lower()
    if provider in {"openai", "gemini"}:
        return provider
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    return "openai"


def get_default_model(provider: Optional[str] = None) -> str:
    resolved_provider = provider or get_llm_provider()
    if resolved_provider == "gemini":
        return (
            os.environ.get("AI_MODEL")
            or os.environ.get("GEMINI_MODEL")
            or DEFAULT_GEMINI_MODEL
        )
    return (
        os.environ.get("AI_MODEL")
        or os.environ.get("OPENAI_MODEL")
        or DEFAULT_OPENAI_MODEL
    )


def _parse_json_object(content: str, provider: str) -> Dict[str, Any]:
    if not content:
        raise OpenAIAPIError(f"{provider.title()} API returned an empty structured response")

    try:
        parsed = json.loads(content)
    except Exception as exc:
        raise OpenAIAPIError(f"Failed to parse {provider.title()} structured output: {exc}") from exc

    if not isinstance(parsed, dict):
        raise OpenAIAPIError(f"{provider.title()} structured output must be a JSON object")
    return parsed


def _generate_with_openai(
    *,
    system_prompt: str,
    user_prompt: str,
    schema: Dict[str, Any],
    schema_name: str,
    model: Optional[str],
    max_tokens: int,
    temperature: float,
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
            "model": model or get_default_model("openai"),
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
        raise OpenAIAPIError(f"OpenAI refused the analysis request: {refusal}")

    return _parse_json_object(message.get("content") or "", "openai")


def _generate_with_gemini(
    *,
    system_prompt: str,
    user_prompt: str,
    schema: Dict[str, Any],
    model: Optional[str],
    max_tokens: int,
    temperature: float,
) -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise OpenAIAPIError("GEMINI_API_KEY is not configured")

    resolved_model = model or get_default_model("gemini")
    response = requests.post(
        GEMINI_GENERATE_CONTENT_URL.format(model=resolved_model),
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
                "responseSchema": schema,
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
        raise OpenAIAPIError(f"Gemini API request failed: {detail}")

    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        raise OpenAIAPIError("Gemini API returned no candidates")

    candidate = candidates[0]
    finish_reason = candidate.get("finishReason")
    if finish_reason and finish_reason not in {"STOP", "MAX_TOKENS"}:
        raise OpenAIAPIError(f"Gemini returned finishReason={finish_reason}")

    parts = ((candidate.get("content") or {}).get("parts") or [])
    content = "".join(str(part.get("text") or "") for part in parts)
    return _parse_json_object(content, "gemini")


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
    provider = get_llm_provider()
    if provider == "gemini":
        return _generate_with_gemini(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=schema,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    return _generate_with_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=schema,
        schema_name=schema_name,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .openai_client import generate_structured_output


CLIENT_QUERY_CLASSIFICATION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": [
                "weight_change",
                "diet_expiry",
                "program_expiry",
                "follow_up_due",
                "client_profile_search",
                "diet_conflict_check",
                "business_summary",
            ],
        },
        "direction": {"type": "string", "enum": ["loss", "gain", "any", "none"]},
        "threshold_kg": {"type": "number"},
        "window_days": {"type": "integer"},
        "profile_terms": {"type": "array", "items": {"type": "string"}},
        "answer_focus": {"type": "string"},
    },
    "required": ["intent", "direction", "threshold_kg", "window_days", "profile_terms", "answer_focus"],
    "additionalProperties": False,
}


CLIENT_BUSINESS_ANALYSIS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "executive_summary": {"type": "string"},
        "priority_clients": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "client_id": {"type": "string"},
                    "name": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "reason": {"type": "string"},
                    "next_action": {"type": "string"},
                },
                "required": ["client_id", "name", "priority", "reason", "next_action"],
                "additionalProperties": False,
            },
        },
        "cohort_observations": {"type": "array", "items": {"type": "string"}},
        "retention_risks": {"type": "array", "items": {"type": "string"}},
        "growth_opportunities": {"type": "array", "items": {"type": "string"}},
        "recommended_operations": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "confidence_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "executive_summary",
        "priority_clients",
        "cohort_observations",
        "retention_risks",
        "growth_opportunities",
        "recommended_operations",
        "follow_up_questions",
        "confidence_notes",
    ],
    "additionalProperties": False,
}


def _truncate(value: Any, max_chars: int) -> str:
    text = str(value or "").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n\n[truncated]"


def generate_client_business_analysis(
    *,
    clients: List[Dict[str, Any]],
    prompt: Optional[str],
    context_summary: Dict[str, Any],
    model: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are Rishabh and Savita's strategic business partner for a dietitian/coaching practice. "
        "Analyze client profile data, routine/adherence context, diet/report/file signals, meal-upload signals, "
        "and the dietitian's question to produce a practical operating brief. "
        "Think carefully before answering, but do not reveal private chain-of-thought; return only conclusions, "
        "concise rationale, prioritized actions, and uncertainty notes. "
        "Do not diagnose disease, do not invent missing client facts, and do not claim that meal photos or reports "
        "were visually/clinically interpreted unless extracted text or prior analysis is explicitly provided. "
        "Prefer Indian dietitian business context: retention, follow-up discipline, adherence, food-preference fit, "
        "diet expiry, program status, and next best action. AI is advisory; the dietitian makes final decisions."
    )

    user_prompt = (
        f"Dietitian question:\n{prompt or 'Analyze the client base and recommend the next best actions.'}\n\n"
        "Context summary:\n"
        f"{json.dumps(context_summary, ensure_ascii=True, indent=2)}\n\n"
        "Client records JSON:\n"
        f"{_truncate(json.dumps(clients, ensure_ascii=True, indent=2), 36000)}"
    )

    return generate_structured_output(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=CLIENT_BUSINESS_ANALYSIS_SCHEMA,
        schema_name="client_business_analysis",
        model=model,
        max_tokens=2600,
        temperature=0,
    )


def classify_client_operations_query(*, prompt: str, model: Optional[str] = None) -> Dict[str, Any]:
    system_prompt = (
        "Classify a dietitian's natural-language client operations question into one backend tool intent. "
        "Return only structured JSON. Backend tools will calculate exact facts; do not answer the question. "
        "Use weight_change for weight loss/gain questions, diet_expiry for diet end/expiry questions, "
        "program_expiry for program ending questions, follow_up_due for due follow-ups, client_profile_search for "
        "allergy/food preference/health issue/status/location searches, diet_conflict_check for diet-vs-allergy or "
        "food restriction safety checks, and business_summary for broad strategy questions. "
        "For relative date windows, extract the largest day count mentioned; default to 7. "
        "For weight thresholds, extract kilograms mentioned; default to 1. "
        "If the question says 2-3 days, use 3."
    )
    user_prompt = f"Question: {prompt}"
    return generate_structured_output(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=CLIENT_QUERY_CLASSIFICATION_SCHEMA,
        schema_name="client_query_classification",
        model=model,
        max_tokens=700,
        temperature=0,
    )

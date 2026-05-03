from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .openai_client import generate_structured_output


DIET_ANALYSIS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "plan_summary": {
            "type": "object",
            "properties": {
                "avg_daily_calories": {"type": "number"},
                "avg_daily_protein_g": {"type": "number"},
                "protein_adequacy_percent": {"type": "number"},
                "calorie_alignment": {"type": "string"},
                "protein_alignment": {"type": "string"},
                "overall_summary": {"type": "string"},
                "confidence_notes": {"type": "array", "items": {"type": "string"}},
            },
            "required": [
                "avg_daily_calories",
                "avg_daily_protein_g",
                "protein_adequacy_percent",
                "calorie_alignment",
                "protein_alignment",
                "overall_summary",
                "confidence_notes",
            ],
            "additionalProperties": False,
        },
        "day_analysis": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "day": {"type": "integer"},
                    "estimated_calories": {"type": "number"},
                    "estimated_protein_g": {"type": "number"},
                    "notes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["day", "estimated_calories", "estimated_protein_g", "notes"],
                "additionalProperties": False,
            },
        },
        "improvement_opportunities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "message": {"type": "string"},
                },
                "required": ["type", "severity", "message"],
                "additionalProperties": False,
            },
        },
        "suggested_actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action_key": {"type": "string"},
                    "label": {"type": "string"},
                    "prompt_seed": {"type": "string"},
                },
                "required": ["action_key", "label", "prompt_seed"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["plan_summary", "day_analysis", "improvement_opportunities", "suggested_actions"],
    "additionalProperties": False,
}


DIET_SUGGESTION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "prompt_label": {"type": "string"},
        "summary": {"type": "string"},
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "reason": {"type": "string"},
                    "expected_benefit": {"type": "string"},
                },
                "required": ["title", "reason", "expected_benefit"],
                "additionalProperties": False,
            },
        },
        "proposed_changes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "day": {"type": "integer"},
                    "slot": {"type": "string"},
                    "current_value": {"type": "string"},
                    "suggested_value": {"type": "string"},
                    "reason": {"type": "string"},
                    "estimated_calorie_delta": {"type": "number"},
                    "estimated_protein_delta_g": {"type": "number"},
                },
                "required": [
                    "day",
                    "slot",
                    "current_value",
                    "suggested_value",
                    "reason",
                    "estimated_calorie_delta",
                    "estimated_protein_delta_g",
                ],
                "additionalProperties": False,
            },
        },
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "confidence_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "prompt_label",
        "summary",
        "recommendations",
        "proposed_changes",
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


def _serialize_day_wise_plan(day_wise_plan: List[Dict[str, Any]]) -> str:
    return json.dumps(day_wise_plan, ensure_ascii=True, indent=2)


def generate_diet_plan_analysis(
    *,
    client: Dict[str, Any],
    plan_days: int,
    day_wise_plan: List[Dict[str, Any]],
    summary_slots: Dict[str, str],
    client_context: Dict[str, Any],
    model: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are an assistant supporting an Indian dietitian. "
        "You will analyze a structured day-wise diet plan, estimate daily calories and protein conservatively, "
        "compare it against the provided calorie target and protein target, and explain practical improvement areas. "
        "Prefer Indian diet assumptions unless the meals clearly indicate otherwise. "
        "Do not claim precision when the meal wording is vague. Put uncertainty into confidence_notes. "
        "Do not rewrite the diet here; focus on analysis plus suggested action seeds."
    )

    user_prompt = (
        "Client profile:\n"
        f"- Name: {client.get('name') or 'Unknown'}\n"
        f"- Age: {client.get('age') or 'Unknown'}\n"
        f"- Gender: {client.get('gender') or 'Unknown'}\n"
        f"- Height (cm): {client.get('height_cm') or 'Unknown'}\n"
        f"- Current weight (kg): {client.get('current_weight_kg') or client.get('initial_weight_kg') or 'Unknown'}\n"
        f"- Goal weight (kg): {client.get('goal_weight_kg') or 'Unknown'}\n"
        f"- Diet preference: {client.get('diet_preference') or 'Unknown'}\n"
        f"- Health issues: {client.get('health_issues') or 'None provided'}\n"
        f"- Notes: {client.get('notes') or client.get('about_client') or 'None provided'}\n\n"
        "Target context:\n"
        f"- Maintenance calories: {client_context.get('maintenance_calories') or 'Unknown'}\n"
        f"- Recommended daily deficit: {client_context.get('recommended_daily_deficit') or 0}\n"
        f"- Target daily calories: {client_context.get('target_daily_calories') or 'Unknown'}\n"
        f"- Estimated protein target (g): {client_context.get('estimated_protein_target_g') or 'Unknown'}\n\n"
        "Top summary slots:\n"
        f"{json.dumps(summary_slots, ensure_ascii=True, indent=2)}\n\n"
        f"Plan days: {plan_days}\n"
        "Day-wise plan JSON:\n"
        f"{_truncate(_serialize_day_wise_plan(day_wise_plan), 24000)}"
    )

    return generate_structured_output(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=DIET_ANALYSIS_SCHEMA,
        schema_name="diet_plan_analysis",
        model=model,
        max_tokens=2600,
        temperature=0,
    )


def generate_diet_plan_suggestions(
    *,
    client: Dict[str, Any],
    plan_days: int,
    day_wise_plan: List[Dict[str, Any]],
    summary_slots: Dict[str, str],
    client_context: Dict[str, Any],
    action_key: Optional[str] = None,
    custom_prompt: Optional[str] = None,
    day: Optional[int] = None,
    slot: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are an assistant supporting an Indian dietitian. "
        "Return structured, coach-facing suggestions only. "
        "Keep recommendations realistic for Indian diet plans and respect the client's diet preference. "
        "When suggesting changes, target explicit day/slot edits only, do not invent slots outside the provided plan schema. "
        "If the user asks for five options, include them in recommendations and use proposed_changes only where a concrete replacement makes sense. "
        "Estimate calorie and protein deltas conservatively and note uncertainty."
    )

    user_prompt = (
        "Client profile:\n"
        f"- Name: {client.get('name') or 'Unknown'}\n"
        f"- Diet preference: {client.get('diet_preference') or 'Unknown'}\n"
        f"- Health issues: {client.get('health_issues') or 'None provided'}\n"
        f"- Maintenance calories: {client_context.get('maintenance_calories') or 'Unknown'}\n"
        f"- Target daily calories: {client_context.get('target_daily_calories') or 'Unknown'}\n"
        f"- Estimated protein target (g): {client_context.get('estimated_protein_target_g') or 'Unknown'}\n\n"
        f"Requested action key: {action_key or '[none]'}\n"
        f"Custom prompt: {custom_prompt or '[none]'}\n"
        f"Scope day: {day or '[all]'}\n"
        f"Scope slot: {slot or '[all]'}\n\n"
        "Top summary slots:\n"
        f"{json.dumps(summary_slots, ensure_ascii=True, indent=2)}\n\n"
        f"Plan days: {plan_days}\n"
        "Day-wise plan JSON:\n"
        f"{_truncate(_serialize_day_wise_plan(day_wise_plan), 22000)}"
    )

    return generate_structured_output(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=DIET_SUGGESTION_SCHEMA,
        schema_name="diet_plan_suggestions",
        model=model,
        max_tokens=2600,
        temperature=0,
    )

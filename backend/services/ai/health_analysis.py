from typing import Any, Dict, Optional

from .openai_client import generate_structured_output


HEALTH_ANALYSIS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "overall_summary": {"type": "string"},
        "clinical_risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "reason": {"type": "string"},
                },
                "required": ["label", "severity", "reason"],
                "additionalProperties": False,
            },
        },
        "nutrition_gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "reason": {"type": "string"},
                },
                "required": ["label", "severity", "reason"],
                "additionalProperties": False,
            },
        },
        "diet_pattern_observations": {"type": "array", "items": {"type": "string"}},
        "recommended_adjustments": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "confidence_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "overall_summary",
        "clinical_risks",
        "nutrition_gaps",
        "diet_pattern_observations",
        "recommended_adjustments",
        "follow_up_questions",
        "confidence_notes",
    ],
    "additionalProperties": False,
}


def _truncate_text(value: Optional[str], max_chars: int) -> str:
    text = (value or "").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n\n[truncated]"


def _format_list_field(value: Any) -> str:
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
    elif value:
        items = [str(value).strip()]
    else:
        items = []
    return ", ".join(items) or "None provided"


def _normalize_analysis_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "overall_summary": str(payload.get("overall_summary") or "").strip(),
        "clinical_risks": payload.get("clinical_risks") or [],
        "nutrition_gaps": payload.get("nutrition_gaps") or [],
        "diet_pattern_observations": payload.get("diet_pattern_observations") or [],
        "recommended_adjustments": payload.get("recommended_adjustments") or [],
        "follow_up_questions": payload.get("follow_up_questions") or [],
        "confidence_notes": payload.get("confidence_notes") or [],
    }


def generate_client_health_analysis(
    *,
    client: Dict[str, Any],
    blood_report_text: Optional[str],
    past_diet_text: Optional[str],
    model: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are the dietitian's analytical business partner and client-success strategist. "
        "Analyze the supplied blood report text, past diet plan text, and client profile to produce a concise, "
        "coach-facing health and operations summary that helps the team decide what to do next. "
        "Think carefully before answering, but do not reveal private chain-of-thought; return only conclusions, "
        "evidence-based rationale, next actions, and uncertainty notes. "
        "Do not diagnose disease, do not invent lab values, and do not claim evidence that is not explicitly present "
        "in the inputs. If information is missing or unclear, state that in confidence_notes. "
        "Focus on practical risk flags, nutrition gaps, diet adherence patterns, food-preference fit, routine constraints, "
        "client-retention risks, and actionable follow-up questions. Keep recommendations Indian-diet friendly unless "
        "the client's context clearly suggests otherwise."
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
        f"- Allergies: {_format_list_field(client.get('allergies'))}\n"
        f"- Avoid foods: {_format_list_field(client.get('avoid_foods'))}\n"
        f"- Preferred foods: {_format_list_field(client.get('preferred_foods'))}\n"
        f"- Disliked foods: {_format_list_field(client.get('disliked_foods'))}\n"
        f"- Medical food restrictions: {_format_list_field(client.get('medical_food_restrictions'))}\n"
        f"- Status: {client.get('status') or 'Unknown'}\n"
        f"- Profession: {client.get('profession') or 'Unknown'}\n"
        f"- Location: {client.get('location') or 'Unknown'}\n"
        f"- Sleep quality: {client.get('sleep_quality') or 'Unknown'}\n"
        f"- Sleep hours: {client.get('sleep_hours') or 'Unknown'}\n"
        f"- Morning freshness: {client.get('morning_freshness') or 'Unknown'}\n"
        f"- Recent team comment: {client.get('recent_comment') or 'None provided'}\n"
        f"- Last follow-up date: {client.get('last_follow_up_date') or 'Unknown'}\n"
        f"- Upcoming follow-up date: {client.get('upcoming_follow_up_date') or 'Unknown'}\n"
        f"- Notes: {client.get('notes') or client.get('about_client') or 'None provided'}\n\n"
        "Blood report text:\n"
        f"{_truncate_text(blood_report_text, 24000) or '[No blood report text available]'}\n\n"
        "Past diet plan text:\n"
        f"{_truncate_text(past_diet_text, 18000) or '[No past diet text available]'}\n"
    )

    payload = generate_structured_output(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        schema=HEALTH_ANALYSIS_SCHEMA,
        schema_name="client_health_analysis",
        model=model,
        max_tokens=2200,
        temperature=0,
    )
    return _normalize_analysis_payload(payload)

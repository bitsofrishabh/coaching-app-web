from __future__ import annotations

from typing import Any, Dict, Optional


def _to_number(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def get_healthy_target_weight(height_cm: Any) -> Optional[float]:
    height = _to_number(height_cm)
    if not height:
        return None
    height_m = height / 100
    target_bmi = (18.5 + 24.9) / 2
    return target_bmi * height_m * height_m


def get_current_weight(client: Dict[str, Any]) -> Optional[float]:
    return _to_number(client.get("current_weight_kg")) or _to_number(client.get("initial_weight_kg"))


def calculate_maintenance_calories(client: Dict[str, Any]) -> Optional[int]:
    # Keep this aligned with the frontend helper until we introduce a
    # deterministic nutrition engine. Use healthy-target weight when possible,
    # otherwise current weight, multiplied by 24 kcal/kg/day.
    target_weight = get_healthy_target_weight(client.get("height_cm"))
    if target_weight:
        return round(target_weight * 24)

    current_weight = get_current_weight(client)
    if not current_weight:
        return None
    return round(current_weight * 24)


def get_recommended_daily_deficit(client: Dict[str, Any]) -> int:
    current_weight = get_current_weight(client)
    goal_weight = _to_number(client.get("goal_weight_kg"))
    if current_weight and goal_weight:
        if goal_weight < current_weight:
            difference = current_weight - goal_weight
            if difference >= 8:
                return 500
            if difference >= 3:
                return 400
            return 250
        if goal_weight > current_weight:
            return 0

    return 300


def get_target_daily_calories(client: Dict[str, Any]) -> Optional[int]:
    maintenance = calculate_maintenance_calories(client)
    if maintenance is None:
        return None
    return max(maintenance - get_recommended_daily_deficit(client), 1200)


def get_estimated_protein_target_g(client: Dict[str, Any]) -> Optional[float]:
    base_weight = (
        _to_number(client.get("goal_weight_kg"))
        or _to_number(client.get("current_weight_kg"))
        or _to_number(client.get("initial_weight_kg"))
    )
    if not base_weight:
        return None
    return round(base_weight * 1.6, 1)

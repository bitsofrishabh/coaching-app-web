import unittest

from backend.app.core.nutrition import (
    calculate_maintenance_calories,
    get_estimated_protein_target_g,
    get_healthy_target_weight,
    get_recommended_daily_deficit,
    get_target_daily_calories,
)


class NutritionTests(unittest.TestCase):
    def test_healthy_target_weight_uses_midpoint_bmi(self):
        self.assertAlmostEqual(get_healthy_target_weight(170), 62.713, places=3)

    def test_maintenance_prefers_height_based_weight(self):
        self.assertEqual(calculate_maintenance_calories({"height_cm": 170, "current_weight_kg": 90}), 1505)

    def test_maintenance_falls_back_to_current_weight(self):
        self.assertEqual(calculate_maintenance_calories({"current_weight_kg": 72}), 1728)

    def test_weight_loss_deficit_scales_with_goal_gap(self):
        self.assertEqual(get_recommended_daily_deficit({"current_weight_kg": 80, "goal_weight_kg": 70}), 500)
        self.assertEqual(get_recommended_daily_deficit({"current_weight_kg": 80, "goal_weight_kg": 76}), 400)
        self.assertEqual(get_recommended_daily_deficit({"current_weight_kg": 80, "goal_weight_kg": 79}), 250)

    def test_target_calories_has_a_safe_floor(self):
        self.assertEqual(get_target_daily_calories({"current_weight_kg": 40, "goal_weight_kg": 35}), 1200)

    def test_protein_target_prefers_goal_weight(self):
        self.assertEqual(get_estimated_protein_target_g({"current_weight_kg": 80, "goal_weight_kg": 65}), 104.0)


if __name__ == "__main__":
    unittest.main()

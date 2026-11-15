"""Regresiones del MVP: peligro sostenido, objetivos versionados y radio con coste."""
import unittest
from datetime import UTC, datetime

from mission_api.engine import evaluate, new_mission, transition, view
from mission_api.models import Command, CreateMission, MissionState
from mission_api.rules import MARS

NOW = datetime(2026, 11, 15, tzinfo=UTC)


def step(s, action=None):
    return transition(s, Command(type="action" if action else "advance", action_id=action,
                                 expected_version=s.version), NOW)


def lunar_plan(protected, version=None):
    s = new_mission("lunar", CreateMission(seed=42), "bundle", NOW, rules_version=version)
    while s.status == "active":
        actions = []
        if s.turn == 0:
            actions += ["explore", "explore"]
        if s.systems.water_leak_active:
            actions += ["repair_water_loop"]
        if protected and s.turn == 5:
            actions += ["enter_shelter"]
        if protected and s.turn == 6:
            actions += ["leave_shelter"]
        if s.systems.solar_integrity_pct < 100:
            actions += ["repair_solar_panels"]
        for action in actions:
            s = step(s, action).mission.state
        s = step(s).mission.state
    return s


class MvpTests(unittest.TestCase):
    def mars(self):
        return new_mission("mars", CreateMission(scenario_id=MARS), "bundle", NOW)

    def test_warning_survives_the_peak_and_shelter_still_changes_next_turn(self):
        s = self.mars()
        for _ in range(4):
            s = step(s).mission.state
        self.assertTrue(view(s).planning.shelter_recommended)
        self.assertTrue(any("sigue elevada" in a for a in view(s).alerts))
        exposed = step(s).mission.state
        protected = step(step(s, "enter_shelter").mission.state).mission.state
        self.assertGreater(exposed.exposure_risk_index - s.exposure_risk_index,
                           9 * (protected.exposure_risk_index - s.exposure_risk_index))

    def test_no_next_turn_warning_after_completion(self):
        s = self.mars()
        s.turn, s.status = 12, "completed"
        self.assertFalse(view(s).planning.shelter_recommended)

    def test_lunar_protection_is_a_goal_even_when_health_is_full(self):
        outside, inside = lunar_plan(False), lunar_plan(True)
        self.assertEqual((outside.crew_health_pct, inside.crew_health_pct), (100, 100))
        self.assertEqual(evaluate(outside).outcome, "partial")
        self.assertFalse(evaluate(outside).objectives["radiation_protection"])
        self.assertEqual(evaluate(inside).outcome, "success")
        self.assertGreater(evaluate(inside).score, evaluate(outside).score)

    def test_v11_keeps_its_original_outcome_and_score(self):
        old = lunar_plan(False, "lunar-1.1.0")
        self.assertEqual((evaluate(old).outcome, evaluate(old).score), ("success", 97))
        self.assertNotIn("radiation_protection", evaluate(old).objectives)
        self.assertIsNone(old.earth_guidance)

    def test_radio_report_is_delayed_specific_and_survives_serialization(self):
        s = step(self.mars(), "contact_earth").mission.state
        self.assertIsNone(s.earth_guidance)
        self.assertEqual(view(s).planning.pending_reply_minutes, 40)
        result = step(s)
        s = result.mission.state
        report = s.earth_guidance
        self.assertEqual((report.received_turn, report.valid_until_turn), (1, 3))
        self.assertEqual(report.next_turn_dose_rate_ugy_h, s.radiation_profile_ugy_h[1])
        self.assertEqual(report.suggested_eva_turn, 1)
        self.assertEqual((report.dust_start_turn, report.dust_end_turn), (6, 9))
        self.assertEqual(s.science_points, 0)
        self.assertEqual(MissionState.model_validate_json(s.model_dump_json()).earth_guidance, report)
        self.assertEqual(next(e for e in result.events if e.type == "earth_reply").payload["planning_report"], report.model_dump())

    def test_last_action_can_buy_a_report_or_protection_but_not_both(self):
        s = self.mars()
        for _ in range(2):
            s = step(s).mission.state
        s = step(s, "explore").mission.state
        waiting = step(s, "contact_earth").mission.state
        sheltered = step(s, "enter_shelter").mission.state
        self.assertEqual((waiting.actions_used, sheltered.actions_used), (2, 2))
        waiting, sheltered = step(waiting).mission.state, step(sheltered).mission.state
        self.assertGreater(waiting.exposure_risk_index, sheltered.exposure_risk_index)
        self.assertEqual(waiting.science_points - sheltered.science_points, 6)
        self.assertLess(waiting.resources.energy_kwh, sheltered.resources.energy_kwh)
        self.assertIsNotNone(waiting.earth_guidance)
        self.assertIsNone(sheltered.earth_guidance)

    def test_no_low_radiation_window_is_invented_during_the_peak(self):
        s = self.mars()
        for _ in range(2):
            s = step(s).mission.state
        s = step(step(s, "contact_earth").mission.state).mission.state
        self.assertEqual(s.earth_guidance.advice_code, "shelter_now")
        self.assertIsNone(s.earth_guidance.suggested_eva_turn)

    def test_saved_v11_mars_does_not_acquire_new_radio_rules(self):
        s = new_mission("old-mars", CreateMission(scenario_id=MARS), "bundle", NOW, rules_version="mars-1.1.0")
        s = step(step(s, "contact_earth").mission.state).mission.state
        self.assertIsNone(s.earth_guidance)


if __name__ == "__main__":
    unittest.main()

"""Comportamientos que faltaban en la auditoría: decisiones, archivo y compatibilidad."""
import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from mission_api.engine import evaluate, new_mission, transition, view
from mission_api.models import Command, CreateMission, MissionState, ScienceBundle
from mission_api.rules import MARS, rules_for_state
from mission_api.storage import Store
from mission_api.scientific_profile import derive_mars_radiation
from mission_api.errors import MissionError

NOW = datetime(2026, 11, 15, tzinfo=UTC)


def step(s, action=None):
    return transition(s, Command(type="action" if action else "advance", action_id=action, expected_version=s.version), NOW)


class DecisionRegressionTests(unittest.TestCase):
    def mars(self, **kwargs):
        return new_mission("mars", CreateMission(scenario_id=MARS, **kwargs), "bundle", NOW)

    def test_empty_and_repeated_reports_do_not_create_science(self):
        s = self.mars()
        s = step(s, "contact_earth").mission.state
        self.assertEqual(view(s).planning.pending_reply_minutes, 40)
        s = step(s).mission.state
        self.assertEqual(s.science_points, 0)
        s = step(s, "explore").mission.state
        s = step(s, "contact_earth").mission.state
        s = step(s).mission.state
        self.assertEqual((s.science_points, s.reported_data_points), (18, 12))
        s = step(s, "contact_earth").mission.state
        s = step(s).mission.state
        self.assertEqual((s.science_points, s.reported_data_points), (18, 12))

    def test_research_done_after_sending_stays_unsent(self):
        s = step(self.mars(), "explore").mission.state
        s = step(s, "contact_earth").mission.state
        s = step(s).mission.state
        s = step(s, "explore").mission.state
        self.assertEqual((s.reported_data_points, s.unreported_data_points), (12, 12))

    def test_shelter_radio_shortcut_cannot_achieve_success(self):
        for difficulty in ("cadet", "commander"):
            s = self.mars(difficulty=difficulty)
            s = step(s, "enter_shelter").mission.state
            s = step(s, "toggle_greenhouse").mission.state
            while s.status == "active":
                if 1 <= s.turn <= 5:
                    s = step(s, "contact_earth").mission.state
                s = step(s).mission.state
            self.assertEqual(s.science_points, 0)
            self.assertNotEqual(evaluate(s).outcome, "success")

    def test_crops_have_a_measurable_next_day_reserve_objective(self):
        s = self.mars()
        s.turn, s.status, s.science_points, s.reported_data_points = 12, "completed", 30, 12
        s.resources.food_kg = 0.79
        self.assertFalse(evaluate(s).objectives["food_reserve"])
        self.assertEqual(evaluate(s).outcome, "partial")
        s.resources.food_kg = 0.8
        self.assertEqual(evaluate(s).outcome, "success")

    def test_training_changes_only_simulated_incidents_reproducibly(self):
        schedules = set()
        for seed in range(15):
            a, b = self.mars(practice_mode="training", seed=seed), self.mars(practice_mode="training", seed=seed)
            self.assertEqual(rules_for_state(a), rules_for_state(b))
            self.assertEqual(a.radiation_profile_ugy_h, self.mars().radiation_profile_ugy_h)
            schedules.add(rules_for_state(a).dust_storm_turns)
        self.assertGreater(len(schedules), 1)

    def test_lunar_solar_event_reports_electrical_protection(self):
        s = new_mission("lunar", CreateMission(), "bundle", NOW)
        for _ in range(6):
            result = step(s)
            s = result.mission.state
        self.assertEqual(result.events[-1].payload["power_protection_factor"], 0.3)
        self.assertAlmostEqual(result.events[-1].payload["generated_kwh"], 3.3)

    def test_legacy_mars_keeps_old_reward_and_numbers(self):
        old = new_mission("old", CreateMission(scenario_id=MARS), "bundle", NOW, rules_version="mars-1.0.0")
        old = step(old, "contact_earth").mission.state
        old = step(old).mission.state
        self.assertEqual(old.science_points, 6)
        self.assertEqual(old.rules_version, "mars-1.0.0")
        self.assertNotIn("food_reserve", evaluate(old).objectives)
        self.assertEqual(MissionState.model_validate_json(old.model_dump_json()), old)
        payload = old.model_dump(mode="json")
        for key in ("practice_mode", "unreported_data_points", "reported_data_points", "radiation_profile_ugy_h", "radiation_profile_source_hash"):
            payload.pop(key)
        for key in ("earth_message_data_points", "earth_reply_due_minutes"):
            payload["systems"].pop(key)
        restored = MissionState.model_validate_json(json.dumps(payload))
        self.assertEqual(step(step(restored, "contact_earth").mission.state).mission.state.science_points, 12)

    def test_frozen_profile_used_after_save_and_restart(self):
        profile = [float(i) for i in range(12)]
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "missions.db")
            session = store.create_session(NOW, 168)
            bundle = ScienceBundle(id="frozen", requested_mode="snapshot", captured_at=NOW, sources=[],
                model_derivations={"mars_radiation": {"values": profile, "normalized_records_sha256": "a" * 64}})
            result = store.create_mission(session.session_id, CreateMission(scenario_id=MARS), bundle, "create", "digest", NOW)
            old = result.mission.state
            restarted = store.restart(session.session_id, old.id, old.version, "restart", "digest", NOW).mission.state
            self.assertEqual(restarted.radiation_profile_ugy_h, profile)
            self.assertEqual(restarted.radiation_profile_source_hash, "normalized_sha256:" + "a" * 64)
            reloaded = Store(Path(directory) / "missions.db").get(session.session_id, restarted.id, NOW)
            self.assertEqual(step(reloaded).events[-1].payload["dose_rate_ugy_h"], 0)

    def test_comparison_records_different_decisions_without_changing_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "missions.db")
            session = store.create_session(NOW, 168)
            bundle = ScienceBundle(id="same", requested_mode="snapshot", captured_at=NOW, sources=[])
            a = store.create_mission(session.session_id, CreateMission(), bundle, "create", "d", NOW).mission.state
            a = store.command(session.session_id, a.id, Command(type="abort", expected_version=a.version), "stop", "d", NOW).mission.state
            b = store.restart(session.session_id, a.id, a.version, "restart", "d", NOW).mission.state
            b = store.command(session.session_id, b.id, Command(type="action", action_id="explore", expected_version=b.version), "explore", "d", NOW).mission.state
            store.command(session.session_id, b.id, Command(type="abort", expected_version=b.version), "stop-b", "d", NOW)
            comparison = store.evaluation(session.session_id, b.id, NOW).comparison
            self.assertEqual(comparison.previous_mission_id, a.id)
            self.assertEqual(comparison.decisions[0].current, ["explore"])
            self.assertEqual(store.get(session.session_id, a.id, NOW).science_points, 0)

    def test_profile_refuses_missing_bins_and_wrong_units(self):
        for records in ([], [{"observed_at": "2024-05-20T00:00:00Z", "source_id": "one", "spacecraft": "Curiosity", "celestial_body": "Mars", "measurements": [{"quantity": "absorbed_dose_rate", "value": 3, "unit": "uSv/h"}]}]):
            with self.assertRaises(MissionError):
                derive_mars_radiation(records, [])


    def test_both_difficulties_and_training_seeds_have_a_viable_resource_plan(self):
        for scenario in ("lunar-outpost-v1", MARS):
            for difficulty in ("cadet", "commander"):
                for mode in ("historical", "training"):
                    for seed in (1, 42, 777):
                        s = new_mission("balanced", CreateMission(scenario_id=scenario, difficulty=difficulty,
                            practice_mode=mode, seed=seed), "bundle", NOW)
                        rules = rules_for_state(s)
                        while s.status == "active":
                            actions = []
                            if scenario == MARS:
                                if s.turn == 0: actions = ["explore", "contact_earth"]
                                if s.turn == 2: actions.append("enter_shelter")
                                if s.turn == 7: actions += ["leave_shelter", "explore"]
                                if s.turn == rules.dust_storm_turns[0] - 1: actions.append("toggle_oxygen_generator")
                                if s.turn == rules.dust_storm_turns[-1] + 1: actions += ["repair_solar_panels", "toggle_oxygen_generator"]
                            else:
                                if s.turn == 0: actions = ["explore", "explore"]
                                if s.turn == 1 and difficulty == "commander": actions.append("activate_water_reserve")
                                if s.turn == rules.water_leak_turn: actions.append("repair_water_loop")
                                if s.turn == 5: actions.append("enter_shelter")
                                if s.turn == 6: actions.append("leave_shelter")
                                if s.turn == rules.panel_damage_turn: actions.append("repair_solar_panels")
                            for action in actions:
                                s = step(s, action).mission.state
                            s = step(s).mission.state
                        self.assertEqual(evaluate(s).outcome, "success", (scenario, difficulty, mode, seed, evaluate(s)))

import unittest
from datetime import UTC, datetime

from mission_api.engine import evaluate, new_mission, transition
from mission_api.errors import MissionError
from mission_api.models import Command, CreateMission, MissionState

NOW = datetime(2026, 11, 14, tzinfo=UTC)


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.state = new_mission("test-mission", CreateMission(), "test-bundle", NOW)

    def step(self, kind="advance", action=None):
        result = transition(self.state, Command(type=kind, action_id=action, expected_version=self.state.version), NOW)
        self.state = result.mission.state
        return result

    def test_energy_and_oxygen_balance_for_first_turn(self):
        result = self.step()
        self.assertAlmostEqual(self.state.resources.energy_kwh, 33.8)
        self.assertAlmostEqual(self.state.resources.oxygen_kg, 2.92)
        self.assertAlmostEqual(self.state.resources.water_l, 16.95)
        self.assertAlmostEqual(self.state.resources.food_kg, 3.07)
        self.assertEqual(result.events[-1].payload["generated_kwh"], 11)

    def test_decision_does_not_modify_original(self):
        before = self.state.model_dump()
        result = transition(self.state, Command(type="action", action_id="explore", expected_version=1), NOW)
        self.assertEqual(self.state.model_dump(), before)
        self.assertEqual(result.mission.state.science_points, 12)

    def test_action_limit_and_reset(self):
        self.step("action", "explore")
        self.step("action", "explore")
        with self.assertRaises(MissionError):
            self.step("action", "explore")
        self.step()
        self.assertEqual(self.state.actions_used, 0)

    def test_cannot_afford_action_does_not_spend(self):
        self.state.resources.energy_kwh = 1
        with self.assertRaises(MissionError):
            self.step("action", "explore")
        self.assertEqual(self.state.resources.energy_kwh, 1)
        self.assertEqual(self.state.actions_used, 0)

    def test_finite_reserve_preserves_mass(self):
        total = self.state.resources.oxygen_kg + self.state.resources.reserve_oxygen_kg
        self.step("action", "activate_oxygen_reserve")
        self.step("action", "activate_oxygen_reserve")
        self.assertAlmostEqual(self.state.resources.oxygen_kg + self.state.resources.reserve_oxygen_kg, total)
        self.assertEqual(self.state.resources.reserve_oxygen_kg, 0)
        self.step()
        with self.assertRaises(MissionError):
            self.step("action", "activate_oxygen_reserve")

    def test_reserve_only_transfers_free_capacity(self):
        self.state.resources.water_l = 29
        self.step("action", "activate_water_reserve")
        self.assertEqual(self.state.resources.water_l, 30)
        self.assertEqual(self.state.resources.reserve_water_l, 5)

    def test_oxygen_generator_requires_water(self):
        self.state.resources.water_l = 0
        self.state.resources.energy_kwh = 0
        self.state.systems.solar_integrity_pct = 0
        self.step()
        self.assertAlmostEqual(self.state.resources.oxygen_kg, 2.52)
        self.assertEqual(self.state.resources.energy_kwh, 0)

    def test_no_power_does_not_produce_resources(self):
        self.state.resources.energy_kwh = 0
        self.state.systems.solar_integrity_pct = 0
        self.step()
        self.assertEqual(self.state.resources.food_kg, 3.0)
        self.assertLess(self.state.crew_health_pct, 100)

    def test_power_allocation_prioritizes_habitat(self):
        self.state.resources.energy_kwh = 5
        self.state.systems.solar_integrity_pct = 0
        result = self.step()
        fractions = result.events[-1].payload["power_fractions"]
        self.assertEqual(fractions["habitat"], 1)
        self.assertAlmostEqual(fractions["oxygen"], 1 / 2.4)
        self.assertEqual(fractions["greenhouse"], 0)

    def test_water_leak_and_repair(self):
        self.step()
        self.step()
        self.assertTrue(self.state.systems.water_leak_active)
        self.step("action", "repair_water_loop")
        self.assertFalse(self.state.systems.water_leak_active)
        self.assertEqual(self.state.resources.spare_parts, 4)

    def test_shelter_reduces_risk_and_blocks_exterior_work(self):
        for _ in range(5):
            self.step()
        outside = transition(self.state, Command(type="advance", expected_version=self.state.version), NOW).mission.state
        self.step("action", "enter_shelter")
        with self.assertRaises(MissionError):
            self.step("action", "explore")
        self.step()
        self.assertLess(self.state.exposure_risk_index, outside.exposure_risk_index / 4)

    def test_panel_damage_then_repair_changes_generation(self):
        for _ in range(8):
            self.step()
        self.assertEqual(self.state.systems.solar_integrity_pct, 50)
        self.step("action", "repair_solar_panels")
        result = self.step()
        self.assertEqual(result.events[-1].payload["generated_kwh"], 11)

    def test_paused_mission_does_not_advance(self):
        self.step("pause")
        with self.assertRaises(MissionError):
            self.step()
        self.assertEqual(self.state.turn, 0)
        self.step("resume")
        self.step()
        self.assertEqual(self.state.turn, 1)

    def test_stale_version_is_rejected(self):
        self.step()
        with self.assertRaises(MissionError) as result:
            transition(self.state, Command(type="advance", expected_version=1), NOW)
        self.assertEqual(result.exception.code, "VERSION_CONFLICT")

    def test_abort_is_terminal(self):
        self.step("abort")
        with self.assertRaises(MissionError):
            self.step()
        self.assertEqual(evaluate(self.state).outcome, "aborted")

    def test_same_seed_and_decisions_are_reproducible(self):
        config = CreateMission(seed=831)
        a = new_mission("same", config, "same-bundle", NOW)
        b = new_mission("same", config, "same-bundle", NOW)
        for _ in range(6):
            a = transition(a, Command(type="advance", expected_version=a.version), NOW).mission.state
            b = transition(b, Command(type="advance", expected_version=b.version), NOW).mission.state
        self.assertEqual(a, b)

    def test_command_sequence_can_complete_successfully(self):
        self.step("action", "explore")
        self.step("action", "explore")
        for _ in range(12):
            if self.state.turn == 2:
                self.step("action", "repair_water_loop")
            if self.state.turn == 5:
                self.step("action", "enter_shelter")
            if self.state.turn == 6:
                self.step("action", "leave_shelter")
            if self.state.turn == 8:
                self.step("action", "repair_solar_panels")
            self.step()
        result = evaluate(self.state)
        self.assertEqual(self.state.status, "completed")
        self.assertEqual(result.outcome, "success")
        self.assertTrue(result.final)
        self.assertEqual(self.state.elapsed_hours, 24)
        with self.assertRaises(MissionError):
            self.step()

    def test_loss_path_and_nonnegative_invariants(self):
        self.state.resources.oxygen_kg = 0
        self.state.resources.water_l = 0
        self.state.resources.food_kg = 0
        self.state.resources.energy_kwh = 0
        self.state.systems.solar_integrity_pct = 0
        self.step()
        self.assertEqual(self.state.status, "failed")
        for value in self.state.resources.model_dump().values():
            self.assertGreaterEqual(value, 0)

    def test_full_battery_curtails_generation(self):
        self.state.resources.energy_kwh = 50
        result = self.step()
        self.assertEqual(self.state.resources.energy_kwh, 50)
        self.assertAlmostEqual(result.events[-1].payload["curtailed_kwh"], 1.8)

    def test_snapshot_round_trip_preserves_state(self):
        self.step()
        self.assertEqual(MissionState.model_validate_json(self.state.model_dump_json()), self.state)


class MarsEngineTests(unittest.TestCase):
    def setUp(self):
        self.state = new_mission("mars-mission", CreateMission(scenario_id="mars-outpost-v1"), "test-bundle", NOW)

    def step(self, kind="advance", action=None):
        result = transition(self.state, Command(type=kind, action_id=action, expected_version=self.state.version), NOW)
        self.state = result.mission.state
        return result

    def types(self, result):
        return [event.type for event in result.events]

    def test_identity_actions_and_first_turn(self):
        self.assertEqual((self.state.scenario_id, self.state.rules_version), ("mars-outpost-v1", "mars-1.1.0"))
        ids = [option.id for option in transition(self.state, Command(type="pause", expected_version=1), NOW).mission.available_actions]
        self.assertIn("contact_earth", ids)
        self.assertNotIn("repair_water_loop", ids)
        result = self.step()
        payload = result.events[-1].payload
        # 12.8 kW x 0.43 x 2 h = 11.008 kWh; demanda 2 + 2 + 0.4 + 1 = 5.4 kW.
        self.assertAlmostEqual(payload["generated_kwh"], 11.008)
        self.assertAlmostEqual(self.state.resources.energy_kwh, 32 + 11.008 - 10.8)
        # El generador marciano no gasta agua: 18 + 0.6 recuperados - 1.2 de tripulación.
        self.assertAlmostEqual(self.state.resources.water_l, 17.4)
        self.assertAlmostEqual(self.state.resources.oxygen_kg, 2.92)
        self.assertEqual(payload["dose_rate_ugy_h"], 3.81)
        self.assertAlmostEqual(self.state.exposure_risk_index, 3.81 * 0.13, places=4)

    def test_lunar_mission_rejects_mars_action(self):
        lunar = new_mission("lunar", CreateMission(), "test-bundle", NOW)
        with self.assertRaises(MissionError):
            transition(lunar, Command(type="action", action_id="contact_earth", expected_version=1), NOW)

    def test_radiation_follows_real_profile_and_shelter_reduces_it(self):
        exposed = new_mission("exposed", CreateMission(scenario_id="mars-outpost-v1"), "b", NOW)
        for _ in range(4):
            exposed = transition(exposed, Command(type="advance", expected_version=exposed.version), NOW).mission.state
        self.step()
        warning = self.step()
        self.assertIn("solar_warning", self.types(warning))
        self.assertTrue(any("eyección solar real" in alert for alert in warning.mission.alerts))
        self.step("action", "enter_shelter")
        incident = self.step()
        self.assertIn("solar_incident", self.types(incident))
        self.assertEqual(incident.events[-1].payload["dose_rate_ugy_h"], 60.05)
        self.step()
        self.assertAlmostEqual(exposed.exposure_risk_index, (3.81 + 3.93 + 60.05 + 246.39) * 0.13, places=3)
        self.assertAlmostEqual(self.state.exposure_risk_index, (3.81 + 3.93) * 0.13 + (60.05 + 246.39) * 0.013, places=3)

    def test_contact_earth_reply_arrives_next_turn(self):
        self.step("action", "contact_earth")
        self.assertTrue(self.state.systems.earth_message_pending)
        with self.assertRaises(MissionError):
            self.step("action", "contact_earth")
        result = self.step()
        self.assertIn("earth_reply", self.types(result))
        self.assertEqual(self.state.science_points, 0)  # Una consulta sin datos no acredita ciencia.
        self.assertFalse(self.state.systems.earth_message_pending)

    def test_dust_storm_cuts_power_then_leaves_dust(self):
        for _ in range(5):
            result = self.step()
        self.assertIn("dust_warning", self.types(result))
        result = self.step()
        self.assertIn("dust_storm", self.types(result))
        self.assertTrue(self.state.systems.dust_storm_active)
        self.assertAlmostEqual(result.events[-1].payload["generated_kwh"], 11.008 * 0.2, places=4)
        self.step()
        self.step()
        self.step()
        result = self.step()
        self.assertIn("dust_cleared", self.types(result))
        self.assertFalse(self.state.systems.dust_storm_active)
        self.assertEqual(self.state.systems.solar_integrity_pct, 60)
        spare = self.state.resources.spare_parts
        self.step("action", "repair_solar_panels")
        self.assertEqual(self.state.systems.solar_integrity_pct, 100)
        self.assertEqual(self.state.resources.spare_parts, spare)

    def test_good_plan_succeeds_and_passive_play_does_not(self):
        plan = {0: ["explore", "contact_earth"], 2: ["enter_shelter"], 5: ["toggle_greenhouse", "toggle_oxygen_generator"],
                7: ["leave_shelter", "explore"], 10: ["repair_solar_panels", "toggle_oxygen_generator"], 11: ["toggle_greenhouse"]}
        for turn in range(12):
            for action in plan.get(turn, []):
                self.step("action", action)
            self.step()
        report = evaluate(self.state)
        self.assertEqual(report.outcome, "success", report)
        self.assertGreaterEqual(self.state.science_points, 30)
        passive = new_mission("passive", CreateMission(scenario_id="mars-outpost-v1", difficulty="commander"), "b", NOW)
        while passive.status == "active":
            passive = transition(passive, Command(type="advance", expected_version=passive.version), NOW).mission.state
        self.assertNotEqual(evaluate(passive).outcome, "success")


if __name__ == "__main__":
    unittest.main()

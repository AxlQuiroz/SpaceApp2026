"""El perfil de radiación del escenario marciano debe salir de la captura real de MSL-RAD."""
import unittest
from collections import defaultdict
from datetime import UTC, datetime

from mission_api.rules import MARS_RAD_PROFILE_UGY_H, MARS_RULES
from resource_api.models import RadiationQuery
from resource_api.providers import normalize, radiation_spec
from resource_api.snapshot_store import SnapshotStore


class MarsProfileTests(unittest.TestCase):
    def test_profile_matches_two_hour_means_of_the_snapshot(self):
        spec = radiation_spec(RadiationQuery(start=datetime(2024, 5, 20, tzinfo=UTC), end=datetime(2024, 5, 21, tzinfo=UTC), instrument="MSL-RAD"))
        raw, entry = SnapshotStore().read(spec.resource, spec.query)
        self.assertEqual(entry["id"], "radlab-msl-rad-2024-05-20")
        records, _ = normalize(spec, raw)
        blocks = defaultdict(list)
        for record in records:
            self.assertEqual(record["celestial_body"], "Mars")
            hour = datetime.fromisoformat(record["observed_at"].replace("Z", "+00:00")).hour
            for measurement in record["measurements"]:
                if measurement["quantity"] == "absorbed_dose_rate":
                    blocks[hour // 2].append(measurement["value"])
        means = tuple(round(sum(values) / len(values), 2) for _, values in sorted(blocks.items()))
        self.assertEqual(means, MARS_RAD_PROFILE_UGY_H)
        self.assertEqual(len(MARS_RULES.radiation_profile_ugy_h), MARS_RULES.turns)

    def test_hyphenated_instrument_is_selected_by_spacecraft(self):
        spec = radiation_spec(RadiationQuery(start=datetime(2024, 5, 20, tzinfo=UTC), end=datetime(2024, 5, 21, tzinfo=UTC), instrument="MSL-RAD"))
        self.assertIn("spacecraft='Curiosity'", spec.params["query"])
        self.assertNotIn("MSL-RAD", spec.params["query"])
        self.assertEqual(spec.query["instrument"], "MSL-RAD")


if __name__ == "__main__":
    unittest.main()

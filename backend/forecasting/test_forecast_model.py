import math
import unittest
from datetime import date, timedelta

from forecast_model import run_forecast


def reservation_history(as_of="2026-11-01", days=120):
    anchor = date.fromisoformat(as_of)
    reservations = []
    for offset in range(days, 0, -1):
        day = anchor - timedelta(days=offset)
        reservations_per_day = 1 + int(day.weekday() in (4, 5, 6))
        for booking in range(reservations_per_day):
            hour = (12, 17, 18, 19, 20, 21)[
                (day.toordinal() + booking) % 6
            ]
            reservations.append(
                {
                    "id": f"fixture-{day.isoformat()}-{booking}",
                    "reservation_date": day.isoformat(),
                    "reservation_time": f"{hour:02d}:30:00",
                    "num_guests": 2 + (day.toordinal() + booking) % 7,
                }
            )
    return reservations


class ForecastModelTests(unittest.TestCase):
    def test_insufficient_history_returns_readiness_without_predictions(self):
        result = run_forecast(
            {
                "as_of": "2026-11-01",
                "data_source": "actual",
                "reservations": [
                    {
                        "reservation_date": "2026-10-25",
                        "reservation_time": "18:00:00",
                        "num_guests": 2,
                    }
                ],
            }
        )

        self.assertEqual(result["status"], "insufficient_data")
        self.assertNotIn("weeklyDemand", result)

    def test_model_generates_week_forecasts_and_multi_horizon_metrics(self):
        result = run_forecast(
            {
                "as_of": "2026-11-01",
                "data_source": "test_fixture",
                "reservations": reservation_history(),
            }
        )

        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["dataSource"], "test_fixture")
        self.assertEqual(len(result["weeklyDemand"]), 7)
        self.assertEqual(len(result["todayHourlyDemand"]), 24)
        self.assertEqual(
            result["evaluation"]["method"], "rolling_origin"
        )
        self.assertEqual(result["evaluation"]["horizonDays"], 7)
        self.assertGreaterEqual(
            result["evaluation"]["originCount"], 3
        )
        self.assertEqual(
            set(result["evaluation"]["metrics"]),
            {"reservations", "guests", "hourly"},
        )
        for metrics in result["evaluation"]["metrics"].values():
            self.assertGreater(metrics["testSamples"], 0)
            self.assertGreaterEqual(metrics["mae"], 0)
            self.assertGreaterEqual(metrics["rmse"], 0)
            self.assertGreaterEqual(metrics["baselineMae"], 0)
            self.assertGreaterEqual(metrics["baselineRmse"], 0)
            self.assertEqual(len(metrics["byHorizon"]), 7)
            for expected_horizon, horizon in enumerate(
                metrics["byHorizon"], start=1
            ):
                self.assertEqual(horizon["horizonDays"], expected_horizon)
                for key in ("mae", "rmse", "baselineMae", "baselineRmse"):
                    self.assertTrue(math.isfinite(horizon[key]))

    def test_duplicate_ids_invalid_guest_counts_and_future_records_are_excluded(self):
        records = reservation_history()
        original_count = len(records)
        duplicate = dict(records[0])
        invalid_guests = {
            "id": "invalid-guests",
            "reservation_date": "2026-10-31",
            "reservation_time": "18:00:00",
            "num_guests": 0,
        }
        invalid_date = {
            "id": "invalid-date",
            "reservation_date": "2026-99-99",
            "reservation_time": "18:00:00",
            "num_guests": 2,
        }
        future = {
            "id": "future",
            "reservation_date": "2026-11-02",
            "reservation_time": "18:00:00",
            "num_guests": 2,
        }
        result = run_forecast(
            {
                "as_of": "2026-11-01",
                "data_source": "test_fixture",
                "reservations": records
                + [duplicate, invalid_guests, invalid_date, future],
            }
        )

        self.assertEqual(result["status"], "ready")
        self.assertEqual(
            result["dataReadiness"]["reservationCount"], original_count
        )
        self.assertEqual(
            result["dataReadiness"]["duplicateRecordsIgnored"], 1
        )
        self.assertEqual(result["dataReadiness"]["invalidRecordsIgnored"], 2)
        self.assertEqual(result["weeklyDemand"][0]["date"], "2026-11-01")

    def test_new_valid_history_changes_training_input_and_forecast(self):
        records = reservation_history()
        original = run_forecast(
            {
                "as_of": "2026-11-01",
                "data_source": "test_fixture",
                "reservations": records,
            }
        )
        changed_records = records + [
            {
                "id": "new-historical-reservation",
                "reservation_date": "2026-10-31",
                "reservation_time": "19:00:00",
                "num_guests": 9,
            }
        ]
        changed = run_forecast(
            {
                "as_of": "2026-11-01",
                "data_source": "test_fixture",
                "reservations": changed_records,
            }
        )

        self.assertEqual(changed["status"], "ready")
        self.assertNotEqual(
            original["weeklyDemand"], changed["weeklyDemand"]
        )


if __name__ == "__main__":
    unittest.main()

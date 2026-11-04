import json
import math
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


MIN_RESERVATIONS = 30
MIN_BOOKING_DAYS = 14
MIN_CALENDAR_DAYS = 30
MIN_BACKTEST_ORIGINS = 3
MAX_BACKTEST_ORIGINS = 12
FORECAST_HORIZON_DAYS = 7
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def _parse_reservation(record):
    try:
        raw_date = str(record["reservation_date"])
        if len(raw_date) < 10:
            return None
        reservation_date = date.fromisoformat(raw_date[:10])
        raw_time = str(record["reservation_time"])
        reservation_time = time.fromisoformat(raw_time[:8])
        raw_guests = record["num_guests"]
        if isinstance(raw_guests, bool):
            return None
        if isinstance(raw_guests, int):
            guests = raw_guests
        elif isinstance(raw_guests, str) and raw_guests.strip().isdigit():
            guests = int(raw_guests.strip())
        else:
            return None
    except (KeyError, TypeError, ValueError):
        return None

    if guests < 1:
        return None

    return reservation_date, reservation_time.hour, guests, record.get("id")


def _date_features(day, index, counts, guests):
    prior_counts = counts[:index]
    prior_guests = guests[:index]
    weekday_counts = [
        counts[prior_index]
        for prior_index in range(index)
        if (day - timedelta(days=index - prior_index)).weekday() == day.weekday()
    ][-8:]
    day_of_year = day.timetuple().tm_yday

    return [
        day.weekday(),
        day.month,
        day.day,
        day_of_year,
        int(day.weekday() >= 5),
        math.sin(2 * math.pi * day_of_year / 365.25),
        math.cos(2 * math.pi * day_of_year / 365.25),
        index,
        float(np.mean(prior_counts[-7:])) if prior_counts else 0.0,
        float(np.mean(prior_counts[-28:])) if prior_counts else 0.0,
        float(np.mean(weekday_counts)) if weekday_counts else 0.0,
        float(np.mean(prior_guests[-7:])) if prior_guests else 0.0,
        float(np.mean(prior_guests[-28:])) if prior_guests else 0.0,
    ]


def _hour_features(day, hour, index, hourly_history):
    past_counts = [daily_counts[hour] for daily_counts in hourly_history[:index]]
    day_of_year = day.timetuple().tm_yday

    return [
        day.weekday(),
        day.month,
        day.day,
        day_of_year,
        int(day.weekday() >= 5),
        math.sin(2 * math.pi * day_of_year / 365.25),
        math.cos(2 * math.pi * day_of_year / 365.25),
        hour,
        float(np.mean(past_counts[-7:])) if past_counts else 0.0,
        float(np.mean(past_counts[-28:])) if past_counts else 0.0,
    ]


def _hour_label(hour):
    return datetime.combine(date.today(), time(hour=hour)).strftime("%I:%M %p").lstrip("0")


def _build_history(reservations, first_date, last_date):
    daily_counts = defaultdict(int)
    daily_guests = defaultdict(int)
    hourly_counts = defaultdict(lambda: [0] * 24)

    for reservation_date, hour, guests, _ in reservations:
        daily_counts[reservation_date] += 1
        daily_guests[reservation_date] += guests
        hourly_counts[reservation_date][hour] += 1

    history_dates = [
        first_date + timedelta(days=offset)
        for offset in range((last_date - first_date).days + 1)
    ]
    count_values = [daily_counts[day] for day in history_dates]
    guest_values = [daily_guests[day] for day in history_dates]
    hourly_history = [hourly_counts[day] for day in history_dates]
    return history_dates, count_values, guest_values, hourly_history

def _fit_and_predict(history_dates, counts, guests, hourly_history, origin, horizon):
    training_dates = history_dates[:origin]
    training_counts = counts[:origin]
    training_guests = guests[:origin]
    training_hours = hourly_history[:origin]

    daily_features = [
        _date_features(day, index, counts, guests)
        for index, day in enumerate(training_dates)
    ]
    daily_model = _new_model()
    daily_model.fit(daily_features, training_counts)
    guests_model = _new_model()
    guests_model.fit(daily_features, training_guests)

    predicted_counts = list(training_counts)
    predicted_guests = list(training_guests)
    daily_predictions = []
    guest_predictions = []
    for day in history_dates[origin : origin + horizon]:
        feature = _date_features(
            day, len(predicted_counts), predicted_counts, predicted_guests
        )
        count_prediction = max(0.0, float(daily_model.predict([feature])[0]))
        guest_prediction = max(0.0, float(guests_model.predict([feature])[0]))
        daily_predictions.append(count_prediction)
        guest_predictions.append(guest_prediction)
        predicted_counts.append(count_prediction)
        predicted_guests.append(guest_prediction)

    hourly_features = [
        _hour_features(day, hour, index, training_hours)
        for index, day in enumerate(training_dates)
        for hour in range(24)
    ]
    hourly_targets = [
        daily_hours[hour]
        for daily_hours in training_hours
        for hour in range(24)
    ]
    hourly_model = _new_model()
    hourly_model.fit(hourly_features, hourly_targets)

    predicted_hours = list(training_hours)
    hourly_predictions = []
    for day in history_dates[origin : origin + horizon]:
        index = len(predicted_hours)
        features = [
            _hour_features(day, hour, index, predicted_hours)
            for hour in range(24)
        ]
        daily_prediction = np.maximum(hourly_model.predict(features), 0).tolist()
        hourly_predictions.append(daily_prediction)
        predicted_hours.append(daily_prediction)

    return daily_predictions, guest_predictions, hourly_predictions


def _seasonal_baseline(day, history_dates, values, origin):
    matching = [
        value
        for prior_day, value in zip(history_dates[:origin], values[:origin])
        if prior_day.weekday() == day.weekday()
    ][-4:]
    fallback = values[max(0, origin - 7) : origin]
    return float(np.mean(matching or fallback)) if matching or fallback else 0.0


def _metric_summary(actual, predicted, baseline):
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 3),
        "rmse": round(
            math.sqrt(mean_squared_error(actual, predicted)), 3
        ),
        "baselineMae": round(float(mean_absolute_error(actual, baseline)), 3),
        "baselineRmse": round(
            math.sqrt(mean_squared_error(actual, baseline)), 3
        ),
        "testSamples": len(actual),
    }


def _rolling_origin_backtest(history_dates, counts, guests, hourly_history):
    origins = [
        origin
        for origin in range(
            MIN_CALENDAR_DAYS,
            len(history_dates) - FORECAST_HORIZON_DAYS + 1,
        )
        if sum(counts[:origin]) >= MIN_RESERVATIONS
        and sum(value > 0 for value in counts[:origin]) >= MIN_BOOKING_DAYS
    ]
    if len(origins) > MAX_BACKTEST_ORIGINS:
        selected = np.linspace(
            0, len(origins) - 1, MAX_BACKTEST_ORIGINS, dtype=int
        )
        origins = [origins[index] for index in selected]

    if len(origins) < MIN_BACKTEST_ORIGINS:
        return {"originCount": len(origins)}

    actuals = {
        name: [[] for _ in range(FORECAST_HORIZON_DAYS)]
        for name in ("reservations", "guests", "hourly")
    }
    predictions = {
        name: [[] for _ in range(FORECAST_HORIZON_DAYS)]
        for name in ("reservations", "guests", "hourly")
    }
    baselines = {
        name: [[] for _ in range(FORECAST_HORIZON_DAYS)]
        for name in ("reservations", "guests", "hourly")
    }
    comparison = []

    for origin in origins:
        count_predictions, guest_predictions, hour_predictions = _fit_and_predict(
            history_dates,
            counts,
            guests,
            hourly_history,
            origin,
            FORECAST_HORIZON_DAYS,
        )
        for horizon, day_index in enumerate(
            range(origin, origin + FORECAST_HORIZON_DAYS)
        ):
            day = history_dates[day_index]
            actuals["reservations"][horizon].append(counts[day_index])
            predictions["reservations"][horizon].append(
                count_predictions[horizon]
            )
            baselines["reservations"][horizon].append(
                _seasonal_baseline(day, history_dates, counts, origin)
            )

            actuals["guests"][horizon].append(guests[day_index])
            predictions["guests"][horizon].append(guest_predictions[horizon])
            baselines["guests"][horizon].append(
                _seasonal_baseline(day, history_dates, guests, origin)
            )

            hour_actual = hourly_history[day_index]
            actuals["hourly"][horizon].extend(hour_actual)
            predictions["hourly"][horizon].extend(hour_predictions[horizon])
            hour_baseline = [
                _seasonal_baseline(
                    day,
                    history_dates,
                    [daily_hours[hour] for daily_hours in hourly_history],
                    origin,
                )
                for hour in range(24)
            ]
            baselines["hourly"][horizon].extend(hour_baseline)

            if origin == origins[-1]:
                comparison.append(
                    {
                        "date": day.isoformat(),
                        "actual": int(counts[day_index]),
                        "predicted": round(count_predictions[horizon], 2),
                        "baseline": round(
                            _seasonal_baseline(day, history_dates, counts, origin),
                            2,
                        ),
                    }
                )

    metrics = {}
    for name in actuals:
        horizon_metrics = []
        flat_actual = []
        flat_prediction = []
        flat_baseline = []
        for horizon in range(FORECAST_HORIZON_DAYS):
            current_actual = actuals[name][horizon]
            current_prediction = predictions[name][horizon]
            current_baseline = baselines[name][horizon]
            horizon_metrics.append(
                {
                    "horizonDays": horizon + 1,
                    **_metric_summary(
                        current_actual, current_prediction, current_baseline
                    ),
                }
            )
            flat_actual.extend(current_actual)
            flat_prediction.extend(current_prediction)
            flat_baseline.extend(current_baseline)
        metrics[name] = {
            **_metric_summary(flat_actual, flat_prediction, flat_baseline),
            "byHorizon": horizon_metrics,
        }

    return {
        "method": "rolling_origin",
        "baseline": "mean of the previous four observations for the same weekday",
        "horizonDays": FORECAST_HORIZON_DAYS,
        "originCount": len(origins),
        "validationDateRange": {
            "start": history_dates[origins[0]].isoformat(),
            "end": history_dates[origins[-1] + FORECAST_HORIZON_DAYS - 1].isoformat(),
        },
        "metrics": metrics,
        "comparison": comparison,
    }


def run_forecast(payload):
    anchor = date.fromisoformat(payload["as_of"])
    reservations = []
    seen_ids = set()
    duplicate_count = 0
    invalid_count = 0

    for record in payload.get("reservations", []):
        record_id = record.get("id")
        if record_id is not None:
            normalized_id = str(record_id)
            if normalized_id in seen_ids:
                duplicate_count += 1
                continue
            seen_ids.add(normalized_id)

        parsed = _parse_reservation(record)
        if parsed is None:
            invalid_count += 1
            continue
        if parsed[0] >= anchor:
            continue
        if parsed[0] < anchor - timedelta(days=1095):
            invalid_count += 1
            continue
        reservations.append(parsed)

    readiness_counts = defaultdict(int)
    for reservation_date, _, _, _ in reservations:
        readiness_counts[reservation_date] += 1

    if not readiness_counts:
        return _insufficient_response(
            payload, 0, 0, 0, duplicate_count, invalid_count, 0
        )

    first_date = min(readiness_counts)
    last_date = anchor - timedelta(days=1)
    calendar_days = (last_date - first_date).days + 1
    booking_days = len(readiness_counts)

    if (
        len(reservations) < MIN_RESERVATIONS
        or booking_days < MIN_BOOKING_DAYS
        or calendar_days < MIN_CALENDAR_DAYS
    ):
        return _insufficient_response(
            payload,
            len(reservations),
            booking_days,
            calendar_days,
            duplicate_count,
            invalid_count,
            0,
        )

    history_dates, count_values, guest_values, hourly_history = _build_history(
        reservations, first_date, last_date
    )
    backtest = _rolling_origin_backtest(
        history_dates, count_values, guest_values, hourly_history
    )
    backtest_origin_count = backtest["originCount"] if backtest else 0
    if backtest is None or "metrics" not in backtest:
        return _insufficient_response(
            payload,
            len(reservations),
            booking_days,
            calendar_days,
            duplicate_count,
            invalid_count,
            backtest_origin_count,
        )

    future_dates = [
        anchor + timedelta(days=offset)
        for offset in range(FORECAST_HORIZON_DAYS)
    ]
    prediction_dates = history_dates + future_dates
    predictions, guest_predictions, future_hourly = _fit_and_predict(
        prediction_dates,
        count_values,
        guest_values,
        hourly_history,
        len(history_dates),
        FORECAST_HORIZON_DAYS,
    )
    weekly_demand = [
        {
            "date": day.isoformat(),
            "weekday": WEEKDAYS[day.weekday()],
            "reservations": round(float(count), 1),
            "guests": round(float(guest_count), 1),
        }
        for day, count, guest_count in zip(
            future_dates, predictions, guest_predictions
        )
    ]
    forecast_hourly_totals = [
        sum(day[hour] for day in future_hourly) for hour in range(24)
    ]
    today_hourly = future_hourly[0]
    busiest_day = max(weekly_demand, key=lambda item: item["reservations"])
    peak_hours = sorted(
        range(24), key=lambda hour: forecast_hourly_totals[hour], reverse=True
    )[:3]
    today_peak_hour = max(range(24), key=lambda hour: today_hourly[hour])
    historical_average = float(np.mean(count_values))

    return {
        "status": "ready",
        "dataSource": payload.get("data_source", "actual"),
        "generatedAt": datetime.now().astimezone().isoformat(),
        "dataReadiness": _readiness(
            len(reservations),
            booking_days,
            calendar_days,
            duplicate_count,
            invalid_count,
            backtest_origin_count,
        ),
        "today": {
            "reservations": weekly_demand[0]["reservations"],
            "guests": weekly_demand[0]["guests"],
            "peakHour": _hour_label(today_peak_hour),
        },
        "busiestDay": busiest_day,
        "weeklyDemand": weekly_demand,
        "historicalTrend": [
            {
                "date": day.isoformat(),
                "reservations": int(count),
            }
            for day, count in zip(history_dates[-7:], count_values[-7:])
        ],
        "hourlyDemand": [
            {
                "hour": hour,
                "label": _hour_label(hour),
                "reservations": round(float(forecast_hourly_totals[hour]), 1),
            }
            for hour in range(24)
        ],
        "todayHourlyDemand": [
            {
                "hour": hour,
                "label": _hour_label(hour),
                "reservations": round(float(today_hourly[hour]), 2),
            }
            for hour in range(24)
        ],
        "peakHours": [
            {
                "hour": hour,
                "label": _hour_label(hour),
                "reservations": round(float(forecast_hourly_totals[hour]), 1),
            }
            for hour in peak_hours
        ],
        "evaluation": backtest,
        "insights": _insights(
            weekly_demand, forecast_hourly_totals, historical_average
        ),
    }


def _insufficient_response(
    payload,
    reservations,
    booking_days,
    calendar_days,
    duplicate_count,
    invalid_count,
    backtest_origin_count,
):
    return {
        "status": "insufficient_data",
        "dataSource": payload.get("data_source", "actual"),
        "generatedAt": datetime.now().astimezone().isoformat(),
        "message": (
            "More eligible reservation history is needed to produce a reliable "
            "seven-day forecast and at least three rolling-origin validation windows."
        ),
        "dataReadiness": _readiness(
            reservations,
            booking_days,
            calendar_days,
            duplicate_count,
            invalid_count,
            backtest_origin_count,
        ),
    }


def _readiness(
    reservations,
    booking_days,
    calendar_days,
    duplicate_count,
    invalid_count,
    backtest_origin_count,
):
    return {
        "reservationCount": reservations,
        "bookingDays": booking_days,
        "calendarDays": calendar_days,
        "duplicateRecordsIgnored": duplicate_count,
        "invalidRecordsIgnored": invalid_count,
        "backtestOrigins": backtest_origin_count,
        "minimumReservations": MIN_RESERVATIONS,
        "minimumBookingDays": MIN_BOOKING_DAYS,
        "minimumCalendarDays": MIN_CALENDAR_DAYS,
        "minimumBacktestOrigins": MIN_BACKTEST_ORIGINS,
    }


def _new_model():
    return RandomForestRegressor(
        n_estimators=160,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=1,
    )


def _insights(predictions, hourly_totals, historical_average):
    busiest = max(predictions, key=lambda item: item["reservations"])
    weekly_average = float(np.mean([item["reservations"] for item in predictions]))
    peak_hour = max(range(24), key=lambda hour: hourly_totals[hour])
    insights = [
        (
            f"{busiest['weekday']} ({busiest['date']}) has the highest predicted "
            f"demand at {busiest['reservations']:.1f} reservations."
        ),
        (
            f"The highest forecast hourly demand is around {_hour_label(peak_hour)} "
            "across the coming seven days."
        ),
    ]

    weekend = [
        item
        for item in predictions
        if date.fromisoformat(item["date"]).weekday() >= 4
    ]
    if weekend:
        busy_weekend_days = [
            item
            for item in weekend
            if item["reservations"] > weekly_average * 1.15
        ]
        if busy_weekend_days:
            days = ", ".join(item["weekday"] for item in busy_weekend_days)
            insights.append(
                f"{days} is predicted above the seven-day reservation demand average."
            )

    if busiest["reservations"] >= historical_average * 1.25:
        insights.append(
            f"Consider preparing additional tables for {busiest['weekday']}; its "
            "predicted demand is at least 25% above the historical daily average."
        )
    elif not weekend:
        insights.append(
            "No upcoming day exceeds the historical daily average by 25% in this forecast."
        )

    return insights


def main():
    try:
        payload = json.load(sys.stdin)
        result = run_forecast(payload)
        print(json.dumps(result, allow_nan=False))
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise


if __name__ == "__main__":
    main()

# DineAri - Cross-Platform Restaurant Management System

Team Roles & Responsibilities
- Team Leader: Gwynyth Edzcharyz Q Gomonit
- Developer: Guy Magcanta
           : Glenn Gabriel Sanchez
- Quality Assurance (QA): Zaira M. Alumbro
- Project Manager: Kimberly O. Carin

---

## 🗄️ Local PostgreSQL Setup
Follow [database/LOCAL_POSTGRESQL_SETUP.md](database/LOCAL_POSTGRESQL_SETUP.md) for pgAdmin 4 instructions and the project schema SQL. The backend connects to database `dinequeue_db` and uses schema `restaurant`.

---

## ⚙️ Backend Setup (Node.js & Express)
1. Open terminal in `/backend`
2. Run `npm install`
3. Copy `.env.example` to `.env` and set your local PostgreSQL values (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) and Google OAuth web client ID (`GOOGLE_CLIENT_ID`)
4. Keep `JWT_SECRET` set to a secure local value
5. Run `npm run dev` (server runs on port 3000)

Google authentication uses the Google Identity Services OAuth 2.0 popup token
flow with explicit account selection. The browser sends the short-lived access
token to the backend for audience validation and a verified Google user-info
lookup; the token is not stored. A client secret is not required for this
flow. Create a Google OAuth web client, add the app's origin (for example,
`http://localhost:3000`) to its authorized JavaScript origins, and configure
its client ID as `GOOGLE_CLIENT_ID` in the backend environment. Before enabling
Google customer sign-in against an
existing database, apply
[`database/migrations/20261110_google_customer_profiles.sql`](database/migrations/20261110_google_customer_profiles.sql)
to persist verified Google account identifiers and profile information.

The admin **Audit Logs** tab records successful and failed logins, logout, account and menu changes, inventory changes, table/chair activity, reservation creation, and order activity. Business-state mutations and their audit rows share a database transaction; authentication events are recorded immediately after the outcome. Logs can be searched and filtered through the admin-only audit endpoint. For an existing database, apply the required migrations in `database/migrations/` in date order, including `20261109_late_arrival_refunds.sql`, in pgAdmin Query Tool before starting the updated backend. This migration adds cashier authorization and completion metadata to the existing order refund fields; it does not create refund records or tables.

## Reservation Demand Forecasting

The admin dashboard includes a locally executed Random Forest forecast trained from eligible PostgreSQL reservation history. Cancelled, rejected, soft-deleted, future-dated, and out-of-range records are excluded. Rows are counted once by their unique reservation ID; duplicate IDs in a model input are ignored, while records with different IDs are retained because identical date/time/guest values can still be legitimate separate bookings.

The model requires at least 30 eligible reservations over 14 booking days spanning 30 calendar days, plus three complete rolling-origin seven-day validation windows. Otherwise it returns a data-readiness message instead of predictions. Validation reports MAE and RMSE separately for daily reservations, daily guests, and hourly reservations, compared with a same-weekday seasonal baseline. These are historical validation results, not guarantees of production accuracy.

1. Install Node dependencies in `/backend` with `npm install`. Chart.js is served locally from the backend; the dashboard does not fetch chart code from a CDN.
2. Install Python dependencies into the repository-local environment from `/backend`: on Windows run `..\.venv-win\Scripts\python.exe -m pip install -r forecasting/requirements.txt`; on other platforms run `../.venv/bin/python -m pip install -r forecasting/requirements.txt`. The backend automatically uses that project-local environment when present. Optionally set `PYTHON_EXECUTABLE` in `backend/.env` to override it; relative paths resolve from the project root. Forecast generation uses local Python packages and does not call an external AI service.
3. Generate or manually refresh forecasts from the **Reservation Forecast** admin tab. Opening the tab reuses the latest result and checks its freshness; it does not retrain the model. Results are marked outdated when eligible history changes or the forecast is at least 24 hours old. Forecast endpoints remain admin-only.

### Isolated forecast integration tests

Set `FORECAST_TEST_DB_NAME=dinequeue_db_forecast_test` in the local backend `.env`. This must be a dedicated PostgreSQL database name ending in `_test` and must differ from `DB_NAME`. From `/backend`, run:

```powershell
npm run prepare:forecast-test-db
npm run test:forecast-model
$env:FORECAST_TEST_DB_NAME = "dinequeue_db_forecast_test"
npm run test:forecast-db
```

The preparation script creates the separate database when needed, applies the canonical schema only to an empty test database, and inserts clearly labeled `FORECAST_TEST_*` records with varied weekdays/times/guest counts and eligible/ineligible statuses. It refuses to use the configured application database. The integration tests are read-only and use only that test database; Python model fixtures are in-memory. Do not point the test database setting at production.

An isolated simulated CSV sample is also provided in `forecasting/development_reservations.csv` for development only. It is never combined with restaurant records. To enable the dashboard's separate development-data option, explicitly set `ENABLE_FORECAST_DEVELOPMENT_DATA=true`; leave it disabled in production.

---

## Account Access

Use credentials assigned by the restaurant system administrator. The application does not provide a self-service password reset; an authorized database administrator must verify the account owner and coordinate password recovery. Do not rely on credentials from old setup notes.

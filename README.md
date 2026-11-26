# DineAri – Cross-Platform Restaurant Management System

A cross-platform restaurant management system supporting **Desktop, Web, and Mobile** frontends, powered by a Node.js/Express backend, PostgreSQL database, and a local Python Random Forest reservation demand forecasting engine.

---

## 👥 Team Structure, Roles & Engineering Governance

### 1. Core Team Roster & Responsibilities
* **Team Leader:** Gwynyth Edzcharyz Q. Gomonit  
  * *Responsibilities:* Convenes and facilitates mandatory weekly GitHub status meetings, oversees cross-platform alignment, resolves high-level blockers, and ensures milestone deadlines are met.
* **Project Manager (PM):** Kimberly O. Carin & Ralph Christian Jaralve 
  * *Responsibilities:* Maintains GitHub Project documentation (Backlog, Board, Current Iteration, and Roadmap), tracks sprint progress, audits open issues, and records/submits weekly meeting minutes to Google Classroom.
* **Quality Assurance (QA) Lead:** Zaira M. Alumbro  
  * *Responsibilities:* Validates code stability across platforms, tests pull requests prior to merging into `main`, verifies bug fixes, and serves as backup minutes taker when the PM acts as Team Leader.
* **Software Developers:** Guy Magcanta & Glenn Gabriel Sanchez  
  * *Responsibilities:* Architect, build, and maintain the system across all three target frontends (Desktop, Web, and Mobile Application) while adhering strictly to repository and code quality standards.

### 2. Standard Operating Procedures (Team Rules)

#### A. Version Control & Git Workflow
* **Selective Commits Only:** Developers must **never** stage or push all project files at once (`git add .` is prohibited for bulk unreviewed changes). Select and commit only the specific files modified for a given task or issue.
* **Main Branch Protection:** The `main` branch must remain stable and functional at all times. Broken or untested code must never be pushed directly to `main`.
* **Mandatory Code Documentation:** All pushed files must contain clear, descriptive inline comments explaining logic, functions, and structural changes so the entire team can easily read and maintain the codebase.

#### B. GitHub Project & Issue Management
* **Single Source of Truth:** All active tasks, features, and bug fixes must be documented and kept up to date across all GitHub Project views (**Backlog, Kanban Board, Current Iteration, and Roadmap**).
* **Issue Accountability:** Team members must update the status of their assigned GitHub Issues prior to the weekly status meeting. Stalled or blocked tasks will be audited and reassigned during the weekly sync.

#### C. Weekly Synchronization & Governance
* **Mandatory Attendance:** All members must attend the weekly GitHub Organization Status Meeting to review sprint health, audit blockers, and finalize action plans for upcoming milestones.
* **Deliverable Compliance:** The designated Minutes Taker must compile and upload the official meeting notes to Google Classroom immediately following each session.

---

## 💻 System Requirements & Software to Install

Before setting up the project, ensure you have the following software installed on your machine:

1. **Node.js (v18 or higher / LTS recommended)**
   * Includes `npm` for managing backend packages and dependencies.
   * [Download Node.js](https://nodejs.org)
2. **PostgreSQL & pgAdmin 4**
   * Relational database management system used to host `dinequeue_db`.
   * [Download PostgreSQL](https://postgresql.org)
3. **Python (v3.8 or higher)**
   * Required for running the local Random Forest reservation demand forecasting model.
   * [Download Python](https://python.org)

---

## 🗄️ Local PostgreSQL Setup & Migrations

* Follow `database/LOCAL_POSTGRESQL_SETUP.md` for pgAdmin 4 instructions and the project schema SQL.
* The backend connects to database **`dinequeue_db`** and uses schema **`restaurant`**.
* **For Existing Databases:** Apply all required migrations in `database/migrations/` in chronological date order—including `20261109_late_arrival_refunds.sql`—via the pgAdmin Query Tool before starting the updated backend. *(Note: This migration adds cashier authorization and completion metadata to existing order refund fields; it does not create new refund records or tables).*

---

## ⚙️ Backend Setup (Node.js & Express)

To run the system cleanly and avoid module or dependency errors, execute the following commands in your terminal:

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Clear old module caches and lock files (Windows CMD / PowerShell)
rmdir /s /q node_modules
del package-lock.json

# 3. Install fresh dependencies
npm install
```

### Environment Configuration & Startup
1. Copy `.env.example` to `.env` inside `/backend` and configure your local PostgreSQL credentials (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
2. Keep `JWT_SECRET` set to a secure local value.
3. Start the development server (runs on port `3000`):
   ```bash
   npm run dev
   ```

### Audit Logging
* The admin **Audit Logs** tab tracks successful/failed logins, logouts, account/menu updates, inventory changes, table/chair activity, reservation creation, and order activity.
* Business-state mutations and their audit rows share a database transaction; authentication events are recorded immediately after the outcome. Logs are searchable and filterable via the admin-only audit endpoint.

---

## 📈 Reservation Demand Forecasting

The admin dashboard includes a locally executed **Random Forest** forecast trained from eligible PostgreSQL reservation history.

### Data Eligibility & Model Rules
* **Exclusions:** Cancelled, rejected, soft-deleted, future-dated, and out-of-range records are excluded.
* **Deduplication:** Rows are counted once by unique reservation ID. Duplicate IDs in model inputs are ignored, while distinct IDs sharing identical date/time/guest values are retained as valid separate bookings.
* **Data Readiness Threshold:** Requires at least **30 eligible reservations** over **14 booking days** spanning **30 calendar days**, plus **three complete rolling-origin seven-day validation windows**. Otherwise, a data-readiness notice is displayed instead of predictions.
* **Metrics:** Validation reports **MAE** and **RMSE** separately for daily reservations, daily guests, and hourly reservations against a same-weekday seasonal baseline *(historical validation only; not a production accuracy guarantee)*.
* **Local Execution:** Chart.js is served locally from `/backend` (no external CDN), and forecast generation uses local Python libraries without calling external AI services.

### Python Environment Setup
Install Python dependencies into the repository-local virtual environment from inside `/backend`:

* **Windows:**
  ```powershell
  ..\.venv-win\Scripts\python.exe -m pip install -r forecasting/requirements.txt
  ```
* **macOS / Linux:**
  ```bash
  ../.venv/bin/python -m pip install -r forecasting/requirements.txt
  ```

*(Optional)* Set `PYTHON_EXECUTABLE` in `backend/.env` to override the default environment path (relative paths resolve from the project root).

### Generating Forecasts
* Trigger or manually refresh forecasts from the **Reservation Forecast** admin tab (admin-only endpoints).
* Opening the tab reuses the latest cached result and checks freshness without retraining. Results are flagged as outdated if eligible history changes or if the forecast is **24+ hours old**.

### Isolated Forecast Integration Tests
Set `FORECAST_TEST_DB_NAME=dinequeue_db_forecast_test` in `backend/.env` (must be a dedicated PostgreSQL database ending in `_test` and distinct from `DB_NAME`). From `/backend`, run:

```powershell
npm run prepare:forecast-test-db
npm run test:forecast-model
\$env:FORECAST_TEST_DB_NAME = "dinequeue_db_forecast_test"
npm run test:forecast-db
```

* `prepare:forecast-test-db` creates the isolated test database, applies the canonical schema only if empty, and populates clearly labeled `FORECAST_TEST_*` records. It strictly refuses to run against the primary application database.
* **Development Simulation Data:** An isolated sample file (`forecasting/development_reservations.csv`) is available for development testing only and is never mixed with live restaurant records. Enable it via `ENABLE_FORECAST_DEVELOPMENT_DATA=true` in `.env` (**keep disabled in production**).

---

## 🔐 Account Access & Security

* Use credentials assigned by the restaurant system administrator.
* Self-service password resets are disabled by design; an authorized database administrator must verify account ownership and coordinate password recovery. Do not rely on default credentials from legacy setup notes.

---

## 🧪 Postman API Testing Guide

### Step 1: Start the Server
Ensure the backend server is running from inside `/backend`:
```bash
npm run dev
```
*(Server runs at `http://localhost:3000`)*

### Step 2: Authenticate & Retrieve a JWT Token
1. Open Postman and create a new **POST** request to: `http://localhost:3000/api/auth/login`
2. Navigate to the **Body** tab, select **raw**, and set the format dropdown to **JSON**.
3. Enter valid administrator credentials:
   ```json
   {
     "email": "admin@dinequeue.com",
     "password": "admin123"
   }
   ```
4. Click **Send** and copy the returned `token` string from the JSON response.

### Step 3: Test Protected Endpoints
1. Create a new **GET** request (e.g., `http://localhost:3000/api/menu` or `http://localhost:3000/api/tables`).
2. Go to the **Authorization** tab and select **Bearer Token** from the Type dropdown.
3. Paste your copied JWT token into the **Token** field and click **Send**.

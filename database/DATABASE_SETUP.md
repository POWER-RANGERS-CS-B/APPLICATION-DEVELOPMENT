# Dine-ari PostgreSQL Database Setup

## Database and requirements

- **Database name:** `dinequeue_db`
- **PostgreSQL:** 12 or later (identity columns and JSONB are used).
- **Schema file:** [`dinequeue_db.sql`](./dinequeue_db.sql)
- **Application schema:** `restaurant`

The backend connects to the configured `DB_NAME` and sets `search_path` to
`restaurant,public`. Keep `DB_NAME=dinequeue_db`. The SQL file creates the
application schema and tables inside the database to which you connect. It
does not create/drop a database, modify existing data, create accounts, or
insert sample records.

## Create and initialize a fresh database

Use a new, empty local/development database. Do not run this initialization
file against a production database or an existing database containing data.

### pgAdmin

1. Connect to your PostgreSQL server.
2. Right-click **Databases** → **Create** → **Database...**.
3. Enter exactly `dinequeue_db` and save.
4. Select `dinequeue_db`, open **Query Tool**, and verify the connection is to
   that database.
5. Open `database/dinequeue_db.sql`, paste its full contents into Query Tool,
   and execute (F5).
6. Confirm there are no errors in the Messages panel; refresh
   **Schemas** → **restaurant** → **Tables**.

### psql on Windows

Run from the project root. Replace the PostgreSQL role if your local
installation uses a different owner. `createdb` may prompt for the password;
do not place credentials in the command line.

```powershell
createdb -U postgres dinequeue_db
psql -v ON_ERROR_STOP=1 -U postgres -d dinequeue_db -f "database/dinequeue_db.sql"
```

If `dinequeue_db` already exists, do not overwrite or reset it. Use a separate
empty test database or inspect the existing database first. The SQL file is
transactional, so a failed initialization rolls back its incomplete changes.

## Backend configuration

Configure the backend environment for your PostgreSQL installation:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dinequeue_db
DB_USER=your_local_database_role
DB_PASSWORD=your_local_database_password
```

Keep actual credentials in a private `.env`; do not commit them. The SQL file
contains no database credentials.

## Tables created

All nine tables are created in `restaurant`; no records are inserted.

| Table | Purpose |
|---|---|
| `users` | Authenticated customer, admin, staff, and cashier accounts; bcrypt hash, required username/email, role, and soft-deactivation timestamp. |
| `restaurant_tables` | Restaurant floor-plan tables, positions, and availability state. |
| `chairs` | Seats belonging to floor-plan tables and temporary hold expiry. |
| `reservations` | Reservation date/time, guest count, required guest full name/contact, and optional account/table references. |
| `menu_items` | Menu item/category/pricing and stock quantity (`stock_count`). |
| `orders` | Dine-in/takeout order, optional guest name/contact and account, dine-in table, kitchen status, payment method/status, amount, and receipt data. |
| `order_items` | Order item, quantity, and price snapshots. |
| `order_history` | Completed-order summary used by history and income views. |
| `audit_logs` | Actor, action, module, entity, and JSONB before/after/details records. |

### Customers and account roles

Customers can register and sign in for reservations, account features, and
dine-in ordering. Reservation creation and dine-in table locking/order
submission require an authenticated customer account. Reservations store the
required customer name/contact directly on the reservation, and the order API
associates each new dine-in order with the authenticated customer's `user_id`.
The column remains nullable for compatibility with existing records; the API
rejects unauthenticated order submissions. Passwords are never stored in
plain text.

Reservation contact numbers are validated against the selected country's
numbering rules and stored in E.164 format. Dine-in table orders store the
selected `table_id` on the order, while the order's identity and line items
remain linked through the existing order and order-item records.

There are no separate permission, category, inventory, payment transaction,
or kitchen-order tables in the current implementation. Roles live on `users`,
category and stock live on `menu_items`, payment method/status live on `orders`
and are copied to `order_history`, and the KDS reads the `orders` table.

Late-arrival refunds apply to verified paid dine-in orders only. The backend
uses `orders.total_amount` as the recorded amount paid and computes the
50-percent refund only when a late arrival is successfully confirmed. The
same order row stores the pending/processing/completed status. Starting
processing records the assigned cashier and timestamp; confirming completion
records the cashier and completion timestamp after the cash handoff.

## Foreign keys and relationships

- `chairs.table_id` → `restaurant_tables.id` (`ON DELETE CASCADE`).
- `reservations.user_id` → `users.id` (`ON DELETE SET NULL`, nullable).
- `reservations.table_id` → `restaurant_tables.id` (`ON DELETE SET NULL`).
- `orders.user_id` → `users.id` (`ON DELETE SET NULL`, nullable).
- `orders.table_id` → `restaurant_tables.id` (`ON DELETE SET NULL`, nullable).
- `orders.reservation_id` → `reservations.id` (`ON DELETE SET NULL`).
- `order_items.order_id` → `orders.id` (default `NO ACTION`).
- `order_items.menu_item_id` → `menu_items.id` (default `NO ACTION`).
- `order_history.order_id` → `orders.id` (`ON DELETE SET NULL`).
- `audit_logs.user_id` → `users.id` (`ON DELETE SET NULL`).

Soft deactivation/removal uses `deleted_at` where the application supports it.
The `ON DELETE` actions above apply only to explicit hard deletes. Audit rows
retain `actor_name` even if an account is later removed.

Admin reservation-history removal is a soft archive: the Admin-only
`DELETE /api/reservations/:id` endpoint sets `reservations.deleted_at` only for
completed, cancelled, or rejected records and writes the change to
`audit_logs` in the same transaction. Active, pending, and confirmed
reservations cannot be archived through this endpoint.

## Secure first administrator setup

The schema creates no administrator and contains no default credentials.
A first administrator must be provisioned securely before admin-only features
can be used:

1. Use a one-time, trusted local server-side Node script. Obtain the initial
   password from a secret manager or hidden prompt; do not put it in source,
   shell history, SQL history, logs, or this guide.
2. Hash it using the backend's `bcryptjs` dependency with 12 rounds, as used
   by `backend/models/userModel.js`.
3. Insert `full_name`, a unique username, email, the bcrypt `password_hash`,
   and role `admin` into `restaurant.users` using a parameterized query. Both
   username and email are required and unique case-insensitively. Never log
   the password or hash.
4. Verify the account through the existing `/api/auth/login` endpoint, then
   remove the temporary script and clear the secret from the process.
5. Store administrator credentials in the approved secret manager.

Staff accounts are created by admins using the protected staff-management API.
There is no public account registration.

## Verify successful initialization

Run these read-only checks in Query Tool connected to `dinequeue_db`.

List tables:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'restaurant'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Check allowed user roles:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'restaurant.users'::regclass
  AND contype = 'c';
```

Check database and schema:

```sql
SELECT current_database() AS database_name,
       EXISTS (
           SELECT 1
           FROM information_schema.schemata
           WHERE schema_name = 'restaurant'
       ) AS restaurant_schema_exists;
```

Expected: database `dinequeue_db`, schema exists, and the nine tables above
are listed. The backend's `npm run db:test` can additionally test connectivity
and transaction rollback.

## Compatibility and other SQL files

The schema preserves current backend table/column names, integer identity
keys, timestamp-without-time-zone columns, soft-delete fields, supported
statuses, case-insensitive email/username uniqueness, audit JSONB structure,
and nullable account links. It includes the current staff-account and audit
logging structures directly; no migration is required after fresh
initialization.

The canonical schema includes the cashier role and refund processing and
completion fields on `restaurant.orders`. For an existing database, apply
`database/migrations/20261109_late_arrival_refunds.sql` and
`database/migrations/20261109_cashier_refund_processing.sql` after the existing
order-payment and shared-arrival migrations before deploying the updated
backend.

Use only `database/dinequeue_db.sql` for a fresh database. The historical
`database/dine.sql` is destructive and contains sample rows; do not use it.
`database/dineari_schema.sql` is retained as a legacy development schema and
is not the authoritative initializer; its historical account and order
constraints may differ from the current authenticated customer workflows.
Use the canonical file above for fresh installations.
`database/dineari_sample_data.sql` is an optional, separate fictional
development fixture and is not part of this clean schema.

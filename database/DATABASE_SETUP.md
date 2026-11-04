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
| `users` | Authenticated admin/staff accounts only; bcrypt hash, required username/email, role, and soft-deactivation timestamp. |
| `restaurant_tables` | Restaurant floor-plan tables, positions, and availability state. |
| `chairs` | Seats belonging to floor-plan tables and temporary hold expiry. |
| `reservations` | Reservation date/time, guest count, required guest full name/contact, and optional account/table references. |
| `menu_items` | Menu item/category/pricing and stock quantity (`stock_count`). |
| `orders` | Dine-in/takeout order, optional guest name/contact, kitchen status, payment method/status, amount, and receipt data. |
| `order_items` | Order item, quantity, and price snapshots. |
| `order_history` | Completed-order summary used by history and income views. |
| `audit_logs` | Actor, action, module, entity, and JSONB before/after/details records. |

### Customers and account roles

Customers do not register or log in. The public `/api/auth/signup` route is
removed, authentication accepts only `admin` and `staff` accounts, and the
`users` role constraint permits only those two roles. Passwords are never
stored in plain text.

Reservations store customer `customer_name` and `contact_number` directly.
Both are required for a reservation; the reservation API validates an
international number against the selected country's numbering rules and
stores it in E.164 format. Orders can store optional customer name/contact
directly on the order record. An order or reservation does not require a
customer `user_id`. Any nullable `user_id` is an optional association with an
authenticated account (such as an operator), not a customer login identity.

There are no separate permission, category, inventory, payment transaction,
or kitchen-order tables in the current implementation. Roles live on `users`,
category and stock live on `menu_items`, payment method/status live on `orders`
and are copied to `order_history`, and the KDS reads the `orders` table.

## Foreign keys and relationships

- `chairs.table_id` → `restaurant_tables.id` (`ON DELETE CASCADE`).
- `reservations.user_id` → `users.id` (`ON DELETE SET NULL`, nullable).
- `reservations.table_id` → `restaurant_tables.id` (`ON DELETE SET NULL`).
- `orders.user_id` → `users.id` (`ON DELETE SET NULL`, nullable).
- `orders.reservation_id` → `reservations.id` (`ON DELETE SET NULL`).
- `order_items.order_id` → `orders.id` (default `NO ACTION`).
- `order_items.menu_item_id` → `menu_items.id` (default `NO ACTION`).
- `order_history.order_id` → `orders.id` (`ON DELETE SET NULL`).
- `audit_logs.user_id` → `users.id` (`ON DELETE SET NULL`).

Soft deactivation/removal uses `deleted_at` where the application supports it.
The `ON DELETE` actions above apply only to explicit hard deletes. Audit rows
retain `actor_name` even if an account is later removed.

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

Use only `database/dinequeue_db.sql` for a fresh database. The historical
`database/dine.sql` is destructive and contains sample rows; do not use it.
`database/dineari_schema.sql` is retained as a legacy development schema and
is not the authoritative initializer; it has been aligned to admin/staff-only
accounts and guest order fields, but use the canonical file above for fresh
installations.
`database/dineari_sample_data.sql` is an optional, separate fictional
development fixture and is not part of this clean schema.

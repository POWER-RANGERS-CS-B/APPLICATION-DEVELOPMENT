# Local PostgreSQL Setup

The canonical fresh-database instructions are in
[`DATABASE_SETUP.md`](./DATABASE_SETUP.md). Use `dinequeue_db` and initialize
it with [`dinequeue_db.sql`](./dinequeue_db.sql).

This file replaces the older local setup steps, which referred to an earlier
schema and optional data. Do not use the historical `dine.sql` file; it drops
tables and inserts sample account data. The canonical schema is seed-free and
does not alter an existing database.

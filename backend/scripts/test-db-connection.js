async function main() {
  let pool;

  try {
    pool = require("../config/db");
    const { testDatabaseConnection } = require("../config/dbConnectionTest");
    const result = await testDatabaseConnection();
    console.log("PostgreSQL connection test: SUCCESS");
    console.log(`Connected to database: ${result.database}`);
    console.log(`Current schema: ${result.schema}`);
    console.log(`restaurant.users table: ${result.usersTableExists ? "FOUND" : "MISSING"}`);
    console.log(`Temporary transaction rollback: ${result.transactionRolledBack ? "PASSED" : "FAILED"}`);
  } catch (error) {
    console.error(`PostgreSQL connection test: FAILED — ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

main();

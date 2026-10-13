/**
 * FFmpeg Orchestrator — Entry point
 *
 * Connects to Valkey (Redis-compatible) and PostgreSQL,
 * runs database migrations, and seeds an initial test task.
 * The ElysiaJS API server and background worker are yet to be wired up.
 */
import { redis, seedTestTask } from "./core/queue";
import { testPostgresConnection, sql } from "./db/client";
import { runMigrations } from "./db/migrations";
import { logger } from "./utils/logger";

logger.info("Orchestrator starting up core services...");

// ── Valkey (Redis) connection ──────────────────────────────────────────────

redis.on("connect", async () => {
  logger.info("Successfully connected to Valkey database");
  await seedTestTask();
});

redis.on("error", (err) => {
  logger.error("Valkey connection error encountered", err);
});

// ── PostgreSQL connection & migrations ──────────────────────────────────────

/**
 * Establish the database connection and run any pending migrations.
 * Exits the process on failure since the app cannot operate without a DB.
 */
async function initializeDatabase() {
  try {
    await testPostgresConnection();
    await runMigrations();
    logger.info("Database initialization and migrations completed successfully");
  } catch (error) {
    logger.error("Failed to initialize PostgreSQL database", error);
    process.exit(1);
  }
}

initializeDatabase();

// ── Graceful shutdown ───────────────────────────────────────────────────────

/**
 * Clean up database connections and close the Redis client on process exit.
 */
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  Promise.all([
    sql.end({ wait: true }).catch(() => {}),
    redis.quit().catch(() => {}),
  ]).then(() => {
    logger.info("Shutdown complete.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ── TODO: API & Worker startup ─────────────────────────────────────────────

// import "./api/index";   // ← Start ElysiaJS HTTP server here
// startWorker();          // ← Start queue consumer here

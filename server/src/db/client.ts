import postgres, { Sql } from "postgres";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ffmpeg_orchestrator";

/**
 * PostgreSQL connection pool using the `postgres.js` client.
 *
 * Configuration:
 * - max connections: 10
 * - idle timeout: 20 seconds
 * - connection timeout: 10 seconds
 *
 * @see https://github.com/porsager/postgres
 */
export const sql: Sql = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Fail connections that don't establish within 10 seconds
});

/**
 * Verifies the PostgreSQL connection by executing a simple query.
 * Logs the result (or error) but does not throw.
 */
export async function testPostgresConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log(`[PostgreSQL] Connected successfully at ${result[0].current_time}`);
  } catch (err) {
    console.error("[PostgreSQL] Connection error:", err);
  }
}

/**
 * Database migrations for the FFmpeg orchestrator.
 *
 * Implements a simple migration system:
 *   1. Creates a `schema_migrations` table to track applied migration versions.
 *   2. Executes only migrations that haven't been applied yet.
 *   3. Does not support rollback — use with caution in production.
 *
 * Migration files follow the naming convention:
 *   `NNN_<description>.sql`  (e.g. `001_create_pools.sql`)
 *
 * For production, consider a dedicated migration tool such as:
 *   - [dbmate](https://github.com/amacneil/dbmate)
 *   - [Flyway](https://flywaydb.org/)
 *   - [kysely-drift](https://github.com/RobinVerhas/kysely-drift)
 *
 * Current tables:
 *   - `pools`            — Worker pool definitions (name, concurrency)
 *   - `workflows`        — Video-processing workflow definitions (nodes + edges)
 *   - `presets`          — FFmpeg encoder presets (codec, container, params)
 *   - `settings`         — Key-value system configuration
 *   - `job_history`      — Historical record of every encoding job
 */
import { sql } from "./client";

// ── Migration table ──────────────────────────────────────────────────────────

/**
 * Internal helper: ensure the `schema_migrations` tracking table exists.
 */
async function ensureMigrationTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

/**
 * Return the highest migration version that has already been applied.
 * Returns 0 when no migrations have been applied yet.
 */
async function getAppliedVersion(): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(version), 0)::int AS max_version FROM schema_migrations
  `;
  return result[0].max_version;
}

/**
 * Mark a migration version as applied.
 */
async function markApplied(version: number, name: string): Promise<void> {
  await sql`
    INSERT INTO schema_migrations (version, name) VALUES (${version}, ${name})
  `;
}

// ── Migrations ──────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  console.log("[PostgreSQL] Running database migrations...");

  try {
    // Ensure tracking table exists first
    await ensureMigrationTable();

    const applied = await getAppliedVersion();

    // ── Migration 001: Base schema ────────────────────────────────────────
    if (applied < 1) {
      console.log("[PostgreSQL] Applying migration 001 (base schema)...");

      // ── Worker Pools ────────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS pools (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          max_concurrent_jobs INT DEFAULT 2,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // ── Workflow Definitions ────────────────────────────────────────────
      // Stores XYFlow node/edge data and JSON configuration for video pipelines.
      await sql`
        CREATE TABLE IF NOT EXISTS workflows (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
          edges JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // ── Encoder Presets ─────────────────────────────────────────────────
      // Encapsulates FFmpeg codec, container, and parameter presets.
      await sql`
        CREATE TABLE IF NOT EXISTS presets (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          codec VARCHAR(50) NOT NULL,
          container VARCHAR(20) NOT NULL,
          parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // ── System Settings ─────────────────────────────────────────────────
      // General key-value store for system configuration and theme settings.
      await sql`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // ── Job History ─────────────────────────────────────────────────────
      // Historical metadata for every encoding job, including parent-child
      // relationships for pipeline processing and ffprobe results.
      await sql`
        CREATE TABLE IF NOT EXISTS job_history (
          id VARCHAR(100) PRIMARY KEY,
          parent_id VARCHAR(100) REFERENCES job_history(id) ON DELETE SET NULL,
          pool_name VARCHAR(100),
          status VARCHAR(50) NOT NULL, -- 'completed', 'failed', 'cancelled'
          input_file TEXT NOT NULL,
          output_file TEXT,
          metadata JSONB DEFAULT '{}'::jsonb, -- ffprobe results, bitrate, resolution
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          finished_at TIMESTAMP WITH TIME ZONE
        );
      `;

      await markApplied(1, "base_schema");
    }

    console.log("[PostgreSQL] Migrations completed successfully!");
  } catch (error) {
    console.error("[PostgreSQL] Migration failed:", error);
    throw error;
  }
}

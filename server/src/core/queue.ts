/**
 * Valkey (Redis-compatible) client and queue helpers.
 *
 * The application uses a single Redis instance as a job queue.
 * Currently, only the main queue (`main_queue`) is defined;
 * additional queues (e.g., `priority_queue`) can be added later.
 */
import { Redis } from "ioredis";

// ── Client ───────────────────────────────────────────────────────────────────

/**
 * Create the Valkey client.
 *
 * Connection parameters can be overridden via environment variables:
 * - `VALKEY_HOST` — default: `"valkey"`
 * - `VALKEY_PORT` — default: `6379`
 */
const valkeyHost = process.env.VALKEY_HOST || "valkey";
const valkeyPort = Number(process.env.VALKEY_PORT) || 6379;

export const redis = new Redis({
  host: valkeyHost,
  port: valkeyPort,
  db: 0,
});

redis.on("connect", () => {
  console.log(`[Valkey] Connected successfully to ${valkeyHost}:${valkeyPort}`);
});

redis.on("error", (err) => {
  console.error("[Valkey] Connection error:", err);
});

// ── Seed / Test helpers ─────────────────────────────────────────────────────

/**
 * Pushes a synthetic test job into `main_queue`.
 *
 * Intended for local bootstrapping and integration testing only.
 * **Not** meant for production use — mark as `@internal` to discourage
 * importing this in application code.
 *
 * @internal
 */
export async function seedTestTask(): Promise<void> {
  try {
    const testTask = {
      id: "task-" + Date.now(),
      filename: "sample_video_4k.mp4",
      pool: "gpu-heavy",
      complexityScore: 85.5,
      createdAt: new Date().toISOString(),
    };

    await redis.lpush("main_queue", JSON.stringify(testTask));
    console.log("[Queue] Test task successfully pushed to 'main_queue'!");
  } catch (error) {
    console.error("[Queue] Failed to push test task:", error);
  }
}

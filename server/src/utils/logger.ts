// ── Types ────────────────────────────────────────────────────────────────────

/** Supported log severity levels. */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/** Flexible key-value metadata attached to a log entry. */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * A structured log entry (written as JSON).
 * Errors include `error_message` and optionally `stack`.
 */
export interface LogEntry extends LogMetadata {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  error_message?: string;
  stack?: string;
}

// ── Logger ───────────────────────────────────────────────────────────────────

/**
 * Structured JSON logger.
 *
 * Errors are written to **stderr**; everything else to **stdout**.
 * This separation lets log collectors (Docker, Loki, etc.) route them correctly.
 *
 * In non-production environments, `debug()` is enabled.
 * In production, it is suppressed to reduce noise.
 */
class Logger {
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    const timestamp = new Date().toISOString();

    const logEntry: LogEntry = {
      timestamp,
      level,
      service: "ffmpeg-orchestrator",
      message,
      ...meta,
    };

    const jsonString = JSON.stringify(logEntry);

    // Send errors to stderr, everything else to stdout (for Loki/Docker)
    if (level === LogLevel.ERROR) {
      console.error(jsonString);
    } else {
      console.log(jsonString);
    }
  }

  /** Log an informational message. */
  public info(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /** Log a warning message. */
  public warn(message: string, meta?: LogMetadata): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log an error message with optional error object and metadata.
   *
   * If `error` is an `Error` instance, its `message` and `stack` are extracted
   * and stored as `error_message` and `stack` on the log entry.
   */
  public error(message: string, error?: unknown, meta?: LogMetadata): void {
    let errorDetails: LogMetadata = {};

    if (error instanceof Error) {
      errorDetails = {
        error_message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined && error !== null) {
      // For non-Error values, stringify the raw value
      errorDetails = { error_details: String(error) };
    }

    this.log(LogLevel.ERROR, message, { ...meta, ...errorDetails });
  }

  /**
   * Log a debug message. Only active when `NODE_ENV` is not `"production"`.
   */
  public debug(message: string, meta?: LogMetadata): void {
    if (process.env.NODE_ENV !== "production") {
      this.log(LogLevel.DEBUG, message, meta);
    }
  }
}

/**
 * Globally shared logger singleton.
 * Use `import { logger } from "./utils/logger"` throughout the app.
 */
export const logger = new Logger();

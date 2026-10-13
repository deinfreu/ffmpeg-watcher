FROM oven/bun:alpine

# Install tzdata for timezone support
RUN apk add --no-cache tzdata
ENV TZ=Europe/Amsterdam

WORKDIR /app

# ── STAGE 1: Install production dependencies ───────────────────────────────
# Copy only package files first for optimal Docker layer caching.
# The `bun install` layer is only rebuilt when package.json or the lockfile changes.
COPY package.json bun.lockb* ./
RUN bun install --production

# ── STAGE 2: Copy application source ───────────────────────────────────────
COPY . .

# Ensure proper file ownership
RUN chown -R bun:bun /app

# Run as non-root user for security
USER bun

EXPOSE 3000

# Start the application (production mode, no hot-reload)
CMD ["bun", "run", "src/index.ts"]

# ============================================
# Mizero Inventory Hub — Backend Dockerfile
# ============================================

# ---- Build Stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production dependencies from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create required directories with proper permissions
RUN mkdir -p /app/uploads /app/database\ backup && \
    chown -R appuser:appgroup /app/uploads /app/database\ backup /app

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the server
CMD ["node", "server.js"]

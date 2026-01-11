# Root Dockerfile - Healthcare AI Backend + MCP Server (Combined)
# This Dockerfile builds both the backend API and MCP server together
# Use this for production deployment when running both services in one container
# Compatible with Cloudflare Containers and Docker Compose

# Stage 1: Build both backend and MCP server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy and install MCP server dependencies first (better layer caching)
COPY mcp-server/package*.json ./mcp-server/
COPY mcp-server/tsconfig.json ./mcp-server/
RUN cd mcp-server && npm ci --prefer-offline --no-audit

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
RUN cd backend && npm ci --prefer-offline --no-audit

# Copy source code for both services
COPY mcp-server/src ./mcp-server/src
COPY backend/src ./backend/src

# Build MCP server
RUN cd mcp-server && npm run build

# Build backend
RUN cd backend && npm run build:backend

# Stage 2: Production
FROM node:20-alpine

# Add labels for container management
LABEL org.opencontainers.image.title="RENALGUARD Backend + MCP Server"
LABEL org.opencontainers.image.description="Combined Express API and Clinical Decision Support server"
LABEL org.opencontainers.image.vendor="RENALGUARD"

WORKDIR /app

# Install dumb-init for proper signal handling and wget for health checks
RUN apk add --no-cache dumb-init wget

# Copy backend package files and install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production --prefer-offline --no-audit && npm cache clean --force

# Copy MCP server package files and install production dependencies
COPY mcp-server/package*.json ./mcp-server/
RUN cd mcp-server && npm ci --only=production --prefer-offline --no-audit && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/mcp-server/dist ./mcp-server/dist

# Copy migration files and runner scripts
COPY infrastructure/postgres/migrations ./infrastructure/postgres/migrations
COPY backend/autoMigrate.js ./backend/autoMigrate.js
COPY backend/runMigration.js ./backend/runMigration.js
COPY backend/markMigrationsApplied.js ./backend/markMigrationsApplied.js

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to backend
WORKDIR /app/backend

# Environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check using wget (more reliable than node http check)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the backend with automatic migrations (which will spawn MCP server as child process)
# autoMigrate.js runs first to apply any pending migrations, then starts the server
CMD ["sh", "-c", "node autoMigrate.js && node dist/index.js"]
